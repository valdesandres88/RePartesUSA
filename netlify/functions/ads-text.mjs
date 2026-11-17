import {db,unwrap} from './shared.mjs';
const good=id=>/^ca-pub-[0-9]{16}$/.test(id||'');
export async function handler(event){
 if(event.httpMethod!=='GET')return {statusCode:405,body:'Method not allowed'};
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return {statusCode:503,body:'Unavailable'};
 try{
  const settings=unwrap(await db().from('site_settings').select('adsense_publisher_id').eq('id',1).single());
  const id=settings.adsense_publisher_id||'';
  if(!good(id))return {statusCode:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},body:'Not configured'};
  return {statusCode:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'},body:'google.com, '+id.replace(/^ca-/,'')+', DIRECT, f08c47fec0942fa0\n'};
 }catch(error){console.error('ads.txt error',error);return {statusCode:503,body:'Unavailable'};}
}
