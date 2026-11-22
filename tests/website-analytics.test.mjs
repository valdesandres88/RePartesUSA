import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {analyticsEvent,reportDays} from '../netlify/lib/website-analytics.mjs';

const browserSource=readFileSync(new URL('../public/analytics.js',import.meta.url),'utf8');
const event={id:randomUUID(),session_id:randomUUID(),page:'part',kind:'view',source:'tiktok',device:'mobile'};

test('Analytics accepts only known fields and skips crawler traffic',()=>{
 assert.deepEqual(analyticsEvent({...event,ip:'192.0.2.1',path:'/quotes#secret',query:'private'},'Mozilla/5.0'),event);
 assert.equal(analyticsEvent(event,'Googlebot'),null);
 for(const change of [{page:'owner'},{source:'example.com'},{kind:'quote_open'},{session_id:'test'}]){
  assert.throws(()=>analyticsEvent({...event,...change},'Mozilla/5.0'),{status:400});
 }
 assert.equal(reportDays('90'),90);
 assert.equal(reportDays(),7);
 assert.throws(()=>reportDays('365'),{status:400});
});

function browser({path='/',hash='#home',search='',referrer='',gpc=false,ownerDevice=false}={}){
 const calls=[],listeners={},storage=new Map(),deviceStorage=new Map(ownerDevice?[['repartes:owner-analytics-excluded:v1','1']]:[]),window={addEventListener:(type,fn)=>{listeners[type]=fn}};
 const location={pathname:path,hash,search,hostname:'repartesusa-marketplace.netlify.app'};
 let now=1_000_000;
 runInNewContext(browserSource,{
  window,location,document:{referrer,addEventListener(){}},
  navigator:{userAgent:'iPhone',globalPrivacyControl:gpc},
  sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  localStorage:{getItem:key=>deviceStorage.get(key)||null,setItem:(key,value)=>deviceStorage.set(key,value)},
  fetch:async (_url,options)=>{calls.push(JSON.parse(options.body));},
  Date:{now:()=>now},crypto:{randomUUID},URL,URLSearchParams
 });
 return {window,location,calls,view:listeners.hashchange,resolveIdentity:isOwner=>window.repartesAnalytics.resolveIdentity(isOwner),deviceStorage,advance:milliseconds=>{now+=milliseconds}};
}

test('Public page changes and searches share one session until it has been idle',()=>{
 const b=browser({search:'?utm_source=tiktok&other=private'});
 assert.equal(b.calls.length,0,'wait for a verified identity before sending the initial page view');
 b.resolveIdentity(false);
 b.location.hash='#part/private-listing-id';
 b.view();
 b.view();
 b.advance(31*60*1000);
 b.location.hash='#catalog';
 b.view();
 b.window.repartesAnalytics.track('oem_search');
 assert.deepEqual(b.calls.map(x=>[x.page,x.kind,x.source]),[
  ['home','view','tiktok'],['part','view','tiktok'],['catalog','view','tiktok'],['catalog','oem_search','tiktok']
 ]);
 assert.equal(b.calls[0].session_id,b.calls[1].session_id);
 assert.notEqual(b.calls[0].session_id,b.calls[2].session_id);
 assert.equal(b.calls[2].session_id,b.calls[3].session_id);
 assert.ok(!JSON.stringify(b.calls).includes('private'));
});

test('Owner pages and opted-out browsers do not report traffic, and quote tokens stay out of analytics',()=>{
 assert.deepEqual(browser({path:'/owner'}).calls,[]);
 assert.deepEqual(browser({hash:'#owner'}).calls,[]);
 assert.deepEqual(browser({gpc:true}).calls,[]);
 const q=browser({path:'/quotes',hash:'#private-token'});
 q.window.repartesAnalytics.quoteOpened();
 q.window.repartesAnalytics.quoteOpened();
 assert.deepEqual(q.calls.map(x=>[x.page,x.kind]),[['quotes','view'],['quotes','quote_open']]);
 assert.ok(!JSON.stringify(q.calls).includes('private-token'));
 const guide=browser({path:'/guides/comprar-piezas-usadas.html',referrer:'https://l.facebook.com/private'});
 assert.equal(guide.calls[0].source,'facebook');
 assert.equal(guide.calls[0].page,'guide_es');
});

test('Owner sign-in suppresses the initial page view and all subsequent activity',()=>{
 const b=browser();
 b.location.hash='#catalog';b.view();
 b.window.repartesAnalytics.track('search');
 assert.equal(b.calls.length,0,'events must wait for authentication');
 b.resolveIdentity(true);
 b.location.hash='#about';b.view();
 b.window.repartesAnalytics.track('partner_click');
 assert.deepEqual(b.calls,[]);
 assert.equal(b.deviceStorage.get('repartes:owner-analytics-excluded:v1'),'1');
});

test('A previously verified owner device remains excluded even while signed out',()=>{
 const b=browser({ownerDevice:true});
 b.resolveIdentity(false);
 b.location.hash='#catalog';b.view();
 b.window.repartesAnalytics.track('search');
 assert.deepEqual(b.calls,[]);
 const guide=browser({ownerDevice:true,path:'/guides/used-auto-parts.html'});
 assert.deepEqual(guide.calls,[]);
});

test('Queued visits and searches from real visitors retain the original pages',()=>{
 const b=browser({hash:'#home'});
 b.location.hash='#catalog';b.view();
 b.window.repartesAnalytics.track('search');
 assert.equal(b.calls.length,0);
 b.resolveIdentity(false);
 assert.deepEqual(b.calls.map(x=>[x.page,x.kind]),[['home','view'],['catalog','view'],['catalog','search']]);
 b.resolveIdentity(false);
 assert.equal(b.calls.length,3,'verification must not send queued events twice');
});
