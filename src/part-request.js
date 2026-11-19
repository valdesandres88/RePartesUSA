const DRAFT_KEY='repartes:part-request:v1';
const fields=['vehicle_year','make','model','part','zip_code','details','contact_name','email','phone','alert_oem','alert_budget'];
export function mountPartRequests({submit,getSearchQuery,getOemQuery}){
 const dialog=document.createElement('dialog');dialog.className='part-request-dialog';dialog.setAttribute('aria-labelledby','part-request-title');
 dialog.innerHTML=`<button class="request-close" type="button" aria-label="Close part request">×</button><div class="request-eyebrow">REPARTES USA · PART FINDER</div><h2 id="part-request-title">Need a part for your vehicle?</h2><p class="request-intro">Tell us what you need. Request availability and a quote—free, with no account required.</p><form id="part-request-form"><div class="vehicle-card"><div class="vehicle-label"><span aria-hidden="true">↗</span> YOUR VEHICLE</div><div class="request-vehicle"><label>Year<input name="vehicle_year" inputmode="numeric" type="number" min="1950" max="${new Date().getFullYear()+1}" placeholder="2011" required></label><label>Make<input name="make" placeholder="Ram" minlength="2" maxlength="60" required></label><label>Model<input name="model" placeholder="1500" maxlength="80" required></label></div><p class="fitment-note">Engine, trim and part numbers help us check fitment. Compatibility must be confirmed before purchase.</p><label class="request-part">What part do you need?<input name="part" placeholder="e.g. Alternator for a 5.7L HEMI" minlength="3" maxlength="150" required></label></div><fieldset data-alert-fields hidden disabled><legend>Part availability alert</legend><p>We review requests and can email you if we find a possible match.</p><label>OEM part number (optional)<input name="alert_oem" maxlength="100" placeholder="Number printed on the part"></label><label>Maximum budget in USD (optional)<input name="alert_budget" type="number" min="1" max="100000" step="1"></label></fieldset><label>ZIP code <span class="request-optional">(optional)</span><input name="zip_code" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="33101"></label><label>Additional details <span class="request-optional">(optional)</span><textarea name="details" placeholder="Engine, trim, part number, or a description of the part" maxlength="1000" rows="2"></textarea></label><div class="request-contact"><label>Your name<input name="contact_name" autocomplete="name" minlength="2" maxlength="80" required></label><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label></div><label>Phone <span class="request-optional">(optional)</span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label><label class="request-honeypot" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label><label class="check request-consent"><input name="consent" type="checkbox" required> <span>I agree to be contacted about this request. See our <a href="#privacy">privacy notice</a>.</span></label><p class="request-result" role="status" aria-live="polite"></p><button class="primary request-submit" type="submit">Request a part <span aria-hidden="true">↗</span></button><p class="request-footnote">No purchase obligation. Availability and pricing are confirmed after review.</p><button class="request-clear" type="button">Clear saved draft</button><small class="request-draft-note">Unfinished details are saved on this device for up to 7 days.</small></form>`;
 document.body.append(dialog);const form=dialog.querySelector('form'),status=dialog.querySelector('.request-result');let requestId=crypto.randomUUID(),returnFocus;
 const alertFields=form.querySelector('[data-alert-fields]');
 const submitButton=form.querySelector('[type="submit"]');
 function save(){
  const values=Object.fromEntries(fields.map(name=>[name,form.elements[name].value]));
  try{
   if(Object.values(values).some(Boolean))localStorage.setItem(DRAFT_KEY,JSON.stringify({savedAt:Date.now(),id:requestId,values}));
   else localStorage.removeItem(DRAFT_KEY);
  }catch{}
 }
 function restore(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(d&&Date.now()-d.savedAt<7*86400000){requestId=d.id||requestId;for(const n of fields)form.elements[n].value=String(d.values?.[n]||'');}else localStorage.removeItem(DRAFT_KEY);}catch{}}
 function close(){save();dialog.close();returnFocus?.focus?.();}
 function open(trigger){
  if(dialog.open)return;
  returnFocus=trigger;
  restore();
  const alertMode=trigger.hasAttribute('data-request-alert');
  alertFields.hidden=!alertMode;
  alertFields.disabled=!alertMode;
  submitButton.textContent=alertMode?'Save part alert':'Request a part';
  if(alertMode&&!form.elements.alert_oem.value)form.elements.alert_oem.value=getOemQuery().trim().slice(0,100);
  if(trigger.hasAttribute('data-request-from-search')&&!form.elements.part.value){
   form.elements.part.value=getSearchQuery().trim().slice(0,150);
  }
  status.textContent='';
  status.classList.remove('success');
  form.elements.consent.checked=false;
  dialog.showModal();
 }
 dialog.querySelector('.request-close').addEventListener('click',close);
 dialog.addEventListener('cancel',save);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
 form.addEventListener('input',save);window.addEventListener('pagehide',save);
 dialog.querySelector('.request-clear').addEventListener('click',()=>{form.reset();requestId=crypto.randomUUID();try{localStorage.removeItem(DRAFT_KEY);}catch{}status.textContent='Saved draft cleared.';});
 dialog.querySelector('a[href="#privacy"]').addEventListener('click',close);
 form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;status.classList.remove('success');status.textContent='Sending your request…';
  try{const data=Object.fromEntries(new FormData(form));if(!alertFields.disabled){
    const oem=data.alert_oem.trim().replace(/[\r\n]/g,' ');
    data.details=['Part availability alert',oem?'OEM number: '+oem:'',data.alert_budget?'Maximum budget: $'+data.alert_budget:'',data.details].filter(Boolean).join('\n');
    if(data.details.length>1000)throw Error('Please shorten the additional details before saving the alert.');
   }
   delete data.alert_oem;
   delete data.alert_budget;
   await submit({...data,id:requestId,consent:form.elements.consent.checked});form.reset();requestId=crypto.randomUUID();try{localStorage.removeItem(DRAFT_KEY);}catch{}status.textContent='Request received. RePartes USA can now review it and contact you using the details you provided.';status.classList.add('success');}
  catch(error){status.textContent=error.message||'Could not send your request. Please try again.';save();}finally{button.disabled=false;}
 });
 document.addEventListener('click',event=>{const trigger=event.target.closest('[data-request-part]');if(trigger)open(trigger);});
 document.addEventListener('repartes:page',()=>{if(dialog.open)close();});
}
