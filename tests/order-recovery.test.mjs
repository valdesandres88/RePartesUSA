import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverReservations} from '../netlify/lib/order-recovery.mjs';
const order={id:'order1',amount_cents:1000,stripe_session_id:'cs_test_1'};
const session={id:'cs_test_1',livemode:false,metadata:{order_id:'order1'},currency:'usd',amount_subtotal:1000,payment_intent:'pi_test1',payment_status:'paid',status:'complete'};
async function run({orders=[order],sessions=[session],now=()=>1800000000000,rpcError=false}={}){
 const writes=[],query=[];
 const database={from(){const q={select(){return q},eq(k,v){query.push([k,v]);return q},lt(){return q},order(){return q},limit(v){query.push(v);return Promise.resolve({data:orders,error:null})}};return q},async rpc(name,args){writes.push({name,args});return {error:rpcError?Error('write failed'):null}}};
 let reads=0;const client={checkout:{sessions:{async retrieve(){const s=sessions[reads++];if(s instanceof Error)throw s;return s}}}};
 const result=await recoverReservations({database,client,mode:'test',now,log:{error(){}}});return {result,writes,reads,query};
}
test('Recovery reconciles matching paid checkout and preserves shipping',async()=>{
 const shipping={name:'Test buyer'};const {result,writes,query}=await run({sessions:[{...session,collected_information:{shipping_details:shipping}}]});
 assert.equal(result.recovered_paid,1);assert.equal(writes[0].name,'order_paid');assert.deepEqual(writes[0].args.p_shipping,shipping);assert.ok(query.includes(20));
});
test('Only orphaned or Stripe-expired reservations are released',async()=>{
 for(const setup of [{orders:[{...order,stripe_session_id:null}]},{sessions:[{...session,payment_status:'unpaid',status:'expired'}]}]){const {result,writes}=await run(setup);assert.equal(result.expired,1);assert.equal(writes[0].name,'order_expire');}
});
test('Pending asynchronous payments and open checkout keep inventory reserved',async()=>{
 for(const status of ['open','complete']){const {writes,result}=await run({sessions:[{...session,payment_status:'unpaid',status}]});assert.equal(writes.length,0);assert.equal(result.skipped,1);}
});
test('Opposite mode, foreign sessions, wrong order and wrong paid amounts cannot change inventory',async()=>{
 for(const patch of [{livemode:true},{id:'cs_foreign'},{metadata:{order_id:'foreign'}},{amount_subtotal:1}]){const {writes,result}=await run({sessions:[{...session,...patch}]});assert.equal(writes.length,0);assert.equal(result.skipped,1);}
});
test('Stripe or database failures are not reported successful',async()=>{
 assert.equal((await run({sessions:[Error('Stripe unavailable')]})).result.skipped,1);assert.equal((await run({rpcError:true})).result.recovered_paid,0);
});
test('Recovery stops at its time budget and reports deferred work',async()=>{
 let ticks=0;const {writes,result}=await run({orders:[order,order],now:()=>1800000000000+(ticks++?21000:0)});assert.equal(writes.length,0);assert.equal(result.deferred,2);
});
