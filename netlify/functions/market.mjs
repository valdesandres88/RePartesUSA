import {db,stripe,respond,fail,unwrap,auth,checkOrigin,str,positiveInt,exactStatus,validImage,asError} from './shared.mjs';
import {checkoutCredentialsCompatible} from './payment-guards.mjs';
const SITE=()=>process.env.SITE_URL?.replace(/\/$/,'')||'http://localhost:8888';
const checkoutMode=()=>process.env.CHECKOUT_MODE||'disabled';
const checkoutReady=()=>checkoutCredentialsCompatible(checkoutMode(),process.env.STRIPE_SECRET_KEY||'');
const audit=async(d,actor,action,target,details={})=>{const {error}=await d.from('audit_log').insert({actor_id:actor,action,target_id:String(target||''),details});if(error)throw error;};
const sellerReady=async(s,accountId)=>{if(!accountId)return false;const a=await s.accounts.retrieve(accountId);return Boolean(a.payouts_enabled&&a.capabilities?.transfers==='active');};
export async function handler(event){
 try{
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_URL)fail('Falta configuración privada de Supabase.',503);
  const d=db(),method=event.httpMethod,action=new URLSearchParams(event.queryStringParameters||{}).get('action')||'site';
  let body={};if(method==='POST'){checkOrigin(event);try{body=JSON.parse(event.body||'{}');}catch{fail('JSON inválido.');}}
  if(method==='GET'&&action==='site'){
   const [settings,items]=await Promise.all([
    d.from('site_settings').select('hero_title,hero_subtitle,announcement,commission_bps,payments_enabled,support_email').eq('id',1).single(),
    d.from('listings').select('id,seller_id,title,description,make,model,year_min,year_max,part_number,condition,price_cents,image_url,created_at').eq('status','approved').order('created_at',{ascending:false}).limit(100)
   ]);
   const conf=unwrap(settings),listings=unwrap(items),ids=[...new Set(listings.map(x=>x.seller_id))];
   const sellers=ids.length?unwrap(await d.from('sellers').select('user_id,shop_name,status').in('user_id',ids)):[];
   const flags=ids.length?unwrap(await d.from('profiles').select('id,is_banned').in('id',ids)):[];
   const active=new Set(flags.filter(x=>!x.is_banned).map(x=>x.id));
   const lookup=new Map(sellers.filter(x=>x.status==='approved'&&active.has(x.user_id)).map(x=>[x.user_id,x.shop_name]));
   return respond({settings:conf,listings:listings.filter(x=>lookup.has(x.seller_id)).map(x=>({...x,shop_name:lookup.get(x.seller_id)}))});
  }
  if(method==='GET'&&action==='me'){
   const u=await auth(event,d),seller=unwrap(await d.from('sellers').select('*').eq('user_id',u.id).maybeSingle());
   let account_ready=false;
   if(seller?.stripe_account_id&&process.env.STRIPE_SECRET_KEY){try{account_ready=await sellerReady(stripe(),seller.stripe_account_id);}catch{}}
   return respond({id:u.id,email:u.email,is_owner:u.id===process.env.OWNER_USER_ID,seller:seller&&{shop_name:seller.shop_name,status:seller.status,account_ready}});
  }
  if(method==='GET'&&action==='mine'){
   const u=await auth(event,d),[listings,buying,selling]=await Promise.all([
    d.from('listings').select('*').eq('seller_id',u.id).order('created_at',{ascending:false}).limit(200),
    d.from('orders').select('*,listings(title)').eq('buyer_id',u.id).order('created_at',{ascending:false}).limit(100),
    d.from('orders').select('*,listings(title)').eq('seller_id',u.id).order('created_at',{ascending:false}).limit(100)
   ]);
   return respond({listings:unwrap(listings),purchases:unwrap(buying),sales:unwrap(selling)});
  }
  if(method==='GET'&&action==='dashboard'){
   await auth(event,d,{owner:true});
   const [metrics,listings,sellers,orders,users,settings,audits]=await Promise.all([
    d.rpc('owner_metrics'),d.from('listings').select('*,sellers(shop_name)').order('created_at',{ascending:false}).limit(200),
    d.from('sellers').select('user_id,shop_name,status,stripe_account_id,created_at').order('created_at',{ascending:false}).limit(200),
    d.from('orders').select('*,listings(title)').order('created_at',{ascending:false}).limit(150),
    d.from('profiles').select('id,display_name,is_banned,created_at').order('created_at',{ascending:false}).limit(150),
    d.from('site_settings').select('*').eq('id',1).single(),
    d.from('audit_log').select('*').order('created_at',{ascending:false}).limit(50)
   ]);
   return respond({metrics:unwrap(metrics),listings:unwrap(listings),sellers:unwrap(sellers).map(({stripe_account_id,...s})=>({...s,connect_configured:Boolean(stripe_account_id)})),orders:unwrap(orders),users:unwrap(users),settings:unwrap(settings),audit:unwrap(audits)});
  }
  if(method!=='POST')fail('Método no permitido.',405);
  const u=await auth(event,d),s=stripe;
  if(action==='seller.apply'){
   const name=str(body.shop_name,100);if(name.length<2)fail('Nombre de tienda demasiado corto.');
   const existing=unwrap(await d.from('sellers').select('user_id,status').eq('user_id',u.id).maybeSingle());
   if(existing)fail('Ya existe una solicitud de vendedor.');
   unwrap(await d.from('sellers').insert({user_id:u.id,shop_name:name}));
   await audit(d,u.id,'seller.apply',u.id,{shop_name:name});return respond({ok:true});
  }
  if(action==='seller.connect'){
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
   const condition=exactStatus(body.condition,['used','remanufactured','new']);
   const year_min=positiveInt(body.year_min,1950,2100),year_max=positiveInt(body.year_max,1950,2100);
   if(year_min>year_max||title.length<5||description.length<15||!make||!model)fail('Completa correctamente los datos de compatibilidad y descripción.');
   const dollars=String(body.price).trim();if(!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(dollars))fail('Precio inválido.');
   const price_cents=Math.round(Number(dollars)*100);if(price_cents<1000||price_cents>10000000)fail('Precio permitido: $10 a $100,000.');
   const data={title,description,make,model,year_min,year_max,condition,part_number:str(body.part_number,100),image_url:validImage(str(body.image_url,900)),price_cents,status:'pending',updated_at:new Date().toISOString()};
   if(body.id){
    const prev=unwrap(await d.from('listings').select('status').eq('id',body.id).eq('seller_id',u.id).single());
    if(!['pending','approved','rejected'].includes(prev.status))fail('No puedes modificar una pieza ya vendida o reservada.');
    unwrap(await d.from('listings').update(data).eq('id',body.id).eq('seller_id',u.id).in('status',['pending','approved','rejected']).select('id').single());
   }else{
    const r=unwrap(await d.from('listings').insert({...data,seller_id:u.id}).select('id').single());body.id=r.id;
   }
   await audit(d,u.id,'listing.submitted',body.id);return respond({ok:true,id:body.id});
  }
  if(action==='checkout'){
   if(!process.env.STRIPE_SECRET_KEY)fail('Stripe no está configurado.',503);
   const settings=unwrap(await d.from('site_settings').select('*').eq('id',1).single());
   if(!settings.payments_enabled||!checkoutReady())fail('Las compras están temporalmente desactivadas.',503);
   const part=unwrap(await d.from('listings').select('id,title,price_cents,seller_id,status').eq('id',body.listing_id).single());
   const seller=unwrap(await d.from('sellers').select('status,stripe_account_id').eq('user_id',part.seller_id).single());
   const sellerProfile=unwrap(await d.from('profiles').select('is_banned').eq('id',part.seller_id).single());
   if(sellerProfile.is_banned)fail('Este vendedor está suspendido.');
   if(seller.status!=='approved'||!await sellerReady(s(),seller.stripe_account_id))fail('Este vendedor aún no está habilitado para pagos.');
   const orderId=unwrap(await d.rpc('reserve_one',{p_listing:part.id,p_buyer:u.id,p_fee_bps:settings.commission_bps}));
   const fee=Math.round(part.price_cents*settings.commission_bps/10000);
   let checkout;
   try{
    checkout=await s().checkout.sessions.create({
     mode:'payment',payment_method_types:['card'],customer_email:u.email,
     client_reference_id:orderId,metadata:{order_id:orderId},
     line_items:[{price_data:{currency:'usd',unit_amount:part.price_cents,product_data:{name:part.title,description:'Pieza de vendedor independiente · Envío incluido en precio'}},quantity:1}],
     shipping_address_collection:{allowed_countries:['US']},
     billing_address_collection:'required',
     automatic_tax:{enabled:process.env.STRIPE_TAX_ENABLED==='true'},
     payment_intent_data:{application_fee_amount:fee,transfer_data:{destination:seller.stripe_account_id},metadata:{order_id:orderId}},
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
   if(action==='admin.seller'){
    const status=exactStatus(body.status,['pending','approved','suspended']);
    unwrap(await d.from('sellers').update({status}).eq('user_id',body.id));
    await audit(d,u.id,'owner.seller',body.id,{status});return respond({ok:true});
   }
   if(action==='admin.listing'){
    const status=exactStatus(body.status,['approved','rejected','removed']);
    const listing=unwrap(await d.from('listings').select('status,seller_id').eq('id',body.id).single());
    if(['sold','reserved'].includes(listing.status))fail('No se puede alterar una venta o reserva activa.');
    if(status==='approved'){
     const seller=unwrap(await d.from('sellers').select('status,stripe_account_id').eq('user_id',listing.seller_id).single());
     if(seller.status!=='approved')fail('Aprueba primero al vendedor.');
     if(!process.env.STRIPE_SECRET_KEY||!await sellerReady(s(),seller.stripe_account_id))fail('El vendedor debe completar Stripe Connect.');
    }
    unwrap(await d.from('listings').update({status,updated_at:new Date().toISOString()}).eq('id',body.id).in('status',['pending','approved','rejected','removed']).select('id').single());
    await audit(d,u.id,'owner.listing',body.id,{status});return respond({ok:true});
   }
   if(action==='admin.settings'){
    const hero_title=str(body.hero_title,140),hero_subtitle=str(body.hero_subtitle,320),announcement=str(body.announcement,160);
    const commission_bps=positiveInt(body.commission_bps,500,3000),support_email=str(body.support_email,150);
    const payments_enabled=body.payments_enabled===true;
    if(payments_enabled&&(!checkoutReady()||!process.env.STRIPE_WEBHOOK_SECRET))fail('Configura el modo de cobro correcto y el webhook firmado antes de activar pagos.');
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
    const refund=await s().refunds.create({payment_intent:order.stripe_payment_intent_id,reverse_transfer:true,refund_application_fee:true,reason:'requested_by_customer'},{idempotencyKey:`refund_full_${order.id}`});
    if(refund.status==='succeeded')unwrap(await d.rpc('order_refunded',{p_order:order.id}));
    await audit(d,u.id,'owner.refund',order.id,{amount_cents:order.amount_cents,stripe_refund_id:refund.id,status:refund.status});return respond({ok:true,refund_status:refund.status});
   }
  }
  fail('Acción desconocida.',404);
 }catch(e){console.error('market error',e);return asError(e);}
}
