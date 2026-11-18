// Production-only eBay Browse adapter. No sample records or untracked fallback links.
export function supplierConfiguration(env=process.env){
 const missing=['EBAY_CLIENT_ID','EBAY_CLIENT_SECRET','EBAY_AFFILIATE_CAMPAIGN_ID'].filter(key=>!env[key]);
 if(env.EBAY_PRODUCTION_APPROVED!=='true')missing.push('EBAY_PRODUCTION_APPROVED');
 if(env.EBAY_AFFILIATE_CAMPAIGN_ID&&!/^\d{9,12}$/.test(env.EBAY_AFFILIATE_CAMPAIGN_ID))missing.push('valid EBAY_AFFILIATE_CAMPAIGN_ID');
 return {provider:'eBay',configured:missing.length===0,missing};
}
const safeLink=(value,domain)=>{try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname===domain||u.hostname.endsWith('.'+domain))?u.href:null}catch{return null}};
export function normalizePartnerItems(data){
 return (Array.isArray(data?.itemSummaries)?data.itemSummaries:[]).flatMap(x=>{
  const url=safeLink(x.itemAffiliateWebUrl,'ebay.com');
  const price=Number(x.price?.value);
  if(!url||!x.itemId||!x.title||!Number.isFinite(price)||price<=0||x.price?.currency!=='USD')return [];
  return [{id:String(x.itemId),title:String(x.title),url,price,currency:'USD',image:safeLink(x.image?.imageUrl,'ebayimg.com'),condition:String(x.condition||''),provider:'eBay'}];
 });
}
export function createPartnerSearch({fetchImpl=fetch,now=Date.now}={}){
 let token,expires=0,tokenKey='',pendingToken;
 const cache=new Map();
 return async function search(query,env=process.env){
  const config=supplierConfiguration(env);
  if(!config.configured)return {status:'not_connected',provider:'eBay',items:[]};
  const q=String(query||'').trim().replace(/\s+/g,' ');
  if(q.length<2||q.length>150)return {status:'invalid_query',provider:'eBay',items:[]};
  const key=env.EBAY_CLIENT_ID+':'+env.EBAY_CLIENT_SECRET;
  const cacheKey=key+':'+env.EBAY_AFFILIATE_CAMPAIGN_ID+':'+q.toLowerCase();
  const saved=cache.get(cacheKey);if(saved&&saved.until>now())return saved.result;
  try{
   if(!token||expires<now()||tokenKey!==key){
    if(!pendingToken||tokenKey!==key){
     tokenKey=key;
     pendingToken=(async()=>{
      const response=await fetchImpl('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(key).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'https://api.ebay.com/oauth/api_scope'}).toString(),signal:AbortSignal.timeout(6000)});
      if(!response.ok)throw Error('authorization');const data=await response.json();
      if(!data.access_token||!Number.isFinite(+data.expires_in))throw Error('token');
      token=data.access_token;expires=now()+Math.max(0,+data.expires_in-120)*1000;
     })();
    }
    try{await pendingToken}finally{pendingToken=null}
   }
   const params=new URLSearchParams({q,limit:'12',filter:'buyingOptions:{FIXED_PRICE}'});
   const response=await fetchImpl('https://api.ebay.com/buy/browse/v1/item_summary/search?'+params,{headers:{Authorization:'Bearer '+token,'X-EBAY-C-MARKETPLACE-ID':'EBAY_US','X-EBAY-C-ENDUSERCTX':'affiliateCampaignId='+env.EBAY_AFFILIATE_CAMPAIGN_ID},signal:AbortSignal.timeout(6000)});
   if(!response.ok){if(response.status===401)expires=0;throw Error('supplier');}
   const result={status:'connected',provider:'eBay',checked_at:new Date(now()).toISOString(),items:normalizePartnerItems(await response.json())};
   if(cache.size>=100)cache.delete(cache.keys().next().value);
   cache.set(cacheKey,{until:now()+60000,result});return result;
  }catch{return {status:'unavailable',provider:'eBay',items:[]};}
 };
}
export const searchPartnerInventory=createPartnerSearch();
