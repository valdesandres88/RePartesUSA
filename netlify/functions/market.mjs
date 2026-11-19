import {db,stripe,respond,fail,unwrap,auth,checkOrigin,str,positiveInt,exactStatus,validImage,asError} from './shared.mjs';
import {checkoutCredentialsCompatible} from './payment-guards.mjs';
import {randomBytes} from 'node:crypto';
import {handleCheckoutTest} from '../lib/checkout-tests.mjs';
import {submitPartRequest} from '../lib/part-requests.mjs';
import {prepareQuotePhotos,readPartQuotes,savePartQuote,withdrawPartQuote} from '../lib/part-quotes.mjs';
import {recordAnalytics,reportDays} from '../lib/website-analytics.mjs';
import {supplierConfiguration} from '../lib/partner-inventory.mjs';
import {canRequestReturn,canDispatchReturn,normalReferralCode,daysAfter,genuineSellerPhoto} from './store-rules.mjs';
const SITE=()=>process.env.SITE_URL?.replace(/\/$/,'')||'http://localhost:8888';
const checkoutMode=()=>process.env.CHECKOUT_MODE||'disabled';
const checkoutReady=()=>checkoutCredentialsCompatible(checkoutMode(),process.env.STRIPE_SECRET_KEY||'');
const audit=async(d,actor,action,target,details={})=>{const {error}=await d.from('audit_log').insert({actor_id:actor,action,target_id:String(target||''),details});if(error)throw error;};
const isPlatformSeller=id=>Boolean(process.env.OWNER_USER_ID)&&id===process.env.OWNER_USER_ID;
const sellerReady=async(s,accountId)=>{if(!accountId)return false;const a=await s.accounts.retrieve(accountId);return Boolean(a.payouts_enabled&&a.capabilities?.transfers==='active');};
export async function handler(event){
 try{
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_URL)fail('Falta configuración privada de Supabase.',503);
  const d=db(),method=event.httpMethod,action=new URLSearchParams(event.queryStringParameters||{}).get('action')||'site';
  if(action==='analytics.event'&&(!event.body||event.body.length>1200))fail('Invalid analytics payload.');
  let body={};if(method==='POST'){if(!['quote.compare','analytics.event'].includes(action))checkOrigin(event);try{body=JSON.parse(event.body||'{}');}catch{fail('JSON inválido.');}}
  if(method==='POST'&&action==='analytics.event'){
   if((event.headers['sec-fetch-site']||event.headers['Sec-Fetch-Site'])!=='same-origin')checkOrigin(event);
   await recordAnalytics(body,event.headers['user-agent']||event.headers['User-Agent'],d);
   return respond({ok:true});
  }
  if(method==='GET'&&action==='analytics.report'){
   await auth(event,d,{owner:true});
   const days=reportDays(event.queryStringParameters?.days);
   return respond(unwrap(await d.rpc('owner_live_website_analytics',{report_days:days})));
  }
  if(method==='POST'&&action==='quote.compare')return respond(await readPartQuotes(body?.token,d));
  if(method==='POST'&&action==='quote.submit')return respond(await submitPartRequest(body,d));
  if(method==='GET'&&action==='supplier-status'){
   await auth(event,d,{owner:true});
   return respond(supplierConfiguration());
  }
  if(method==='GET'&&action==='part-requests'){
   await auth(event,d,{owner:true});
   return respond({requests:unwrap(await d.from('part_requests').select('id,vehicle_year,make,model,part,details,contact_name,email,phone,zip_code,status,created_at,quote_token,part_request_quotes(id,seller_name,total_cents,active)').order('created_at',{ascending:false}).limit(100))});
  }
  if(method==='GET'&&action==='site'){
   const [settings,items]=await Promise.all([
    d.from('site_settings').select('hero_title,hero_subtitle,announcement,commission_bps,payments_enabled,support_email,social_links,adsense_publisher_id,adsense_enabled,monetization_offers').eq('id',1).single(),
    d.from('listings').select('id,seller_id,title,description,make,model,year_min,year_max,part_number,condition,price_cents,image_url,public_contact_enabled,contact_email,contact_phone,created_at').eq('status','approved').eq('inventory_verified_by_owner',true).order('created_at',{ascending:false}).limit(100)
   ]);
   const conf=unwrap(settings),listings=unwrap(items),ids=[...new Set(listings.map(x=>x.seller_id))];
   const sellers=ids.length?unwrap(await d.from('sellers').select('user_id,shop_name,status').in('user_id',ids)):[];
   const flags=ids.length?unwrap(await d.from('profiles').select('id,is_banned').in('id',ids)):[];
   const active=new Set(flags.filter(x=>!x.is_banned).map(x=>x.id));
   const lookup=new Map(sellers.filter(x=>x.status==='approved'&&active.has(x.user_id)).map(x=>[x.user_id,x.shop_name]));
   return respond({settings:conf,listings:listings.filter(x=>lookup.has(x.seller_id)).map(x=>({...x,shop_name:lookup.get(x.seller_id),contact_email:x.public_contact_enabled?x.contact_email:'',contact_phone:x.public_contact_enabled?x.contact_phone:''}))});
  }
  if(method==='GET'&&action==='adsconfig'){
   const settings=unwrap(await d.from('site_settings').select('adsense_enabled,adsense_publisher_id').eq('id',1).single());
   const id=settings.adsense_publisher_id||'';
   return respond({enabled:settings.adsense_enabled===true&&/^ca-pub-[0-9]{16}$/.test(id),publisher_id:/^ca-pub-[0-9]{16}$/.test(id)?id:''});
  }
  if(method==='GET'&&action==='reviews'){
   const scope=(event.queryStringParameters||{}).scope==='part'?'part':'website';
   const listingId=String((event.queryStringParameters||{}).listing_id||'');
   if(scope==='part'&&!/^[0-9a-f-]{36}$/i.test(listingId))fail('Falta el identificador de la pieza.');
   let q=d.from('market_reviews').select('id,rating,title,comment,created_at,subject,listing_id').eq('status','approved').eq('subject',scope).order('created_at',{ascending:false}).limit(100);
   if(scope==='part')q=q.eq('listing_id',listingId);
   const list=unwrap(await q);
   const count=list.length;
   return respond({scope,count,average:count?Math.round(list.reduce((a,b)=>a+b.rating,0)*10/count)/10:null,reviews:list});
  }
  if(method==='GET'&&action==='me'){
   const u=await auth(event,d),seller=unwrap(await d.from('sellers').select('*').eq('user_id',u.id).maybeSingle());
   let account_ready=false;
   if(seller&&isPlatformSeller(u.id))account_ready=true; // Owner's inventory settles to the platform account, not Express.
   else if(seller?.stripe_account_id&&process.env.STRIPE_SECRET_KEY){try{account_ready=await sellerReady(stripe(),seller.stripe_account_id);}catch{}}
   return respond({id:u.id,email:u.email,is_owner:u.id===process.env.OWNER_USER_ID,seller:seller&&{shop_name:seller.shop_name,status:seller.status,account_ready,is_platform_store:isPlatformSeller(u.id),commission_bps:isPlatformSeller(u.id)?0:seller.commission_bps}});
  }
  if(method==='GET'&&action==='referrals'){
   const u=await auth(event,d);
   let record=unwrap(await d.from('referral_codes').select('code').eq('user_id',u.id).maybeSingle());
   if(!record){
    const proposed=randomBytes(6).toString('hex').toUpperCase();
    const inserted=await d.from('referral_codes').insert({user_id:u.id,code:proposed});
    if(inserted.error && inserted.error.code!=='23505')throw inserted.error;
    record=unwrap(await d.from('referral_codes').select('code').eq('user_id',u.id).maybeSingle());
    if(!record)fail('No fue posible crear el enlace. Inténtalo de nuevo.',503);
   }
   const [balance,recent]=await Promise.all([
    d.rpc('referral_balance',{p_referrer:u.id}),
    d.from('referral_earnings').select('created_at,state,reward_cents,available_on').eq('referrer_id',u.id).order('created_at',{ascending:false}).limit(20)
   ]);
   return respond({code:record.code,...unwrap(balance),recent:unwrap(recent),rewards_enabled:true});
  }
  if(method==='GET'&&action==='mine'){
   const u=await auth(event,d),[listings,buying,selling]=await Promise.all([
    d.from('listings').select('*').eq('seller_id',u.id).order('created_at',{ascending:false}).limit(200),
    d.from('orders').select('*,listings(title)').eq('buyer_id',u.id).order('created_at',{ascending:false}).limit(100),
    d.from('orders').select('*,listings(title)').eq('seller_id',u.id).order('created_at',{ascending:false}).limit(100)
   ]);
   const returns=unwrap(await d.from('return_requests').select('id,order_id,reason,details,status,return_tracking,requested_at,authorized_at').eq('buyer_id',u.id).order('requested_at',{ascending:false}).limit(100));
   return respond({listings:unwrap(listings),purchases:unwrap(buying),sales:unwrap(selling),returns});
  }
  if(method==='GET'&&action==='checkout-test'){
   await auth(event,d,{owner:true});
   const record=unwrap(await d.from('checkout_tests').select('id,status,paid_webhook_at,refund_webhook_at,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle());
   return respond({mode:checkoutMode(),configured:checkoutReady(),record});
  }
  if(method==='GET'&&action==='owner.user'){
   await auth(event,d,{owner:true});
   const id=event.queryStringParameters?.id||'';
   if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))fail('Invalid account ID.');
   const profile=unwrap(await d.from('profiles').select('display_name,is_banned,created_at').eq('id',id).maybeSingle());
   if(!profile)fail('Account not found.',404);
   const account=unwrap(await d.auth.admin.getUserById(id)).user;
   const shop=unwrap(await d.from('sellers').select('shop_name,status').eq('user_id',id).maybeSingle());
   return respond({name:profile.display_name,email:account.email,emailConfirmed:Boolean(account.email_confirmed_at),
    joined:account.created_at||profile.created_at,lastSignIn:account.last_sign_in_at,suspended:profile.is_banned,shop});
  }
  if(method==='GET'&&action==='dashboard'){
   await auth(event,d,{owner:true});
   const [metrics,listings,sellers,orders,users,settings,audits]=await Promise.all([
    d.rpc('owner_metrics'),d.from('listings').select('*,sellers(shop_name)').order('created_at',{ascending:false}).limit(200),
    d.from('sellers').select('user_id,shop_name,status,stripe_account_id,commission_bps,created_at').order('created_at',{ascending:false}).limit(200),
    d.from('orders').select('*,listings(title)').order('created_at',{ascending:false}).limit(150),
    d.from('profiles').select('id,display_name,is_banned,created_at').order('created_at',{ascending:false}).limit(150),
    d.from('site_settings').select('*').eq('id',1).single(),
    d.from('audit_log').select('*').order('created_at',{ascending:false}).limit(50)
   ]);
   const [returns,referrals,reviews]=await Promise.all([
    d.from('return_requests').select('id,order_id,buyer_id,reason,details,evidence_url,status,admin_note,return_tracking,requested_at,authorized_at,received_at').order('requested_at',{ascending:false}).limit(200),
    d.from('referral_earnings').select('referred_id,referrer_id,code,created_at,qualified,reward_cents,state,available_on').order('created_at',{ascending:false}).limit(200),
    d.from('market_reviews').select('id,reviewer_id,subject,listing_id,order_id,rating,title,comment,status,created_at').order('created_at',{ascending:false}).limit(150)
   ]);
   const returnRows=unwrap(returns),referralRows=unwrap(referrals);
   return respond({metrics:unwrap(metrics),listings:unwrap(listings),sellers:unwrap(sellers).map(({stripe_account_id,...s})=>({...s,commission_bps:isPlatformSeller(s.user_id)?0:s.commission_bps,connect_configured:isPlatformSeller(s.user_id)||Boolean(stripe_account_id),is_platform_store:isPlatformSeller(s.user_id)})),orders:unwrap(orders),users:unwrap(users),settings:unwrap(settings),audit:unwrap(audits),returns:returnRows,referrals:referralRows,referral_stats:{registered:referralRows.length,qualified:referralRows.filter(x=>x.qualified).length,rewards_enabled:true},reviews:unwrap(reviews)});

  }
  if(method!=='POST')fail('Método no permitido.',405);
  const u=await auth(event,d),s=stripe;
  if(action==='review.submit'){
   const subject=exactStatus(body.subject,['website','part']);
   const rating=positiveInt(body.rating,1,5);
   const title=str(body.title,120),comment=str(body.comment,2000);
   if(title.length<3||comment.length<20)fail('Escribe un título y una opinión de al menos 20 caracteres.');
   const blocked=unwrap(await d.from('profiles').select('is_banned').eq('id',u.id).single());
   if(blocked.is_banned)fail('La cuenta está suspendida.');
   const review={reviewer_id:u.id,subject,rating,title,comment,status:'pending'};
   if(subject==='website'){
    const existing=unwrap(await d.from('market_reviews').select('id').eq('reviewer_id',u.id).eq('subject','website').maybeSingle());
    if(existing)fail('Ya publicaste una opinión sobre la website. Contacta a soporte si necesitas corregirla.');
   }else{
    const order=unwrap(await d.from('orders').select('id,listing_id,seller_id,buyer_id,status').eq('id',body.order_id).eq('buyer_id',u.id).single());
    if(!['paid','shipped'].includes(order.status))fail('Solo puedes calificar piezas después de una compra real confirmada.');
    if(order.seller_id===u.id)fail('No puedes calificar tus propias piezas.');
    const duplicate=unwrap(await d.from('market_reviews').select('id').eq('order_id',order.id).maybeSingle());
    if(duplicate)fail('Ya existe una opinión para esta compra.');
    review.order_id=order.id;review.listing_id=order.listing_id;
   }
   const saved=await d.from('market_reviews').insert(review).select('id').single();
   if(saved.error){if(saved.error.code==='23505')fail('Ya existe una opinión para esta compra.');throw saved.error;}
   await audit(d,u.id,'review.submitted',saved.data.id,{subject});
   return respond({ok:true,moderation:'pending'});
  }
  if(action==='referral.claim'){
   const code=normalReferralCode(body.code);
   if(!code)fail('Código de referido inválido.');
   const profile=unwrap(await d.from('referral_codes').select('user_id,created_at').eq('code',code).maybeSingle());
   if(!profile)fail('Código de referido no encontrado.',404);
   if(profile.user_id===u.id)fail('No puedes referirte a ti mismo.');
   const age=Date.now()-Date.parse(u.created_at||'');
   if(!Number.isFinite(age)||age<0||age>7*86400000)fail('El referido debe registrarse durante los primeros 7 días.');
   if(Date.parse(profile.created_at)>Date.parse(u.created_at)+60000)fail('El enlace debe existir antes del registro.');
   const existing=unwrap(await d.from('referrals').select('referred_id').eq('referred_id',u.id).maybeSingle());
   if(existing)return respond({ok:true,claimed:false});
   const referrer=unwrap(await d.from('profiles').select('is_banned').eq('id',profile.user_id).single());
   if(referrer.is_banned)fail('Este referido no está disponible.');
   const past=unwrap(await d.from('orders').select('id').eq('buyer_id',u.id).limit(1));
   if(past.length)fail('No se pueden asociar referidos a cuentas con pedidos anteriores.');
   const added=await d.from('referrals').insert({referred_id:u.id,referrer_id:profile.user_id,code});
   if(added.error){if(added.error.code==='23505')return respond({ok:true,claimed:false});throw added.error;}
   await audit(d,u.id,'referral.claim',u.id,{code});
   return respond({ok:true,claimed:true});
  }
  if(action==='return.request'){
   const order=unwrap(await d.from('orders').select('id,buyer_id,seller_id,status,delivered_at').eq('id',body.order_id).eq('buyer_id',u.id).single());
   if(order.status!=='shipped'||!order.delivered_at)fail('La entrega debe estar confirmada antes de solicitar la devolución.');
   if(!canRequestReturn(order.delivered_at))fail('El plazo ordinario de 30 días ya venció. Contacta a soporte para revisar derechos aplicables.');
   const reason=exactStatus(body.reason,['damaged','defective','wrong_item','not_as_described','incompatible','changed_mind','other']);
   const details=str(body.details,2000),evidence_url=validImage(str(body.evidence_url,900));
   if(details.length<20)fail('Describe el motivo con al menos 20 caracteres.');
   const item=await d.from('return_requests').insert({order_id:order.id,buyer_id:u.id,seller_id:order.seller_id,reason,details,evidence_url}).select('id').single();
   if(item.error){if(item.error.code==='23505')fail('Ya existe una solicitud para este pedido.');throw item.error;}
   await audit(d,u.id,'return.request',order.id,{return_id:item.data.id,reason});
   return respond({ok:true,id:item.data.id});
  }
  if(action==='return.tracking'){
   const item=unwrap(await d.from('return_requests').select('id,status,authorized_at').eq('id',body.id).eq('buyer_id',u.id).single());
   if(item.status!=='approved')fail('Esta devolución no está autorizada o ya tiene seguimiento.');
   if(!canDispatchReturn(item.authorized_at))fail('Venció el plazo para despachar la devolución. Contacta a soporte.');
   const code=str(body.tracking_code,120);
   if(code.length<5)fail('Agrega un número de seguimiento real.');
   unwrap(await d.from('return_requests').update({return_tracking:code,status:'in_transit'}).eq('id',item.id).eq('status','approved').select('id').single());
   await audit(d,u.id,'return.tracking',item.id);
   return respond({ok:true});
  }
  if(action==='seller.apply'){
   const name=str(body.shop_name,100);if(name.length<2)fail('Nombre de tienda demasiado corto.');
   const existing=unwrap(await d.from('sellers').select('user_id,status').eq('user_id',u.id).maybeSingle());
   if(existing)fail('Ya existe una solicitud de vendedor.');
   const ownStore=isPlatformSeller(u.id);
   const setup=unwrap(await d.from('site_settings').select('commission_bps').eq('id',1).single());
   unwrap(await d.from('sellers').insert({user_id:u.id,shop_name:name,status:ownStore?'approved':'pending',commission_bps:ownStore?0:setup.commission_bps}));
   await audit(d,u.id,ownStore?'owner.store.created':'seller.apply',u.id,{shop_name:name});return respond({ok:true,owner_store:ownStore});
  }
  if(action==='seller.connect'){
   if(isPlatformSeller(u.id))fail('La tienda Owner recibe pagos en la cuenta principal de Stripe. No necesita Stripe Express.',400);
   if(!process.env.STRIPE_SECRET_KEY)fail('Stripe no está configurado.',503);
   const seller=unwrap(await d.from('sellers').select('*').eq('user_id',u.id).single());
   if(seller.status==='suspended')fail('Tu tienda está suspendida.',403);
   const client=s();let account=seller.stripe_account_id;
   if(!account){
    const a=await client.accounts.create({type:'express',country:'US',email:u.email,capabilities:{transfers:{requested:true}},metadata:{seller_user_id:u.id}});
    account=a.id;unwrap(await d.from('sellers').update({stripe_account_id:account}).eq('user_id',u.id));
   }
   const link=await client.accountLinks.create({account,refresh_url:`${SITE()}/#sell`,return_url:`${SITE()}/#sell`,type:'account_onboarding'});
   return respond({url:link.url});
  }
  if(action==='listing.save'){
   const seller=unwrap(await d.from('sellers').select('status').eq('user_id',u.id).maybeSingle());
   if(!seller||seller.status==='suspended')fail('Solicita una cuenta de vendedor primero.',403);
   const title=str(body.title,140),description=str(body.description,4000),make=str(body.make,60),model=str(body.model,60);
   const photo=str(body.image_url,900);
   if(!genuineSellerPhoto(photo,u.id,process.env.SUPABASE_URL))fail('Sube una foto original de la pieza desde tu teléfono. No se permiten fotografías de catálogo ni imágenes externas.');
   if(body.seller_has_item!==true || body.original_photo_attested!==true)fail('Confirma que tienes físicamente la pieza y que la foto es auténtica.');
   const image_url=validImage(photo);
   const public_contact_enabled=body.public_contact_enabled===true;
   const email=str(body.contact_email,160).toLowerCase(),phoneRaw=str(body.contact_phone,25);
   if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))fail('Correo de contacto inválido.');
   const phoneDigits=phoneRaw.replace(/[^0-9]/g,'');
   if(phoneRaw&&!/^[+0-9().\s-]+$/.test(phoneRaw))fail('Teléfono de contacto inválido.');
   const contact_phone=phoneDigits.length===10?'+1'+phoneDigits:phoneDigits.length>=11&&phoneDigits.length<=15?'+'+phoneDigits:'';
   if(phoneRaw&&!contact_phone)fail('Teléfono de contacto debe contener 10 a 15 dígitos.');
   if(public_contact_enabled&&!email&&!contact_phone)fail('Agrega un correo comercial o teléfono antes de publicar información de contacto.');
   const contact_email=email;
   const condition=exactStatus(body.condition,['used','remanufactured','new']);
   const year_min=positiveInt(body.year_min,1950,2100),year_max=positiveInt(body.year_max,1950,2100);
   if(year_min>year_max||title.length<5||description.length<15||!make||!model)fail('Completa correctamente los datos de compatibilidad y descripción.');
   const dollars=String(body.price).trim();if(!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(dollars))fail('Precio inválido.');
   const price_cents=Math.round(Number(dollars)*100);if(price_cents<1000||price_cents>10000000)fail('Precio permitido: $10 a $100,000.');
   const data={title,description,make,model,year_min,year_max,condition,part_number:str(body.part_number,100),image_url,price_cents,status:'pending',seller_has_item:true,original_photo_attested:true,inventory_verified_by_owner:false,verified_at:null,public_contact_enabled,contact_email,contact_phone,updated_at:new Date().toISOString()};
   if(body.id){
    const prev=unwrap(await d.from('listings').select('status').eq('id',body.id).eq('seller_id',u.id).single());
    if(!['pending','approved','rejected'].includes(prev.status))fail('No puedes modificar una pieza ya vendida o reservada.');
    unwrap(await d.from('listings').update(data).eq('id',body.id).eq('seller_id',u.id).in('status',['pending','approved','rejected']).select('id').single());
   }else{
    const r=unwrap(await d.from('listings').insert({...data,seller_id:u.id}).select('id').single());body.id=r.id;
   }
   await audit(d,u.id,'listing.submitted',body.id);return respond({ok:true,id:body.id});
  }
  if(action==='listing.withdraw'){
   const listing=unwrap(await d.from('listings').select('id,status').eq('id',body.id).eq('seller_id',u.id).single());
   if(['reserved','sold'].includes(listing.status))fail('No se puede retirar una pieza ya reservada o vendida.');
   const done=unwrap(await d.from('listings').update({status:'removed',inventory_verified_by_owner:false,verified_at:null,updated_at:new Date().toISOString()}).eq('id',listing.id).eq('seller_id',u.id).in('status',['pending','approved','rejected']).select('id').single());
   await audit(d,u.id,'listing.withdraw',done.id);
   return respond({ok:true});
  }
  if(action==='checkout'){
   if(!process.env.STRIPE_SECRET_KEY)fail('Stripe no está configurado.',503);
   const settings=unwrap(await d.from('site_settings').select('*').eq('id',1).single());
   if(!settings.payments_enabled||!checkoutReady())fail('Las compras están temporalmente desactivadas.',503);
   const part=unwrap(await d.from('listings').select('id,title,price_cents,seller_id,status,inventory_verified_by_owner').eq('id',body.listing_id).single());
   if(part.status!=='approved'||!part.inventory_verified_by_owner)fail('La pieza aún no ha sido verificada para compra.',503);
   const seller=unwrap(await d.from('sellers').select('status,stripe_account_id,commission_bps').eq('user_id',part.seller_id).single());
   const sellerProfile=unwrap(await d.from('profiles').select('is_banned').eq('id',part.seller_id).single());
   if(sellerProfile.is_banned)fail('Este vendedor está suspendido.');
   if(seller.status!=='approved'||(!isPlatformSeller(part.seller_id)&&!await sellerReady(s(),seller.stripe_account_id)))fail('Este vendedor aún no está habilitado para pagos.');
   const ownerSale=isPlatformSeller(part.seller_id);
   const feeBps=ownerSale?0:positiveInt(seller.commission_bps,0,3000);
   const orderId=unwrap(await d.rpc('reserve_one',{p_listing:part.id,p_buyer:u.id,p_fee_bps:feeBps}));
   const fee=Math.round(part.price_cents*feeBps/10000);
   let checkout;
   try{
    checkout=await s().checkout.sessions.create({
     mode:'payment',customer_email:u.email,
     client_reference_id:orderId,metadata:{order_id:orderId},
     line_items:[{price_data:{currency:'usd',unit_amount:part.price_cents,product_data:{name:part.title,description:'Pieza de vendedor independiente · Envío incluido en precio'}},quantity:1}],
     shipping_address_collection:{allowed_countries:['US']},
     billing_address_collection:'required',
     automatic_tax:{enabled:process.env.STRIPE_TAX_ENABLED==='true'},
     payment_intent_data:ownerSale?{metadata:{order_id:orderId,sale_type:'platform_inventory'}}:{application_fee_amount:fee,transfer_data:{destination:seller.stripe_account_id},metadata:{order_id:orderId}},
     success_url:`${SITE()}/#orders`,cancel_url:`${SITE()}/#part/${part.id}`,
     expires_at:Math.floor(Date.now()/1000)+1800
    },{idempotencyKey:`repartes_checkout_${orderId}`});
   }catch(e){await d.rpc('order_expire',{p_order:orderId});throw e;}
   const stored=await d.from('orders').update({stripe_session_id:checkout.id}).eq('id',orderId).eq('status','reserved').select('id').maybeSingle();
   if(stored.error||!stored.data){
    console.error('Checkout session could not be linked',orderId,stored.error?.message||'missing reserved order');
    let expired=false;
    try{const result=await s().checkout.sessions.expire(checkout.id);expired=result.status==='expired';}
    catch(err){console.error('Unable to expire orphaned checkout session',checkout.id,err.message);}
    if(expired){const released=await d.rpc('order_expire',{p_order:orderId});if(released.error)console.error('Unable to release orphaned reservation',orderId,released.error.message);}
    fail('No se pudo confirmar la reserva para el pago. Inténtalo de nuevo en unos minutos.',503);
   }
   return respond({url:checkout.url});
  }
  if(action==='order.ship'){
   const code=str(body.tracking_code,120);if(code.length<5)fail('Agrega un número de seguimiento válido.');
   const order=unwrap(await d.from('orders').select('id,status').eq('id',body.id).eq('seller_id',u.id).single());
   if(order.status!=='paid')fail('Solo puede enviarse un pedido cobrado.');
   unwrap(await d.from('orders').update({status:'shipped',tracking_code:code,shipped_at:new Date().toISOString()}).eq('id',order.id).eq('status','paid').select('id').single());
   await audit(d,u.id,'order.shipped',order.id,{tracking_code:code});return respond({ok:true});
  }
  if(action.startsWith('admin.')){
   if(u.id!==process.env.OWNER_USER_ID)fail('Acceso exclusivo del owner.',403);
   if(action==='admin.checkout-test.start'||action==='admin.checkout-test.refund')return respond(await handleCheckoutTest(action.split('.').at(-1),{database:d,client:s(),user:{...u,is_owner:true},site:SITE(),mode:checkoutMode(),key:process.env.STRIPE_SECRET_KEY}));
   if(action==='admin.quote.photos')return respond({uploads:await prepareQuotePhotos(body,d)});
   if(action==='admin.quote.add')return respond(await savePartQuote(body,d));
   if(action==='admin.quote.withdraw')return respond(await withdrawPartQuote(body,d));
   if(action==='admin.quote.status'){
    const status=exactStatus(body.status,['new','reviewing','closed']);
    unwrap(await d.from('part_requests').update({status}).eq('id',str(body.id,40)).select('id').single());
    await audit(d,u.id,'owner.quote.status',body.id,{status});return respond({ok:true});
   }
   if(action==='admin.ads'){
    const adsense_publisher_id=str(body.adsense_publisher_id,40);
    const adsense_enabled=body.adsense_enabled===true;
    if(adsense_publisher_id&&!/^ca-pub-[0-9]{16}$/.test(adsense_publisher_id))fail('Paste the complete AdSense publisher ID: ca-pub- followed by 16 digits.');
    if(adsense_enabled&&(!adsense_publisher_id||body.confirm_approved!==true||body.confirm_privacy!==true))fail('Enable ads only after AdSense says Ready and you have configured applicable consent and privacy notices.');
    unwrap(await d.from('site_settings').update({adsense_publisher_id,adsense_enabled,updated_at:new Date().toISOString()}).eq('id',1).select('id').single());
    await audit(d,u.id,'owner.adsense.config','adsense',{enabled:adsense_enabled,publisher_id_present:Boolean(adsense_publisher_id)});
    return respond({ok:true,enabled:adsense_enabled});
   }
   if(action==='admin.offer.add'||action==='admin.offer.update'){
    const kind=exactStatus(body.kind,['affiliate','sponsored']);
    const placement=exactStatus(body.placement,['home','part','map']);
    const title=str(body.title,100),description=str(body.description,260),raw=str(body.url,1500);
    if(title.length<4||description.length<15||raw.length<12||body.confirm_relationship!==true)fail('Fill all offer fields and confirm a real commercial relationship or approved affiliate link.');
    let target;try{target=new URL(raw);}catch{fail('Enter an HTTPS affiliate or sponsor URL.');}
    if(target.protocol!=='https:'||target.username||target.password||!target.hostname.includes('.')||target.hostname==='localhost'||target.hostname.endsWith('.local'))fail('Only public HTTPS commercial links are permitted.');
    const settings=unwrap(await d.from('site_settings').select('monetization_offers').eq('id',1).single());
    const existing=Array.isArray(settings.monetization_offers)?settings.monetization_offers:[];
    const editing=action==='admin.offer.update',id=editing?str(body.id,24):randomBytes(12).toString('hex');
    if(editing&&!/^[0-9a-f]{24}$/.test(id))fail('Invalid offer ID.');
    if(editing&&!existing.some(x=>x.id===id))fail('This offer no longer exists. Refresh the dashboard.',404);
    if(!editing&&existing.length>=12)fail('Maximum of 12 approved offers.');
    const offer={id,kind,placement,title,description,url:target.toString()};
    const offers=editing?existing.map(x=>x.id===id?offer:x):[...existing,offer];
    unwrap(await d.from('site_settings').update({monetization_offers:offers,updated_at:new Date().toISOString()}).eq('id',1).select('id').single());
    await audit(d,u.id,editing?'owner.offer.update':'owner.offer.add',offer.id,{kind,placement});
    return respond({ok:true,offer});
   }
   if(action==='admin.offer.remove'){
    const id=str(body.id,24);
    if(!/^[0-9a-f]{24}$/.test(id))fail('Invalid offer ID.');
    const settings=unwrap(await d.from('site_settings').select('monetization_offers').eq('id',1).single());
    const current=Array.isArray(settings.monetization_offers)?settings.monetization_offers:[];
    if(!current.some(x=>x.id===id))fail('This offer no longer exists.',404);
    unwrap(await d.from('site_settings').update({monetization_offers:current.filter(x=>x.id!==id),updated_at:new Date().toISOString()}).eq('id',1).select('id').single());
    await audit(d,u.id,'owner.offer.remove',id);
    return respond({ok:true});
   }
   if(action==='admin.socials'){
    const allowed={
     x:['x.com','twitter.com'],telegram:['t.me','telegram.me'],
     instagram:['instagram.com'],facebook:['facebook.com','fb.com'],
     tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be'],
     threads:['threads.net'],pinterest:['pinterest.com'],
     linkedin:['linkedin.com']
    };
    if(!body.links||typeof body.links!=='object'||Array.isArray(body.links))fail('Social links must be an object.');
    const links={};
    for(const [key,hosts] of Object.entries(allowed)){
     const raw=str(body.links[key],350).trim();
     if(!raw)continue;
     let url;try{url=new URL(raw);}catch{fail('Invalid social link for '+key);}
     const host=url.hostname.toLowerCase().replace(/^www\./,'');
     if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.includes(host))fail('Use an official HTTPS profile URL for '+key+'.');
     if(!url.pathname||url.pathname==='/')fail('Provide your specific profile, not the social network homepage: '+key);
     links[key]=url.toString();
    }
    unwrap(await d.from('site_settings').update({social_links:links,updated_at:new Date().toISOString()}).eq('id',1).select('id').single());
    await audit(d,u.id,'owner.socials','settings',{platforms:Object.keys(links)});
    return respond({ok:true,links});
   }
   if(action==='admin.review'){
    const status=exactStatus(body.status,['approved','rejected']);
    const review=unwrap(await d.from('market_reviews').select('id,reviewer_id,subject,listing_id,order_id,status').eq('id',body.id).single());
    if(review.status!=='pending')fail('Esta reseña ya fue revisada.');
    if(review.reviewer_id===u.id)fail('No puedes aprobar tus propias opiniones.');
    if(review.subject==='part'){
     const order=unwrap(await d.from('orders').select('status,buyer_id,listing_id').eq('id',review.order_id).single());
     if(!['paid','shipped'].includes(order.status)||order.buyer_id!==review.reviewer_id||order.listing_id!==review.listing_id)fail('La compra ya no respalda esta reseña.');
    }
    unwrap(await d.from('market_reviews').update({status,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',review.id).eq('status','pending').select('id').single());
    await audit(d,u.id,'owner.review',review.id,{status});
    return respond({ok:true});
   }
   if(action==='admin.delivery'){
    const delivered_at=str(body.delivered_at,10),day=daysAfter(delivered_at);
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(delivered_at)||!Number.isInteger(day)||day<0)fail('Fecha de entrega inválida o futura.');
    const order=unwrap(await d.from('orders').select('id,status,shipped_at,tracking_code').eq('id',body.id).single());
    if(order.status!=='shipped'||!order.tracking_code)fail('Verifica primero que exista un envío real con seguimiento.');
    if(delivered_at < String(order.shipped_at||'').slice(0,10))fail('La entrega no puede anteceder al envío.');
    unwrap(await d.from('orders').update({delivered_at}).eq('id',order.id).eq('status','shipped').select('id').single());
    await audit(d,u.id,'owner.delivery',order.id,{delivered_at,verified_by_owner:true});
    return respond({ok:true});
   }
   if(action==='admin.return'){
    const status=exactStatus(body.status,['approved','rejected','received']);
    const item=unwrap(await d.from('return_requests').select('id,order_id,status,authorized_at').eq('id',body.id).single());
    if(['approved','rejected'].includes(status)&&item.status!=='requested')fail('La solicitud ya fue revisada.');
    if(status==='received'&&!['approved','in_transit'].includes(item.status))fail('Esta devolución todavía no puede marcarse como recibida.');
    if(status==='approved'){
     const order=unwrap(await d.from('orders').select('delivered_at').eq('id',item.order_id).single());
     if(!order.delivered_at)fail('No se confirmó la entrega.');
    }
    const changes={status,admin_note:str(body.note,1000)};
    if(status==='approved')changes.authorized_at=new Date().toISOString();
    if(status==='received')changes.received_at=new Date().toISOString();
    unwrap(await d.from('return_requests').update(changes).eq('id',item.id).eq('status',item.status).select('id').single());
    await audit(d,u.id,'owner.return',item.id,{status});
    return respond({ok:true});
   }
   if(action==='admin.commission'){
    if(isPlatformSeller(body.id))fail('The Owner store has no internal commission.');
    const commission_bps=positiveInt(body.commission_bps,0,3000);
    const previous=unwrap(await d.from('sellers').select('commission_bps').eq('user_id',body.id).single());
    unwrap(await d.from('sellers').update({commission_bps}).eq('user_id',body.id).select('user_id').single());
    await audit(d,u.id,'owner.seller.commission',body.id,{old_bps:previous.commission_bps,new_bps:commission_bps});
    return respond({ok:true,commission_bps});
   }
   if(action==='admin.seller'){
    if(isPlatformSeller(body.id))fail('No se puede suspender o cambiar la tienda del Owner desde este panel.');
    const status=exactStatus(body.status,['pending','approved','suspended']);
    unwrap(await d.from('sellers').update({status}).eq('user_id',body.id));
    await audit(d,u.id,'owner.seller',body.id,{status});return respond({ok:true});
   }
   if(action==='admin.listing'){
    const status=exactStatus(body.status,['approved','rejected','removed']);
    const listing=unwrap(await d.from('listings').select('status,seller_id,image_url,seller_has_item,original_photo_attested').eq('id',body.id).single());
    if(['sold','reserved'].includes(listing.status))fail('No se puede alterar una venta o reserva activa.');
    if(status==='approved'){
     if(body.verified_real_inventory!==true||!listing.seller_has_item||!listing.original_photo_attested||!genuineSellerPhoto(listing.image_url,listing.seller_id,process.env.SUPABASE_URL))fail('Verifica físicamente disponibilidad, fotografía original y datos del artículo antes de aprobar.');
     const seller=unwrap(await d.from('sellers').select('status,stripe_account_id').eq('user_id',listing.seller_id).single());
     if(seller.status!=='approved')fail('Aprueba primero al vendedor.');
     if(!isPlatformSeller(listing.seller_id)&&(!process.env.STRIPE_SECRET_KEY||!await sellerReady(s(),seller.stripe_account_id)))fail('El vendedor debe completar Stripe Connect.');
    }
    unwrap(await d.from('listings').update({status,inventory_verified_by_owner:status==='approved',verified_at:status==='approved'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',body.id).in('status',['pending','approved','rejected','removed']).select('id').single());
    await audit(d,u.id,'owner.listing',body.id,{status});return respond({ok:true});
   }
   if(action==='admin.settings'){
    const hero_title=str(body.hero_title,140),hero_subtitle=str(body.hero_subtitle,320),announcement=str(body.announcement,160);
    const commission_bps=positiveInt(body.commission_bps,500,3000),support_email=str(body.support_email,150);
    const payments_enabled=body.payments_enabled===true;
    if(payments_enabled&&(!checkoutReady()||!process.env.STRIPE_WEBHOOK_SECRET))fail('Configura el modo de cobro correcto y el webhook firmado antes de activar pagos.');
    if(payments_enabled&&checkoutMode()==='live'){
     const passed=unwrap(await d.from('checkout_tests').select('id').eq('status','refunded').not('paid_webhook_at','is',null).not('refund_webhook_at','is',null).limit(1));
     if(!passed.length)fail('Complete the private test purchase and refund, including both verified webhooks, before enabling live customer payments.');
    }
    if(payments_enabled){const r=unwrap(await d.from('listings').select('id').eq('status','approved').eq('inventory_verified_by_owner',true).limit(1));if(!r.length)fail('Primero aprueba un producto real con foto original y vendedor con Stripe verificado.');}
    if(payments_enabled&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support_email))fail('Agrega un correo de soporte válido antes de activar pagos.');
    if(!hero_title||!hero_subtitle)fail('Completa los textos principales.');
    unwrap(await d.from('site_settings').update({hero_title,hero_subtitle,announcement,commission_bps,payments_enabled,support_email,updated_at:new Date().toISOString()}).eq('id',1));
    await audit(d,u.id,'owner.settings','home',{commission_bps,payments_enabled});return respond({ok:true});
   }
   if(action==='admin.ban'){
    if(body.id===u.id)fail('No puedes suspender tu cuenta owner.');
    unwrap(await d.from('profiles').update({is_banned:body.is_banned===true}).eq('id',body.id));
    await audit(d,u.id,'owner.ban',body.id,{banned:body.is_banned===true});return respond({ok:true});
   }
   if(action==='admin.refund'){
    const order=unwrap(await d.from('orders').select('*').eq('id',body.id).single());
    if(!['paid','shipped'].includes(order.status)||!order.stripe_payment_intent_id)fail('Pedido no elegible para reembolso.');
    const existingReturn=unwrap(await d.from('return_requests').select('id,status').eq('order_id',order.id).maybeSingle());
    if(existingReturn&&existingReturn.status!=='received')fail('Primero confirma la recepción de la devolución.');
    const ownerSale=isPlatformSeller(order.seller_id);
    const refund=await s().refunds.create({payment_intent:order.stripe_payment_intent_id,...(ownerSale?{}:{reverse_transfer:true,refund_application_fee:true}),reason:'requested_by_customer'},{idempotencyKey:`refund_full_${order.id}`});
    if(refund.status==='succeeded'){
     unwrap(await d.rpc('order_refunded',{p_order:order.id}));
     if(existingReturn)unwrap(await d.from('return_requests').update({status:'refunded'}).eq('id',existingReturn.id).eq('status','received').select('id').single());
    }
    await audit(d,u.id,'owner.refund',order.id,{amount_cents:order.amount_cents,stripe_refund_id:refund.id,status:refund.status});return respond({ok:true,refund_status:refund.status});
   }
  }
  fail('Acción desconocida.',404);
 }catch(e){console.error('market error',e);return asError(e);}
}
