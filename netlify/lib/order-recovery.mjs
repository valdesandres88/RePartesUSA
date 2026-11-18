import {paidSessionMatchesOrder,stripeModeMatches,sessionMatchesOrder} from '../functions/payment-guards.mjs';

const value=result=>{if(result.error)throw result.error;return result.data;};
export async function recoverReservations({database,client,mode,now=Date.now,log=console}){
 const started=now();
 const stale=value(await database.from('orders').select('id,amount_cents,stripe_session_id').eq('status','reserved').lt('created_at',new Date(started-35*60*1000).toISOString()).order('created_at').limit(20));
 let expired=0,paid=0,skipped=0,scanned=0;
 for(const order of stale){
  if(now()-started>=20000)break;
  scanned++;
  try{
   if(!order.stripe_session_id){value(await database.rpc('order_expire',{p_order:order.id}));expired++;continue;}
   const session=await client.checkout.sessions.retrieve(order.stripe_session_id);
   if(!stripeModeMatches(mode,session.livemode)||!sessionMatchesOrder(session,order))throw Error('Session environment or order mismatch');
   if(session.payment_status==='paid'){
    if(!paidSessionMatchesOrder(session,order))throw Error('Paid session does not match order');
    value(await database.rpc('order_paid',{p_order:order.id,p_session:session.id,p_intent:session.payment_intent,p_shipping:session.collected_information?.shipping_details||session.shipping_details||null}));paid++;
   }else if(session.status==='expired'){
    value(await database.rpc('order_expire',{p_order:order.id}));expired++;
   }else skipped++;
  }catch(error){skipped++;log.error('Reservation recovery skipped order',order.id,error.message);}
 }
 return {ok:true,scanned,expired,recovered_paid:paid,skipped,deferred:stale.length-scanned};
}
