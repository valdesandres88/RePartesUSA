import test from 'node:test';import assert from 'node:assert/strict';
import {handleCheckoutTest,processCheckoutTestEvent,testSessionMatches} from '../netlify/lib/checkout-tests.mjs';
const row=()=>({id:'test1',creator_id:'owner',amount_cents:1000,status:'open',stripe_session_id:'cs_test_1'});
const session=()=>({id:'cs_test_1',livemode:false,metadata:{checkout_test_id:'test1'},currency:'usd',amount_subtotal:1000,payment_status:'paid',payment_intent:'pi_test1',status:'complete'});
function database(record){
 const writes=[];const d={from(name){assert.equal(name,'checkout_tests');let predicates=[],patch,insert=false;const q={select(){return q},eq(k,v){predicates.push(r=>r[k]===v);return q},in(k,v){predicates.push(r=>v.includes(r[k]));return q},order(){return q},limit(){return q},insert(v){insert=true;patch=v;return q},update(v){patch=v;return q},single(){return finish()},maybeSingle(){return finish()},then(resolve,reject){return finish().then(resolve,reject)}};
 async function finish(){if(insert)record={id:'test1',amount_cents:1000,status:'created',...patch};const found=record&&predicates.every(p=>p(record));if(patch&&found&&!insert){writes.push(patch);Object.assign(record,patch)}return {data:found?record:null,error:null}};return q}};return {d,writes,getRecord:()=>record};
}
const options=d=>({database:d,client:{},user:{id:'owner',is_owner:true,email:'test@example.com'},site:'https://example.com',mode:'test',key:'rk_test_123'});
test('Private test rejects non-owners and any live or disabled environment',async()=>{
 for(const patch of [{user:{id:'other',is_owner:false}},{mode:'live',key:'rk_live_123'},{mode:'disabled'},{key:'sk_live_123'}])await assert.rejects(handleCheckoutTest('start',{...options(database(null).d),...patch}));
});
test('Test session binding requires exact session, amount, currency, metadata and test mode',()=>{
 assert.equal(testSessionMatches(session(),row()),true);
 for(const patch of [{id:'cs_foreign'},{livemode:true},{amount_subtotal:1},{currency:'eur'},{metadata:{order_id:'test1'}}])assert.equal(testSessionMatches({...session(),...patch},row()),false);
});
test('Start creates a fixed $10 test session and no marketplace inventory or orders',async()=>{
 const {d,getRecord}=database(null);let params;
 const client={checkout:{sessions:{async create(p){params=p;return {...session(),url:'https://checkout.stripe.com/test',status:'open'}}}}};
 assert.equal((await handleCheckoutTest('start',{...options(d),client})).url,'https://checkout.stripe.com/test');
 assert.equal(params.line_items[0].price_data.unit_amount,1000);assert.equal(params.metadata.checkout_test_id,'test1');assert.equal(getRecord().stripe_session_id,'cs_test_1');
});
test('Paid webhook only records a bound, paid test payment',async()=>{
 const {d,getRecord}=database(row());const evt={livemode:false,type:'checkout.session.completed',data:{object:session()}};
 assert.equal(await processCheckoutTestEvent(evt,d),true);assert.equal(getRecord().status,'paid');assert.ok(getRecord().paid_webhook_at);
});
test('Live and mismatched test webhooks never mark tests paid',async()=>{
 for(const patch of [{livemode:true},{data:{object:{...session(),id:'cs_other'}}}]){const {d,writes}=database(row());await assert.rejects(processCheckoutTestEvent({livemode:false,type:'checkout.session.completed',data:{object:session()},...patch},d));assert.equal(writes.length,0);}
});
test('Unpaid completion and delayed duplicate completion cannot regress refund state',async()=>{
 for(const record of [row(),{...row(),status:'refunded'}]){const {d,writes}=database(record);await processCheckoutTestEvent({livemode:false,type:'checkout.session.completed',data:{object:{...session(),payment_status:record.status==='refunded'?'paid':'unpaid'}}},d);assert.equal(writes.length,0);}
});
test('Refund is limited to the stored paid test payment and fixed test amount',async()=>{
 const {d}=database({...row(),status:'paid',paid_webhook_at:'now',stripe_payment_intent_id:'pi_test1'});let refundParams;
 const client={checkout:{sessions:{retrieve:async()=>session()}},refunds:{create:async p=>{refundParams=p;return {id:'re_test',payment_intent:p.payment_intent,amount:p.amount,status:'succeeded'}}}};
 await handleCheckoutTest('refund',{...options(d),client});assert.deepEqual(refundParams,{payment_intent:'pi_test1',amount:1000});
});
test('Passing refund webhook requires matching USD full refund of recorded test payment',async()=>{
 const {d,getRecord}=database({...row(),status:'paid',paid_webhook_at:'now',stripe_payment_intent_id:'pi_test1'});
 await processCheckoutTestEvent({livemode:false,type:'charge.refunded',data:{object:{payment_intent:'pi_test1',currency:'usd',amount:1000,amount_refunded:1000}}},d);
 assert.equal(getRecord().status,'refunded');assert.ok(getRecord().refund_webhook_at);
});
