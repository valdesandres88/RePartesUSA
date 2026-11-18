import {processCheckoutTestEvent} from '../netlify/lib/checkout-tests.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {paidSessionMatchesOrder,stripeModeMatches,sessionMatchesOrder} from '../netlify/functions/payment-guards.mjs';
import {respond,unwrap} from '../netlify/functions/shared.mjs';
const source=readFileSync(new URL('../netlify/functions/webhook.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export async function handler','async function handler');
async function invoke({livemode=false,sessionId='cs_test_1',type='checkout.session.expired'}={}){
 const writes=[];let dbReads=0;const event={livemode,type,data:{object:{id:sessionId,payment_status:'unpaid',metadata:{order_id:'order1'}}}};
 const database={from(){dbReads++;const q={select(){return q},eq(){return q},async maybeSingle(){return {data:{id:'order1',stripe_session_id:'cs_test_1'},error:null}}};return q},async rpc(name,args){writes.push({name,args});return {error:null}}};
 const scope={process:{env:{CHECKOUT_MODE:'test',STRIPE_WEBHOOK_SECRET:'test'}},stripe:()=>({webhooks:{constructEvent:()=>event}}),db:()=>database,respond,unwrap,paidSessionMatchesOrder,stripeModeMatches,sessionMatchesOrder,processCheckoutTestEvent,console:{error(){}}};
 vm.createContext(scope);vm.runInContext(source,scope);const response=await scope.handler({httpMethod:'POST',headers:{},body:'{}'});return {response,writes,dbReads};
}
test('Signed live events cannot mutate a test deployment',async()=>{const r=await invoke({livemode:true});assert.equal(r.response.statusCode,400);assert.equal(r.dbReads,0);assert.equal(r.writes.length,0)});
test('Foreign expiration events cannot release another checkout reservation',async()=>{const r=await invoke({sessionId:'cs_foreign'});assert.equal(r.response.statusCode,500);assert.equal(r.writes.length,0)});
test('Matching expiration events release only their own order',async()=>{const r=await invoke();assert.equal(r.response.statusCode,200);assert.equal(r.writes[0].name,'order_expire');assert.equal(r.writes[0].args.p_order,'order1')});
test('Unpaid asynchronous completion does not fulfill the order',async()=>{const r=await invoke({type:'checkout.session.completed'});assert.equal(r.response.statusCode,200);assert.equal(r.writes.length,0)});
