import {searchPartnerInventory,supplierConfiguration} from '../lib/partner-inventory.mjs';
export async function handler(event){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(event.httpMethod!=='GET')return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed.'})};
 const q=String(event.queryStringParameters?.q||'').trim();
 if(q&&(q.length<2||q.length>150))return {statusCode:400,headers,body:JSON.stringify({error:'Enter between 2 and 150 characters.'})};
 // Empty queries provide connection status without spending supplier API calls.
 const result=q?await searchPartnerInventory(q):{status:supplierConfiguration().configured?'ready':'not_connected',provider:'eBay',items:[]};
 return {statusCode:200,headers,body:JSON.stringify(result)};
}
