import {randomUUID} from 'node:crypto';
import {dollarsToCents} from '../../src/money.js';
import {fail, unwrap} from '../functions/shared.mjs';

const uuidPattern='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const uuid=new RegExp('^'+uuidPattern+'$');
const photoName=new RegExp('^'+uuidPattern+'\\.(jpg|png|webp)$');
const extensions=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);
const quoteStorage=db=>db.storage.from('quote-photos');

function textField(value,max,label,min=2){
 const text=typeof value==='string'?value.trim():'';
 if(text.length<min||text.length>max)fail(label);
 return text;
}

export function quoteDetails(body){
 if(!uuid.test(body?.id)||!uuid.test(body?.request_id))fail('Invalid quote or request ID.');
 const total_cents=dollarsToCents(body.total);
 if(!Number.isInteger(total_cents)||total_cents<1||total_cents>99999999)fail('Enter a total price from $0.01 to $999,999.99.');
 const {condition,fulfillment}=body;
 if(!['new','used','remanufactured'].includes(condition))fail('Select the condition of the part.');
 if(!['pickup','shipping'].includes(fulfillment))fail('Select pickup or shipping.');
 return {
  id:body.id,request_id:body.request_id,total_cents,condition,fulfillment,
  seller_name:textField(body.seller_name,100,'Enter the seller or shop name.'),
  fulfillment_details:textField(body.fulfillment_details,180,'Enter the pickup location or shipping details.'),
  availability:textField(body.availability,120,'Enter the availability or lead time.'),
  warranty:textField(body.warranty,160,'Enter the warranty terms or indicate if there is no warranty.'),
  part_number:textField(body.part_number,80,'Enter a part number of up to 80 characters.',0),
  fitment_notes:textField(body.fitment_notes,500,'Describe what was checked or indicate that fitment is unconfirmed.')
 };
}

export function quotePhotoPaths(paths,{request_id,id}){
 const prefix=request_id+'/'+id+'/';
 if(!Array.isArray(paths)||paths.length<1||paths.length>2||new Set(paths).size!==paths.length||
    paths.some(path=>typeof path!=='string'||!path.startsWith(prefix)||!photoName.test(path.slice(prefix.length)))){
  fail('Upload one or two photos for this quote.');
 }
 return paths;
}

export async function prepareQuotePhotos(body,db){
 const quote=quoteDetails(body);
 const files=body.photo_types;
 if(!Array.isArray(files)||files.length<1||files.length>2||files.some(type=>!extensions.has(type))){
  fail('Upload one or two JPG, PNG or WebP photos.');
 }
 const request=unwrap(await db.from('part_requests').select('id').eq('id',quote.request_id).maybeSingle());
 if(!request)fail('Part request not found.',404);
 return Promise.all(files.map(async type=>{
  const path=quote.request_id+'/'+quote.id+'/'+randomUUID()+'.'+extensions.get(type);
  const {token}=unwrap(await quoteStorage(db).createSignedUploadUrl(path));
  return {path,token};
 }));
}

export async function savePartQuote(body,db){
 const quote=quoteDetails(body);
 const photo_paths=quotePhotoPaths(body.photo_paths,quote);
 const existing=unwrap(await db.from('part_request_quotes').select('request_id').eq('id',quote.id).maybeSingle());
 if(existing){
  if(existing.request_id!==quote.request_id)fail('Quote ID already used.',409);
  return {ok:true};
 }
 const photos=unwrap(await quoteStorage(db).createSignedUrls(photo_paths,60));
 if(photos.length!==photo_paths.length||photos.some(photo=>photo.error||!photo.signedUrl))fail('A quote photo is missing. Upload it again.');
 const result=await db.from('part_request_quotes').insert({...quote,photo_paths});
 if(result.error?.code==='23505'){
  const saved=unwrap(await db.from('part_request_quotes').select('request_id').eq('id',quote.id).maybeSingle());
  if(saved?.request_id===quote.request_id)return {ok:true};
 }
 unwrap(result);
 return {ok:true};
}

export async function withdrawPartQuote(body,db){
 if(!uuid.test(body?.id)||!uuid.test(body?.request_id))fail('Invalid quote or request ID.');
 const quote=unwrap(await db.from('part_request_quotes').update({active:false}).eq('id',body.id).eq('request_id',body.request_id).select('id').maybeSingle());
 if(!quote)fail('Quote not found.',404);
 return {ok:true};
}

export async function readPartQuotes(token,db){
 const unavailable=()=>fail('This quote link is unavailable.',404);
 if(typeof token!=='string'||!uuid.test(token))unavailable();
 const request=unwrap(await db.from('part_requests').select('id,vehicle_year,make,model,part').eq('quote_token',token).maybeSingle());
 if(!request)unavailable();
 const offers=unwrap(await db.from('part_request_quotes')
  .select('seller_name,total_cents,condition,fulfillment,fulfillment_details,availability,warranty,part_number,fitment_notes,photo_paths')
  .eq('request_id',request.id).eq('active',true).order('total_cents').order('created_at'));
 const paths=offers.flatMap(offer=>offer.photo_paths);
 const signed=paths.length?unwrap(await quoteStorage(db).createSignedUrls(paths,300)):[];
 const urls=new Map(signed.filter(photo=>!photo.error&&photo.signedUrl).map(photo=>[photo.path,photo.signedUrl]));
 const {vehicle_year,make,model,part}=request;
 return {request:{vehicle_year,make,model,part},offers:offers.map(({photo_paths,...offer})=>({
  ...offer,photos:photo_paths.map(path=>urls.get(path)).filter(Boolean)
 }))};
}
