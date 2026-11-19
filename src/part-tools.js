import {matchesPartNumber,normalizePartNumber} from './catalog-search.js';

const tools=[
 ['Find a hard-to-find part','Tell us what you need so we can check for a match.','<button type="button" class="primary" data-request-part data-request-alert>Save a part alert</button>'],
 ['See where a used part came from','Look for seller-provided vehicle details, mileage and proof on the part page.'],
 ['Compare connectors','Open a seller listing and compare its photo with one from your phone.'],
 ['Find an installer','Search nearby repair shops and call for an installation price.','<button type="button" class="secondary" data-local-map="install">Find repair shops</button>'],
 ['Find a possible donor vehicle','Search by the exact OEM part number to see other vehicles listed with that number.']
];

export function partToolsCard(){
 return `<section class="section part-tools"><h2>Find the right part, step by step</h2><div class="part-tool-grid">${tools.map(([title,description,action])=>`<article class="panel"><h3>${title}</h3><p>${description}</p>${action||''}</article>`).join('')}</div></section>`;
}

export const sellerEvidenceFields=`<details><summary>Add used-part history (optional)</summary>
 <label>Donor vehicle<input name="evidence_vehicle" maxlength="100" placeholder="2011 Ram 1500 5.7L"></label>
 <label>Donor mileage (miles)<input name="evidence_mileage" type="number" min="0" max="999999" step="1"></label>
 <label>Donor photo link<input name="evidence_photo" type="url" maxlength="350" placeholder="https://"></label>
 <label>Test video link<input name="evidence_video" type="url" maxlength="350" placeholder="https://"></label>
 <p>Only share public photos or videos you own or have permission to share.</p></details>`;

function httpsUrl(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:''}catch{return ''}
}
export function withSellerEvidence(values){
 const vehicle=String(values.evidence_vehicle||'').trim().replace(/[\r\n]/g,' ');
 const mileage=String(values.evidence_mileage||'');
 const photo=httpsUrl(values.evidence_photo),video=httpsUrl(values.evidence_video);
 if((values.evidence_photo&&!photo)||(values.evidence_video&&!video))throw Error('Photo and video links must start with https://.');
 if(!vehicle&&!mileage&&!photo&&!video)return values.description;
 const info=[['Donor vehicle',vehicle],['Donor mileage',mileage],['Donor photo',photo],['Test video',video]].filter(([,value])=>value);
 const description=values.description.trim()+'\n\nUsed-part history\n'+info.map(([label,value])=>label+': '+value).join('\n');
 if(description.length>4000)throw Error('Keep the description and part history under 4,000 characters.');
 return description;
}

export function sellerHistory(description,esc){
 const separator='\n\nUsed-part history\n';
 const boundary=description.lastIndexOf(separator);
 if(boundary<0)return `<p>${esc(description)}</p>`;
 const lines=description.slice(boundary+separator.length).split('\n');
 const items=lines.map(line=>{
  const index=line.indexOf(': ');
  const label=line.slice(0,index),value=line.slice(index+2);
  if(['Donor vehicle','Donor mileage'].includes(label))return `<dt>${label}</dt><dd>${esc(value)}${label==='Donor mileage'?' miles':''}</dd>`;
  const url=httpsUrl(value);
  if(url&&['Donor photo','Test video'].includes(label))return `<dt>${label}</dt><dd><a href="${esc(url)}" target="_blank" rel="ugc nofollow noopener noreferrer">Open ${label.toLowerCase()} ↗</a></dd>`;
  return '';
 });
 if(items.some(item=>!item))return `<p>${esc(description)}</p>`;
 return `<p>${esc(description.slice(0,boundary))}</p><h3>Used-part history</h3><p>Details provided by the seller.</p><dl>${items.join('')}</dl>`;
}

export function donorVehicles(listings,number,esc){
 if(!normalizePartNumber(number))return '';
 const seen=new Set();
 const matches=listings.filter(row=>{
  if(!matchesPartNumber(row,number))return false;
  const key=[row.make,row.model,row.year_min,row.year_max].join('|').toLowerCase();
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
 if(matches.length<2)return '';
 return `<section class="panel"><h3>Possible donor vehicles</h3><p>These seller listings share part number <strong>${esc(number)}</strong>. Ask the seller to confirm fit for your engine, trim and connector.</p><ul>${matches.slice(0,10).map(row=>`<li><a href="#part/${esc(row.id)}">${esc(row.year_min)}–${esc(row.year_max)} ${esc(row.make)} ${esc(row.model)}</a></li>`).join('')}</ul></section>`;
}

export function partDetailTools(part,esc){
 const search=encodeURIComponent('auto repair shop install customer supplied '+part.title);
 return `<section class="part-tool-grid">
 <article class="panel"><h2>Compare connectors</h2><p>Pick a picture of your connector. Your photo stays on this device.</p><label>Your connector photo<input type="file" accept="image/*" data-connector-photo></label><p role="status" data-connector-status></p><div class="connector-photos"><figure><img src="${esc(part.image_url)}" alt="Seller’s part photo" loading="lazy"><figcaption>Seller photo</figcaption></figure><figure data-connector-preview hidden><img alt="Your connector photo"><figcaption>Your photo</figcaption></figure></div><p>Compare the plug shape, pins and clip. Ask the seller for a close-up if needed.</p></article>
 <article class="panel"><h2>Find an installer</h2><p>Enter your ZIP code to find nearby repair shops. Call to ask for the full installed price.</p><form data-installer-search data-query="${search}"><label>ZIP code<input name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5" required></label><button type="submit" class="primary">Find repair shops ↗</button></form><h3>What to ask</h3><p>“Can you install a customer-supplied ${esc(part.title)}? What’s the total cost, and is labor covered by a warranty?”</p></article></section>`;
}
export function mountPartDetailTools(root){
 const input=root.querySelector('[data-connector-photo]');
 const preview=root.querySelector('[data-connector-preview]');
 const image=preview.querySelector('img');
 const status=root.querySelector('[data-connector-status]');
 let objectUrl;
 function clear(){
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl=undefined;
  image.removeAttribute('src');
  preview.hidden=true;
 }
 input.addEventListener('change',()=>{
  clear();
  const file=input.files[0];
  if(!file){status.textContent='';return;}
  if(!file.type.startsWith('image/')||file.size>12*1024*1024){status.textContent='Choose an image under 12 MB.';return;}
  status.textContent='';
  objectUrl=URL.createObjectURL(file);
  image.src=objectUrl;
  preview.hidden=false;
 });
 image.addEventListener('error',()=>{clear();status.textContent='This image could not be opened. Try JPG or PNG.';});
 document.addEventListener('repartes:page',clear,{once:true});
 const form=root.querySelector('[data-installer-search]');
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const query=decodeURIComponent(form.dataset.query)+' near '+form.elements.zip.value;
  window.open('https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query}),'_blank','noopener,noreferrer');
 });
}

export function ownerAlertMatches(request,listings,esc){
 const number=String(request.details||'').match(/^OEM number: ([^\r\n]+)$/m)?.[1];
 if(!String(request.details||'').startsWith('Part availability alert')||!number)return '';
 const matches=listings.filter(row=>matchesPartNumber(row,number));
 if(!matches.length)return '<p>No published listing with this OEM number yet.</p>';
 return `<p><strong>OEM matches to review</strong></p><ul>${matches.slice(0,5).map(row=>{
  const url=new URL('/#part/'+encodeURIComponent(row.id),window.location.origin);
  const message='We found a possible match for '+request.part+': '+url.href+' . Please confirm fitment before ordering.';
  const mail='mailto:'+encodeURIComponent(request.email)+'?'+new URLSearchParams({subject:'Possible RePartes USA part match',body:message}).toString().replaceAll('+','%20');
  return `<li>${esc(row.title)} · <a href="${esc(url.href)}" target="_blank" rel="noopener">Review listing</a> · <a href="${esc(mail)}">Email customer</a></li>`;
 }).join('')}</ul>`;
}

export function loadSellerEvidence(form,description){
 const fields={'Donor vehicle':'evidence_vehicle','Donor mileage':'evidence_mileage','Donor photo':'evidence_photo','Test video':'evidence_video'};
 for(const field of Object.values(fields))form.elements[field].value='';
 const separator='\n\nUsed-part history\n';
 const boundary=description.lastIndexOf(separator);
 if(boundary<0)return;
 const entries=description.slice(boundary+separator.length).split('\n').map(line=>{
  const at=line.indexOf(': ');
  return [fields[line.slice(0,at)],line.slice(at+2)];
 });
 if(entries.some(([field])=>!field))return;
 for(const [field,value] of entries)form.elements[field].value=value;
 form.elements.description.value=description.slice(0,boundary);
}
