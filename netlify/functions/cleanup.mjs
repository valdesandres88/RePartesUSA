import {db,stripe,respond,unwrap} from './shared.mjs';
import {paidSessionMatchesOrder} from './payment-guards.mjs';
export async function handler(event){
 if(event.httpMethod!=='POST')return respond({error:'Método no permitido'},405);
 const expected=process.env.CRON_SECRET;
 if(!expected||event.headers.authorization!==`Bearer ${expected}`)return respond({error:'No autorizado'},403);
 const d=db();const until=new Date(Date.now()-35*60*1000).toISOString();
 const stale=unwrap(await d.from('orders').select('id,amount_cents,stripe_session_id').eq('status','reserved').lt('created_at',until).order('created_at').limit(80));
 let expired=0,paid=0,skipped=0;
 for(const o of stale){
  try{
   if(!o.stripe_session_id){unwrap(await d.rpc('order_expire',{p_order:o.id}));expired++;continue;}
   const ss=await stripe().checkout.sessions.retrieve(o.stripe_session_id);
   if(ss.payment_status==='paid'){
    if(!paidSessionMatchesOrder(ss,o))throw Error('Mismatched paid session');
    unwrap(await d.rpc('order_paid',{p_order:o.id,p_session:ss.id,p_intent:String(ss.payment_intent||''),p_shipping:ss.collected_information?.shipping_details||ss.shipping_details||null}));paid++;
   }else if(ss.status==='expired'){unwrap(await d.rpc('order_expire',{p_order:o.id}));expired++;}
   else skipped++;
  }catch(e){skipped++;console.error('Cleanup skipped order',o.id,e.message);}
 }
 return respond({ok:true,scanned:stale.length,expired,recovered_paid:paid,skipped});
}
