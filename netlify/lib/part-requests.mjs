const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const fail=(message,status=400)=>{const e=Error(message);e.status=status;throw e;};
const unwrap=r=>{if(r.error)throw r.error;return r.data;};
export function validatePartRequest(body,year=new Date().getFullYear()){
 if(body.website)return null;
 const id=clean(body.id,40),vehicle_year=Number(body.vehicle_year),make=clean(body.make,60),model=clean(body.model,80),part=clean(body.part,150),details=clean(body.details,1000),contact_name=clean(body.contact_name,80),email=clean(body.email,254).toLowerCase(),phone=clean(body.phone,40);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail('Please reopen the request form and try again.');
 if(!Number.isInteger(vehicle_year)||vehicle_year<1950||vehicle_year>year+1||make.length<2||model.length<1)fail('Enter the vehicle year, make and model.');
 if(part.length<3||contact_name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter the part needed, your name and a valid email address.');
 if(phone&&!/^[+()\d\s.\-]{7,40}$/.test(phone))fail('Enter a valid phone number or leave it empty.');
 if(body.consent!==true)fail('Please agree to be contacted about your request.');
 return {id,vehicle_year,make,model,part,details,contact_name,email,phone,consented_at:new Date().toISOString()};
}
export async function submitPartRequest(body,d){
 const row=validatePartRequest(body);if(!row)return {ok:true};
 const existing=unwrap(await d.from('part_requests').select('id').eq('id',row.id).maybeSingle());if(existing)return {ok:true};
 const recent=unwrap(await d.from('part_requests').select('id').eq('email',row.email).gte('created_at',new Date(Date.now()-3600000).toISOString()).limit(3));
 if(recent.length>=3)fail('You have sent several requests. Please try again in an hour.',429);
 const result=await d.from('part_requests').insert(row);if(result.error&&result.error.code!=='23505')throw result.error;
 return {ok:true};
}
