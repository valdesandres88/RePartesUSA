import {checkoutCredentialsCompatible} from '../functions/payment-guards.mjs';
const unwrap=r=>{if(r.error)throw r.error;return r.data;};
const fail=message=>{const e=Error(message);e.status=400;throw e;};
export function testSessionMatches(session,test){
 return Boolean(session&&test&&session.livemode===false&&session.id===test.stripe_session_id&&session.metadata?.checkout_test_id===test.id&&session.currency==='usd'&&session.amount_subtotal===test.amount_cents);
}
export async function handleCheckoutTest(action,{database:d,client:s,user,site,mode,key}){
 if(!user.is_owner){const e=Error('Owner access required');e.status=403;throw e;}
 if(mode!=='test'||!checkoutCredentialsCompatible('test',key))fail('Switch the server to test mode with a test key before using the private test.');
 let record=unwrap(await d.from('checkout_tests').select('*').eq('creator_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle());
 if(action==='start'){
  if(record?.status==='paid'||record?.status==='refund_pending')fail('Refund the previous test payment first.');
  if(!record||['expired','refunded'].includes(record.status))record=unwrap(await d.from('checkout_tests').insert({creator_id:user.id}).select('*').single());
  if(record.stripe_session_id){
   const existing=await s.checkout.sessions.retrieve(record.stripe_session_id);
   if(!testSessionMatches(existing,record))fail('Test session mismatch.');
   if(existing.status==='open'&&existing.url)return {url:existing.url};
   fail('Refresh the test results before starting another checkout.');
  }
  const session=await s.checkout.sessions.create({mode:'payment',customer_email:user.email,client_reference_id:record.id,metadata:{checkout_test_id:record.id},line_items:[{price_data:{currency:'usd',unit_amount:record.amount_cents,product_data:{name:'RePartes USA — private checkout TEST',description:'Test transaction only. No physical item will be shipped.'}},quantity:1}],billing_address_collection:'required',shipping_address_collection:{allowed_countries:['US']},success_url:`${site}/#owner`,cancel_url:`${site}/#owner`,expires_at:Math.floor(Date.now()/1000)+1800,payment_intent_data:{metadata:{checkout_test_id:record.id}}},{idempotencyKey:`owner_test_${record.id}`});
  if(session.livemode!==false)fail('A test checkout cannot use live payments.');
  const saved=await d.from('checkout_tests').update({stripe_session_id:session.id,status:'open'}).eq('id',record.id).eq('status','created').select('id').maybeSingle();
  if(saved.error||!saved.data){await s.checkout.sessions.expire(session.id);fail('Unable to save the test session. Retry.');}
  return {url:session.url};
 }
 if(action==='refund'){
  if(!record?.stripe_session_id||!record.paid_webhook_at||!record.stripe_payment_intent_id)fail('Complete the test checkout and wait for the paid webhook first.');
  if(record.status==='refunded')return {ok:true,status:'refunded'};
  const session=await s.checkout.sessions.retrieve(record.stripe_session_id);
  if(!testSessionMatches(session,record)||session.payment_status!=='paid'||session.payment_intent!==record.stripe_payment_intent_id)fail('Paid test session mismatch.');
  const refund=await s.refunds.create({payment_intent:record.stripe_payment_intent_id,amount:record.amount_cents},{idempotencyKey:`owner_test_refund_${record.id}`});
  if(refund.payment_intent!==record.stripe_payment_intent_id||refund.amount!==record.amount_cents)fail('Test refund mismatch.');
  unwrap(await d.from('checkout_tests').update({stripe_refund_id:refund.id,status:refund.status==='succeeded'?'refunded':'refund_pending'}).eq('id',record.id));
  return {ok:true,status:refund.status};
 }
 fail('Unknown test action.');
}
export async function processCheckoutTestEvent(event,d){
 const obj=event.data.object,id=obj.metadata?.checkout_test_id;
 if(event.livemode!==false)throw Error('Checkout tests reject live events');
 if(event.type.startsWith('checkout.session.')&&id){
  const record=unwrap(await d.from('checkout_tests').select('*').eq('id',id).single());
  if(!testSessionMatches(obj,record))throw Error('Test webhook session mismatch');
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&obj.payment_status==='paid'){
   if(typeof obj.payment_intent!=='string'||!obj.payment_intent.startsWith('pi_'))throw Error('Missing test payment intent');
   unwrap(await d.from('checkout_tests').update({status:'paid',stripe_payment_intent_id:obj.payment_intent,paid_webhook_at:new Date().toISOString()}).eq('id',record.id).in('status',['open','created']));
  }else if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type))unwrap(await d.from('checkout_tests').update({status:'expired'}).eq('id',record.id).in('status',['open','created']));
  return true;
 }
 if(event.type==='charge.refunded'&&obj.payment_intent){
  const record=unwrap(await d.from('checkout_tests').select('*').eq('stripe_payment_intent_id',obj.payment_intent).maybeSingle());
  if(!record)return false;
  if(obj.currency!=='usd'||obj.amount!==record.amount_cents||obj.amount_refunded!==record.amount_cents)throw Error('Test refund webhook mismatch');
  unwrap(await d.from('checkout_tests').update({status:'refunded',refund_webhook_at:new Date().toISOString()}).eq('id',record.id));return true;
 }
 return false;
}
