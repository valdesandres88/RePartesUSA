import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOwnerAnalytics} from '../src/owner-analytics.js';

function node(){
 const listeners=new Map();
 return {
  listeners,dataset:{},innerHTML:'',value:'7',hidden:true,
  addEventListener:(type,handler)=>listeners.set(type,handler),
  removeEventListener:(type,handler)=>{if(listeners.get(type)===handler)listeners.delete(type);},
  querySelector:()=>null,
  replaceChildren(){this.innerHTML='';}
 };
}

test('Analytics refreshes the entire report while visible and stops on hide or unmount',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const doc={...node(),hidden:false,activeElement:null};
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
 let stop;
 t.after(()=>{
  stop?.();
  if(original)Object.defineProperty(globalThis,'document',original);
  else delete globalThis.document;
 });
 const root={...node(),isConnected:true};
 const names=['range','refresh','status','content','recent','live','updated'];
 const nodes=Object.fromEntries(names.map(name=>[name,node()]));
 root.querySelector=selector=>nodes[selector.slice(16,-1)];
 let hits=0;
 stop=mountOwnerAnalytics(root,{
  language:'es',esc:String,
  async api(action,method,{days},{signal}){
   assert.equal(action,'analytics.report');
   assert.equal(method,'GET');
   assert.equal(days,nodes.range.value);
   assert.equal(signal.aborted,false);
   hits++;
   if(hits===2)throw Error('Temporary outage');
   return {
    visits:hits,views:hits,daily:[],pages:[],sources:[],devices:[],activity:{},requests:hits,quotes:0,registrations:0,
    sales:{orders:0,gross_cents:0,fee_cents:0},
    live:{observed_at:'2026-11-19T18:00:00Z',active_sessions:hits,recent:[]}
   };
  }
 });
 await Promise.resolve();
 assert.equal(nodes.live.textContent,'En vivo');
 assert.match(nodes.content.innerHTML,/<small>Visitas<\/small><strong>1<\/strong>/);
 t.mock.timers.tick(10000);
 await Promise.resolve();
 assert.equal(nodes.live.textContent,'Reconectando');
 assert.match(nodes.content.innerHTML,/<small>Visitas<\/small><strong>1<\/strong>/);
 t.mock.timers.tick(10000);
 await Promise.resolve();
 assert.match(nodes.content.innerHTML,/<small>Visitas<\/small><strong>3<\/strong>/);
 assert.match(nodes.recent.innerHTML,/<strong>3<\/strong>/);
 doc.hidden=true;
 doc.listeners.get('visibilitychange')();
 t.mock.timers.tick(30000);
 assert.equal(hits,3);
 doc.hidden=false;
 doc.listeners.get('visibilitychange')();
 await Promise.resolve();
 assert.equal(hits,4);
 nodes.range.value='30';
 nodes.range.listeners.get('change')();
 await Promise.resolve();
 assert.equal(hits,5);
 stop();
 t.mock.timers.tick(30000);
 assert.equal(hits,5);
 assert.equal(doc.listeners.has('visibilitychange'),false);
});
