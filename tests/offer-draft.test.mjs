import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('Reload restores an edit to the same offer without remembering consent',()=>{
 const values=new Map(),fields=Object.fromEntries(['kind','placement','title','url','description'].map(n=>[n,{tagName:'INPUT',value:''}]));
 const nodes={'h3':{},'button[type="submit"]':{},'[data-act="offercancel"]':{hidden:true}};
 const form={dataset:{draftUser:'owner'},elements:{namedItem:n=>fields[n]},querySelector:s=>nodes[s],isConnected:true};
 const scope={S:{session:{user:{id:'owner'}},admin:{settings:{monetization_offers:[{id:'a'.repeat(24)}]}}},document:{getElementById:()=>form,addEventListener(){}},window:{scrollY:320,addEventListener(){},scrollTo(){}},requestAnimationFrame:fn=>fn(),localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},Date};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('const OFFER_DRAFT_FIELDS'),source.indexOf('function layout(inner)')),scope);
 scope.setOfferMode(form,'a'.repeat(24));fields.title.value='Updated turbo';fields.url.value='https://example.com/?tag=mine';scope.saveOfferDraft();
 scope.setOfferMode(form);fields.title.value='';scope.restoreOfferDraft();
 assert.equal(form.dataset.id,'a'.repeat(24));assert.equal(fields.title.value,'Updated turbo');assert.equal(nodes['button[type="submit"]'].textContent,'Save offer changes');assert.equal(nodes['[data-act="offercancel"]'].hidden,false);
 const draft=JSON.parse([...values.values()][0]);assert.equal(draft.values.confirm_relationship,undefined);
 scope.S.session={user:{id:'other-owner'}};fields.title.value='';scope.restoreOfferDraft();assert.equal(fields.title.value,'');
});
