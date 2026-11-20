import {parts} from '../../src/amazon-parts.js';
import {respond} from './shared.mjs';

const marketplace='www.amazon.com';
let token, expiresAt=0, pendingToken;

async function getToken(client_id,client_secret){
 if(token && Date.now()<expiresAt)return token;
 if(!pendingToken)pendingToken=(async()=>{
  const response=await fetch('https://api.amazon.com/auth/o2/token',{
   method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(5000),
   body:JSON.stringify({client_id,client_secret,grant_type:'client_credentials',scope:'creatorsapi::default'})
  });
  if(!response.ok)throw Error('Amazon authorization unavailable');
  const result=await response.json();
  if(!result.access_token)throw Error('Amazon access token missing');
  token=result.access_token;
  expiresAt=Date.now()+Math.max(0,Number(result.expires_in||0)-60)*1000;
  return token;
 })().finally(()=>{pendingToken=null});
 return pendingToken;
}

function trustedUrl(value,hosts){
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&hosts.includes(url.hostname)&&!url.username&&!url.password?url.href:null;
 }catch{return null}
}

export async function handler(event){
 if(event.httpMethod!=='GET')return respond({status:'unsupported'},405);
 const clientId=process.env.AMAZON_CREATORS_CLIENT_ID,secret=process.env.AMAZON_CREATORS_CLIENT_SECRET;
 if(!clientId||!secret)return respond({status:'unconfigured'});
 const {part,vehicle=''}=event.queryStringParameters||{};
 const index=Number(part);
 if(!/^\d+$/.test(part||'')||!parts[index]||vehicle.length>100)return respond({status:'invalid'},400);
 try{
  const accessToken=await getToken(clientId,secret);
  const response=await fetch('https://creatorsapi.amazon/catalog/v1/searchItems',{
   method:'POST',signal:AbortSignal.timeout(6500),
   headers:{Authorization:'Bearer '+accessToken,'x-marketplace':marketplace,'Content-Type':'application/json'},
   body:JSON.stringify({keywords:[parts[index].name,vehicle.trim()].filter(Boolean).join(' '),searchIndex:'Automotive',itemCount:5,marketplace,partnerTag:process.env.AMAZON_PARTNER_TAG||'andresvalde06-20',resources:['images.primary.medium','itemInfo.title']})
  });
  if(!response.ok)throw Error('Amazon search unavailable');
  const data=await response.json();
  const products=[];
  const seen=new Set();
  for(const item of data.searchResult?.items||[]){
   const asin=item.asin,title=item.itemInfo?.title?.displayValue;
   const photo=trustedUrl(item.images?.primary?.medium?.url,['m.media-amazon.com','images-na.ssl-images-amazon.com']);
   const url=trustedUrl(item.detailPageURL,[marketplace]);
   if(!asin||seen.has(asin)||!title||!photo||!url)continue;
   seen.add(asin);
   products.push({title,photo,url});
  }
  return {...respond({status:'ok',products}),headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}};
 }catch{return respond({status:'unavailable'},503)}
}
