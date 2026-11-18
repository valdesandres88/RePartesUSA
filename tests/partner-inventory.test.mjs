import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierConfiguration,createPartnerSearch,normalizePartnerItems} from '../netlify/lib/partner-inventory.mjs';
const env={EBAY_CLIENT_ID:'test-client',EBAY_CLIENT_SECRET:'test-secret',EBAY_AFFILIATE_CAMPAIGN_ID:'1234567890',EBAY_PRODUCTION_APPROVED:'true'};
const item={itemId:'real-api-record',title:'Alternator',price:{value:'50.25',currency:'USD'},itemAffiliateWebUrl:'https://www.ebay.com/itm/example?campid=1234567890',image:{imageUrl:'https://i.ebayimg.com/image.jpg'}};
test('Missing provider approval or credentials returns no inventory and never calls eBay',async()=>{
 let calls=0;const search=createPartnerSearch({fetchImpl:()=>{calls++;throw Error('unexpected')}});
 for(const value of [{},{...env,EBAY_PRODUCTION_APPROVED:'false'},{...env,EBAY_CLIENT_SECRET:''}]){
  assert.equal(supplierConfiguration(value).configured,false);
  assert.deepEqual((await search('turbo',value)).items,[]);
 }
 assert.equal(calls,0);
});
test('Provider items require real affiliate URLs and numeric USD prices',()=>{
 const items=normalizePartnerItems({itemSummaries:[item,{...item,itemAffiliateWebUrl:undefined},{...item,itemAffiliateWebUrl:'https://evil.example/'},{...item,price:{value:'NaN',currency:'USD'}},{...item,price:{value:'20',currency:'EUR'}}]});
 assert.equal(items.length,1);assert.equal(items[0].url,item.itemAffiliateWebUrl);assert.equal(items[0].price,50.25);
 assert.equal(normalizePartnerItems({itemSummaries:[{...item,image:{imageUrl:'javascript:alert(1)'}}]})[0].image,null);
});
test('Production API search uses affiliate campaign, safely caches token/results and retains returned tracking URL',async()=>{
 const calls=[];const search=createPartnerSearch({fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('oauth2/token')?{access_token:'private-token',expires_in:7200}:{itemSummaries:[item]}}}});
 const result=await search('turbo & ram',env);
 assert.equal(result.status,'connected');assert.equal(result.items[0].url,item.itemAffiliateWebUrl);
 assert.ok(calls[0].url.startsWith('https://api.ebay.com/identity/'));
 assert.equal(calls[1].options.headers['X-EBAY-C-ENDUSERCTX'],'affiliateCampaignId=1234567890');
 assert.equal(new URL(calls[1].url).searchParams.get('q'),'turbo & ram');
 assert.equal(JSON.stringify(result).includes('private-token'),false);
 await search('turbo & ram',env);assert.equal(calls.length,2);
 await search('alternator',env);assert.equal(calls.length,3);
});
test('Invalid queries and upstream failures never fabricate results or expose credentials',async()=>{
 let calls=0;const search=createPartnerSearch({fetchImpl:async()=>{calls++;throw Error('test-secret')}});
 assert.equal((await search('x',env)).status,'invalid_query');assert.equal(calls,0);
 const failed=await search('turbo',env);assert.equal(failed.status,'unavailable');assert.deepEqual(failed.items,[]);assert.ok(!JSON.stringify(failed).includes('test-secret'));
});
