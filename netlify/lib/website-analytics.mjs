import {fail,unwrap} from '../functions/shared.mjs';

const pages=new Set('home catalog part quotes login sell orders return review feedback referrals about contact shipping privacy terms advertising guide_en guide_es'.split(' '));
const kinds=new Set(['view','search','oem_search','no_results','ebay_click','partner_click','quote_open']);
const sources=new Set('direct google bing tiktok facebook instagram threads x telegram youtube pinterest reddit email other'.split(' '));
const devices=new Set(['mobile','desktop']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bots=/bot\b|crawler|spider|preview|facebookexternalhit|headlesschrome|slurp|curl\/|wget\//i;

export function analyticsEvent(body,userAgent=''){
 if(!userAgent||bots.test(userAgent))return null;
 const {id,session_id,page,kind,source,device}=body||{};
 if(!uuid.test(id)||!uuid.test(session_id)||!pages.has(page)||!kinds.has(kind)||!sources.has(source)||!devices.has(device)){
  fail('Invalid website analytics event.');
 }
 if((['search','oem_search','no_results'].includes(kind)&&!['home','catalog'].includes(page))||
    (kind==='quote_open'&&page!=='quotes'))fail('Invalid analytics event for this page.');
 return {id,session_id,page,kind,source,device};
}

export async function recordAnalytics(body,userAgent,db){
 const event=analyticsEvent(body,userAgent);
 if(event)unwrap(await db.from('site_analytics_events').upsert(event,{onConflict:'id',ignoreDuplicates:true}));
}

export function reportDays(value='7'){
 if(!['7','30','90'].includes(value))fail('Select an analytics range of 7, 30 or 90 days.');
 return Number(value);
}
