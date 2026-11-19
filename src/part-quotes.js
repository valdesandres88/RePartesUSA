import {money} from './money.js';
import {localize} from './i18n.js';

export const quotePath='/quotes';
const conditions={new:'New',used:'Used',remanufactured:'Remanufactured'};
const fulfillment={pickup:'Local pickup',shipping:'Shipping'};
const photoTypes=['image/jpeg','image/png','image/webp'];

export function ownerQuoteTools(request,esc){
 const active=(request.part_request_quotes||[]).filter(quote=>quote.active);
 return `<div class="quote-tools">
  ${active.length?`<div class="flex"><button type="button" data-act="quote-copy" data-id="${esc(request.id)}">Copy private quote link</button></div>
  <ul>${active.map(quote=>`<li><span data-no-translate>${esc(quote.seller_name)} · ${money(quote.total_cents)}</span>
   <button type="button" data-act="quote-withdraw" data-id="${esc(quote.id)}" data-status="${esc(request.id)}">Withdraw quote</button></li>`).join('')}</ul>`:''}
  <details><summary>Add a quote</summary>
   <form data-quote-form data-request-id="${esc(request.id)}">
    <div class="quote-fields">
     <label>Seller or shop<input name="seller_name" minlength="2" maxlength="100" required></label>
     <label>Total price (USD)<input name="total" inputmode="decimal" maxlength="9" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="125.00" required></label>
     <label>Condition<select name="condition" required>${choices(conditions)}</select></label>
     <label>Delivery method<select name="fulfillment" required>${choices(fulfillment)}</select></label>
     <label>Pickup location or shipping details<input name="fulfillment_details" minlength="2" maxlength="180" required></label>
     <label>Availability or lead time<input name="availability" minlength="2" maxlength="120" required></label>
     <label>Warranty terms or none<input name="warranty" minlength="2" maxlength="160" required></label>
     <label>Part number (optional)<input name="part_number" maxlength="80"></label>
    </div>
    <label>Fitment checks or unconfirmed details<textarea name="fitment_notes" minlength="2" maxlength="500" rows="2" required></textarea></label>
    <label>Original part photo<input name="part_photo" type="file" accept="${photoTypes.join(',')}" required></label>
    <label>Part label photo (optional)<input name="label_photo" type="file" accept="${photoTypes.join(',')}"></label>
    <button type="submit" class="primary">Save quote</button>
    <p data-quote-status aria-live="polite"></p>
   </form>
  </details>
 </div>`;
}

function choices(items){
 return '<option value="" selected disabled>Choose an option</option>'+
  Object.entries(items).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
}

const draftPhotos=new WeakMap();

export async function submitOwnerQuote(form,api,storage){
 const values=Object.fromEntries(new FormData(form));
 delete values.part_photo;
 delete values.label_photo;
 const files=['part_photo','label_photo'].map(name=>form.elements.namedItem(name).files[0]).filter(Boolean);
 if(!files.length||files.some(file=>!photoTypes.includes(file.type)||file.size===0||file.size>5*1024*1024)){
  throw Error('Each photo must be JPG, PNG or WebP and up to 5 MB.');
 }
 const id=form.dataset.quoteId||=crypto.randomUUID();
 const quote={...values,id,request_id:form.dataset.requestId};
 let draft=draftPhotos.get(form);
 if(!draft||files.length!==draft.files.length||files.some((file,i)=>file!==draft.files[i])){
  const {uploads}=await api('admin.quote.photos','POST',{...quote,photo_types:files.map(file=>file.type)});
  const bucket=storage.from('quote-photos');
  await Promise.all(uploads.map(async ({path,token},i)=>{
   const {error}=await bucket.uploadToSignedUrl(path,token,files[i],{contentType:files[i].type});
   if(error)throw Error('Could not upload the photo. Please try again.');
  }));
  draft={files,paths:uploads.map(upload=>upload.path)};
  draftPhotos.set(form,draft);
 }
 await api('admin.quote.add','POST',{...quote,photo_paths:draft.paths});
 draftPhotos.delete(form);
}

export function quoteComparison(result,esc){
 const {request,offers}=result;
 return `<h1>Compare your quotes</h1>
  <h2 data-no-translate>${esc(request.part)}</h2>
  <p data-no-translate>${esc(request.vehicle_year)} ${esc(request.make)} ${esc(request.model)}</p>
  ${offers.length?`<p>Confirm availability and compatibility before buying. To follow up, reply to the person who shared this link.</p>
   <div class="quote-comparison">${offers.map(offer=>`<article class="panel quote-option">
    <h3 data-no-translate>${esc(offer.seller_name)}</h3>
    <p><span>Total quoted price</span> <strong>${money(offer.total_cents)}</strong></p>
    ${offer.photos.length?`<div class="quote-photos">${offer.photos.map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(url)}" alt="View quote photo"></a>`).join('')}</div>`:''}
    <dl>
     <dt>Condition</dt><dd>${conditions[offer.condition]}</dd>
     <dt>${fulfillment[offer.fulfillment]}</dt><dd data-no-translate>${esc(offer.fulfillment_details)}</dd>
     <dt>Availability</dt><dd data-no-translate>${esc(offer.availability)}</dd>
     <dt>Warranty</dt><dd data-no-translate>${esc(offer.warranty)}</dd>
     ${offer.part_number?`<dt>Part number (OEM)</dt><dd data-no-translate>${esc(offer.part_number)}</dd>`:''}
     <dt>Fitment notes</dt><dd data-no-translate>${esc(offer.fitment_notes)}</dd>
    </dl>
   </article>`).join('')}</div>`:'<p>There are no active quotes for this request yet.</p>'}`;
}

export function renderQuotePage(app,content,language,languageSelector){
 app.innerHTML=`<header class="header"><a href="/" class="logo"><span class="logo-mark" aria-hidden="true">R</span> REPARTES <em>USA</em></a>${languageSelector()}</header><main class="section quote-page">${content}</main><footer><p><small>© 2026 RePartes USA. Todos los derechos reservados.</small></p></footer>`;
 localize(app,language);
}
