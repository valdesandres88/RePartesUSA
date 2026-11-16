import {createClient} from '@supabase/supabase-js';
import Stripe from 'stripe';
export const db=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
export const stripe=()=>new Stripe(process.env.STRIPE_SECRET_KEY);
export const respond=(data,status=200)=>({statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function unwrap({data,error}){if(error)throw error;return data;}
export async function auth(event,database,{owner=false}={}){
 const token=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)fail('Inicia sesión para continuar.',401);
 const {data:{user},error}=await database.auth.getUser(token);
 if(error||!user||!user.email_confirmed_at)fail('Sesión no válida o correo sin verificar.',401);
 const profile=unwrap(await database.from('profiles').select('id,is_banned,display_name').eq('id',user.id).single());
 if(profile.is_banned)fail('Cuenta suspendida.',403);
 if(owner&&user.id!==process.env.OWNER_USER_ID)fail('Acceso exclusivo del owner.',403);
 return user;
}
export function checkOrigin(event){
 const origin=event.headers.origin||event.headers.Origin;if(!origin)return;
 const candidate=new URL(origin);const host=event.headers.host||event.headers.Host;
 if(candidate.host!==host)fail('Origen de solicitud no autorizado.',403);
}
export const str=(v,max=140)=>typeof v==='string'?v.trim().slice(0,max):'';
export function positiveInt(v,min,max){const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)fail('Valor numérico fuera de rango.');return n;}
export function exactStatus(v,allowed){if(!allowed.includes(v))fail('Estado no permitido.');return v;}
export function validImage(s){if(!s)return '';try{const u=new URL(s);if(u.protocol!=='https:')fail('La imagen debe utilizar HTTPS.');return u.toString().slice(0,900);}catch{fail('URL de imagen no válida (HTTPS).');}}
export function asError(e){const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<600?e.status:500;return respond({error:status===500?'Error interno. Inténtalo de nuevo o contacta al soporte.':e.message||'Solicitud no válida.'},status);}
