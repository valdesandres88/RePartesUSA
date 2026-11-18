import test from 'node:test';import assert from 'node:assert/strict';
import {validatePartRequest,submitPartRequest} from '../netlify/lib/part-requests.mjs';
const valid={id:'fe69bd5f-fc81-460a-8a89-3df8a1b7abed',vehicle_year:2011,make:'Ram',model:'1500',part:'Alternator',details:'5.7L HEMI',contact_name:'Test Customer',email:'TEST@example.com',phone:'',consent:true};
test('Part request requires usable vehicle/contact details and explicit consent',()=>{
 assert.equal(validatePartRequest(valid).email,'test@example.com');
 for(const patch of [{vehicle_year:1800},{vehicle_year:2011.5},{vehicle_year:2100},{make:''},{part:'x'},{contact_name:''},{email:'invalid'},{phone:'bad phone'},{consent:false},{id:'invalid'}])assert.throws(()=>validatePartRequest({...valid,...patch}));
});
test('Bot honeypot returns no request data',()=>assert.equal(validatePartRequest({...valid,website:'spam'}),null));
function db({existing=false,recent=0}={}){
 let inserted;
 return {get inserted(){return inserted},from(table){assert.equal(table,'part_requests');const q={select(){return q},eq(){return q},gte(){return q},maybeSingle:async()=>({data:existing?{id:valid.id}:null,error:null}),limit:async()=>({data:Array(recent).fill({id:'old'}),error:null}),insert:async row=>{inserted=row;return {error:null}}};return q}};
}
test('Duplicate submissions are idempotent and do not create extra requests',async()=>{const d=db({existing:true});await submitPartRequest(valid,d);assert.equal(d.inserted,undefined)});
test('Repeated submissions for one email are limited before insertion',async()=>{const d=db({recent:3});await assert.rejects(submitPartRequest(valid,d),{status:429});assert.equal(d.inserted,undefined)});
test('Valid request saves normalized fields with consent timestamp',async()=>{const d=db();assert.deepEqual(await submitPartRequest(valid,d),{ok:true});assert.equal(d.inserted.email,'test@example.com');assert.ok(d.inserted.consented_at);assert.equal(d.inserted.id,valid.id)});
