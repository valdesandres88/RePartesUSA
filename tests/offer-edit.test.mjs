import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {str,exactStatus,fail,unwrap,respond,asError} from '../netlify/functions/shared.mjs';
const source=readFileSync(new URL('../netlify/functions/market.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export async function handler','async function handler');
const id='a'.repeat(24),other={id:'b'.repeat(24),title:'Other offer'};
const original={id,kind:'affiliate',placement:'home',title:'Old title',description:'Old description for product',url:'https://example.com/old'};
async function request(body,{user='owner',offers=[original,other]}={}){
 let saved,audit;
 const database={from(table){const q={select(){return q},eq(){return q},update(value){saved=value;return q},insert(value){audit=value;return Promise.resolve({error:null})},single:async()=>({data:saved?{id:1}:{monetization_offers:offers},error:null})};return q}};
 const scope={process:{env:{SUPABASE_URL:'test',SUPABASE_SERVICE_ROLE_KEY:'test',OWNER_USER_ID:'owner'}},URL,URLSearchParams,Date,console:{error(){}},checkOrigin:()=>{},db:()=>database,auth:async()=>({id:user}),stripe:()=>{},str,exactStatus,fail,unwrap,respond,asError,randomBytes:()=>({toString:()=> 'c'.repeat(24)})};
 vm.createContext(scope);vm.runInContext(source,scope);
 const response=await scope.handler({httpMethod:'POST',headers:{},queryStringParameters:{action:'admin.offer.update'},body:JSON.stringify(body)});
 return {response,saved,audit};
}
// checkOrigin is supplied separately to exercise the real owner gate and update handler.
const valid={...original,title:'Updated title',url:'https://example.com/new?tag=my-20',confirm_relationship:true};
test('Owner updates the existing offer without changing its ID or other offers',async()=>{
 const {response,saved,audit}=await request(valid);assert.equal(response.statusCode,200);
 assert.equal(saved.monetization_offers.length,2);assert.equal(saved.monetization_offers[0].id,id);
 assert.equal(saved.monetization_offers[0].url,valid.url);assert.deepEqual(saved.monetization_offers[1],other);
 assert.equal(audit.action,'owner.offer.update');
});
test('Editing remains possible at the 12 offer limit',async()=>{
 const offers=[original,...Array.from({length:11},(_,i)=>({...other,id:String(i).padStart(24,'0')}))];
 assert.equal((await request(valid,{offers})).response.statusCode,200);
});
test('Non-owners cannot edit commercial offers',async()=>{
 const {response,saved}=await request(valid,{user:'someone-else'});assert.equal(response.statusCode,403);assert.equal(saved,undefined);
});
test('Deleted offers are not recreated and invalid edits never write',async()=>{
 for(const body of [{...valid,id:'d'.repeat(24)},{...valid,id:'invalid'},{...valid,url:'javascript:alert(1)'},{...valid,confirm_relationship:false},{...valid,placement:'private'}]){
  const {response,saved}=await request(body);assert.ok(response.statusCode>=400);assert.equal(saved,undefined);
 }
});
