import {db,stripe,respond,unwrap} from './shared.mjs';
import {paidSessionMatchesOrder,stripeModeMatches,sessionMatchesOrder} from './payment-guards.mjs';
import {processCheckoutTestEvent} from '../lib/checkout-tests.mjs';
export async function handler(event){
 if(event.httpMethod!=='POST')return respond({error:'Método no permitido'},405);
 if(!process.env.STRIPE_WEBHOOK_SECRET)return respond({error:'Webhook sin configurar'},503);
 let incoming;
 try{
  const body=event.isBase64Encoded?Buffer.from(event.body,'base64'):event.body;
  incoming=stripe().webhooks.constructEvent(body,event.headers['stripe-signature']||event.headers['Stripe-Signature'],process.env.STRIPE_WEBHOOK_SECRET);
 }catch(e){console.error('Invalid webhook signature:',e.message);return respond({error:'Firma Stripe incorrecta'},400);}
 try{
  if(!stripeModeMatches(process.env.CHECKOUT_MODE,incoming.livemode))return respond({error:'Stripe environment mismatch'},400);
  const d=db(),obj=incoming.data.object;
  if(incoming.livemode===false&&await processCheckoutTestEvent(incoming,d))return respond({received:true,test:true});
  if(incoming.livemode && ['charge.refunded','application_fee.refunded','charge.dispute.created','charge.dispute.closed'].includes(incoming.type)){
   let intent=obj.payment_intent,kind='refund',fee=0,full=false,dispute=null;
   if(incoming.type==='charge.refunded'){
    full=obj.amount_refunded===obj.amount;
    if(!full && obj.application_fee)fee=(await stripe().applicationFees.retrieve(obj.application_fee)).amount_refunded;
   }else if(incoming.type==='application_fee.refunded'){
    intent=(await stripe().charges.retrieve(obj.charge)).payment_intent;
    fee=obj.amount_refunded;
   }else{
    dispute=obj.id;
    kind=incoming.type==='charge.dispute.created'?'dispute_open':(obj.status==='won'?'dispute_won':'dispute_lost');
   }
   if(intent)unwrap(await d.from('referral_payment_events').upsert({event_id:incoming.id,intent,kind,refunded_fee:fee,full_refund:full,dispute_id:dispute},{onConflict:'event_id',ignoreDuplicates:true}));
  }
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(incoming.type)){
   if(obj.payment_status!=='paid')return respond({received:true});
   const id=obj.metadata?.order_id||obj.client_reference_id;
   if(!id)throw Error('Webhook missing order id');
   const order=unwrap(await d.from('orders').select('id,amount_cents,stripe_session_id').eq('id',id).single());
   if(!paidSessionMatchesOrder(obj,order))throw Error('Paid session does not match order');
   const shipping=obj.collected_information?.shipping_details||obj.shipping_details||null;
   unwrap(await d.rpc('order_paid',{p_order:id,p_session:obj.id,p_intent:String(obj.payment_intent||''),p_shipping:shipping}));
  }else if(incoming.type==='checkout.session.expired'||incoming.type==='checkout.session.async_payment_failed'){
   const id=obj.metadata?.order_id||obj.client_reference_id;
   if(id){
    const order=unwrap(await d.from('orders').select('id,stripe_session_id').eq('id',id).maybeSingle());
    if(!sessionMatchesOrder(obj,order))throw Error('Expired session does not match order');
    unwrap(await d.rpc('order_expire',{p_order:id}));
   }
  }else if(incoming.type==='charge.refunded'){
   if(obj.amount_refunded===obj.amount&&obj.payment_intent){
    const order=unwrap(await d.from('orders').select('id').eq('stripe_payment_intent_id',obj.payment_intent).maybeSingle());
    if(order)unwrap(await d.rpc('order_refunded',{p_order:order.id}));
   }
  }else if(incoming.type==='charge.dispute.created'){
   const order=unwrap(await d.from('orders').select('id').eq('stripe_payment_intent_id',obj.payment_intent).maybeSingle());
   unwrap(await d.from('audit_log').insert({action:'payment.dispute',target_id:String(order?.id||obj.id),details:{stripe_dispute_id:obj.id}}));
  }
  return respond({received:true});
 }catch(e){console.error('Webhook processing failed',e);return respond({error:'Webhook processing failed'},500);}
}
