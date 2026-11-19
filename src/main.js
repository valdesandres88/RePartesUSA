import {supportPage} from './support.js';
import {localMapMarkup,mountLocalMap} from './local-map.js';
import {createClient} from '@supabase/supabase-js';
import {money} from './money.js';
import {reviewList,reviewForm,stars} from './reviews-ui.js';
import {LANGUAGES,getLanguage,setLanguage,localize} from './i18n.js';
import './styles.css';
import {mountOwnerAnalytics} from './owner-analytics.js';
import {mountPartRequests} from './part-request.js';
import {ownerQuoteTools,quoteComparison,quotePath,renderQuotePage,submitOwnerQuote} from './part-quotes.js';
import {matchesPartNumber,matchesSearch,normalizePartNumber,publishedOffers} from './catalog-search.js';

const ownerPath='/owner';
const pagePath=location.pathname.replace(/\/$/,'');
const isOwnerPage=pagePath===ownerPath;
const isQuotePage=pagePath===quotePath;
const marketplaceRoute=()=>(location.hash||'#home').slice(1).split('/');

const cfg=import.meta.env;
let currentLanguage=getLanguage();
// The auth client consumes the email callback fragment during initialization.
function readRecoveryCallback(){
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.get('type')==='recovery')return {token:params.get('access_token')};
 if(params.has('error_description'))return {token:null};
 return null;
}
let recoveryCallback=readRecoveryCallback();
let recoveryUserId=null;
const sb=cfg.VITE_SUPABASE_URL&&cfg.VITE_SUPABASE_PUBLISHABLE_KEY?createClient(cfg.VITE_SUPABASE_URL,cfg.VITE_SUPABASE_PUBLISHABLE_KEY):null;
const S={session:null,me:null,site:null,mine:null,admin:null,referrals:null,q:'',searchByNumber:false,currentReviews:null},app=document.getElementById('app');
let refQuery=(new URLSearchParams(location.search).get('ref')||'').trim().toUpperCase();
if(/^[A-Z0-9]{12}$/.test(refQuery)){try{localStorage.setItem('repartes_referral',refQuery)}catch{}}
const pendingRef=()=>{try{return localStorage.getItem('repartes_referral')||refQuery}catch{return refQuery}};
const refUrl=()=>location.origin+location.pathname+'?ref='+encodeURIComponent(S.referrals?.code||'')+'#login/signup';
async function claimRef(){
 if(!S.session)return;
 const code=pendingRef()||String(S.session?.user?.user_metadata?.referral_code||'').toUpperCase();
 if(!/^[A-Z0-9]{12}$/.test(code))return;
 try{await api('referral.claim','POST',{code});}
 catch(e){console.info('Referido no asociado:',e.message);}
 finally{refQuery='';try{localStorage.removeItem('repartes_referral')}catch{}}
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(name,label,value='',type='text',required=true)=>`<label>${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required?'required':''}></label>`;
const date=s=>s?new Date(s).toLocaleDateString('es-US'):'—';
function toast(msg){window.alert(msg)}
const SOCIAL_NETWORKS=[['x','X'],['telegram','Telegram'],['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],['threads','Threads'],['pinterest','Pinterest'],['linkedin','LinkedIn']];
const socialLinks=()=>{const links=S.site?.settings?.social_links||{};const publicProfiles=SOCIAL_NETWORKS.filter(([k])=>links[k]);return publicProfiles.length?'<div class="social-profiles"><strong>Follow RePartes USA:</strong> '+publicProfiles.map(([k,label])=>'<a href="'+esc(links[k])+'" target="_blank" rel="noopener noreferrer nofollow">'+esc(label)+'</a>').join(' · ')+'</div>':''};
function commercialOffers(placement){
 const offers=Array.isArray(S.site?.settings?.monetization_offers)?S.site.settings.monetization_offers:[];
 const shown=offers.filter(x=>x&&x.placement===placement&&['affiliate','sponsored'].includes(x.kind)&&/^https:\/\//.test(x.url||''));
 if(!shown.length)return '';
 return '<section class="section offers"><div class="eyebrow">Commercial partners</div><h2>Useful links from partners</h2><p>Paid advertising and affiliate links are identified. RePartes USA may earn a commission from qualifying purchases made through affiliate links, at no extra charge to you. External providers set their own prices and terms.</p><div class="offer-grid">'+shown.map(x=>'<article class="offer-card"><div class="offer-kind">'+(x.kind==='affiliate'?'Affiliate link':'Sponsored placement')+'</div><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><a class="secondary" href="'+esc(x.url)+'" target="_blank" rel="sponsored nofollow noopener noreferrer" data-analytics-link="partner_click">Visit partner website ↗</a></article>').join('')+'</div></section>';
}
// Keep the affiliate offer draft across auth refreshes and mobile tab reloads.
const OFFER_DRAFT_FIELDS=['kind','placement','title','url','description'];
const offerDraftKey=()=>S.session?.user?.id?'repartes:offer-draft:v1:'+S.session.user.id:null;
function saveOfferDraft(){
 const form=document.getElementById('offeradd'),key=offerDraftKey();
 if(!form||!key||form.dataset.draftUser!==S.session.user.id)return;
 const values={};for(const name of OFFER_DRAFT_FIELDS)values[name]=form.elements.namedItem(name)?.value||'';
 try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),values,offerId:form.dataset.id||'',scrollY:window.scrollY}));}catch{/* Storage may be unavailable; keep the form usable. */}
}
function clearOfferDraft(){
 const key=offerDraftKey();if(!key)return;
 try{localStorage.removeItem(key);}catch{}
}
function setOfferMode(form,id=''){
 form.dataset.id=id;
 form.querySelector('h3').textContent=id?'Edit affiliate or sponsor offer':'Add a genuine commercial offer';
 form.querySelector('button[type="submit"]').textContent=id?'Save offer changes':'Add approved partner offer';
 form.querySelector('[data-act="offercancel"]').hidden=!id;
}
function restoreOfferDraft(){
 const form=document.getElementById('offeradd'),key=offerDraftKey();if(!form||!key)return;
 form.dataset.draftUser=S.session.user.id;
 try{
  const raw=localStorage.getItem(key);if(!raw)return;
  const draft=JSON.parse(raw);
  if(!draft||!Number.isFinite(draft.savedAt)||Date.now()-draft.savedAt>7*86400000){clearOfferDraft();return;}
  if(draft.offerId){
   if(!(S.admin?.settings?.monetization_offers||[]).some(x=>x.id===draft.offerId)){clearOfferDraft();return;}
   setOfferMode(form,draft.offerId);
  }
  for(const name of OFFER_DRAFT_FIELDS){
   const input=form.elements.namedItem(name),value=draft.values?.[name];
   if(input&&typeof value==='string'&&(input.tagName!=='SELECT'||Array.from(input.options).some(x=>x.value===value)))input.value=value;
  }
  // Consent is deliberately confirmed again by the owner, never saved in storage.
  if(Number.isFinite(draft.scrollY)&&draft.scrollY>=0)requestAnimationFrame(()=>{if(form.isConnected)window.scrollTo(0,draft.scrollY)});
 }catch{/* Ignore malformed drafts or unavailable storage. */}
}
document.addEventListener('input',ev=>{if(ev.target.closest?.('#offeradd'))saveOfferDraft()});
document.addEventListener('change',ev=>{if(ev.target.closest?.('#offeradd'))saveOfferDraft()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveOfferDraft()});
window.addEventListener('pagehide',saveOfferDraft);
const languageSelector=()=>`<label class="language-label">Language / Idioma <select id="language" aria-label="Website language">${LANGUAGES.map(([code,name])=>`<option value="${code}" ${currentLanguage===code?'selected':''}>${name}</option>`).join('')}</select></label>`;
const backButton=()=>`<button type="button" data-back-button aria-label="${currentLanguage==='es'?'Volver a la página anterior':'Go back to the previous page'}">${currentLanguage==='es'?'← Volver':'← Back'}</button>`;
let stopOwnerAnalytics;
function layout(inner,{showBack=!['','home','catalog'].includes(marketplaceRoute()[0])}={}){
 stopOwnerAnalytics?.();
 stopOwnerAnalytics=undefined;
 saveOfferDraft();
 if(isOwnerPage){
  app.innerHTML=`<header class="header"><a href="/#home" class="logo"><span class="logo-mark" aria-hidden="true">R</span> REPARTES <em>USA</em></a><nav>${backButton()}<a href="/#home">Explorar piezas</a>${S.session?'<button data-act="logout">Salir</button>':''}${languageSelector()}</nav></header><main>${inner}</main><footer><p><small>© 2026 RePartes USA. Todos los derechos reservados.</small></p></footer>`;
  localize(app,currentLanguage);
  restoreOfferDraft();
  return;
 }
 const nav=S.session?'<a href="#orders">Mis pedidos</a><a href="#sell">Vender</a><a href="#referrals">Referidos</a><button data-act="logout">Salir</button>' :'<a href="#referrals">Referidos</a><a href="#login">Iniciar sesión</a><a href="#login/signup">Sign up</a>';
 app.innerHTML=`<header class="header"><a href="#home" class="logo"><span class="logo-mark" aria-hidden="true">R</span> REPARTES <em>USA</em></a><nav><a href="#home">Explorar piezas</a>${nav}<a href="#contact/support">${currentLanguage==='es'?'Soporte':'Support'}</a>${languageSelector()}</nav></header><div class="page-navigation">${showBack?backButton():''}<button type="button" class="request-launcher" data-request-part>Request a part</button></div><main>${inner}</main><footer><b>REPARTES USA</b><p>Marketplace de autopartes en Estados Unidos.</p><p>Las compras de anuncios de eBay se completan en eBay.</p><div class="footer-nav"><a href="#about">Sobre nosotros</a><a href="#contact">Contacto</a><a href="#shipping">Envíos y devoluciones</a><a href="#referrals">Referidos</a><a href="#privacy">Privacidad</a><a href="#terms">Términos</a><a href="#advertising">Publicidad y afiliados</a><a href="/guides/${currentLanguage==='es'?'comprar-piezas-usadas':'used-auto-parts'}.html">Auto parts buying guide</a></div>${socialLinks()}<p><small>© 2026 RePartes USA. Todos los derechos reservados.</small></p></footer>`;
 localize(app,currentLanguage);
 restoreOfferDraft();
 document.dispatchEvent(new Event('repartes:page'));
}
async function api(action,method='GET',body,{signal}={}){
 const headers={};
 if(method==='POST')headers['Content-Type']='application/json';
 if(S.session?.access_token)headers.Authorization='Bearer '+S.session.access_token;
 const query=new URLSearchParams({action});if(method==='GET'&&body)for(const [key,val] of Object.entries(body))query.set(key,String(val));
 const r=await fetch('/api/market?'+query.toString(),{method,headers,body:method==='POST'&&body?JSON.stringify(body):undefined,cache:'no-store',signal});
 let data;try{data=await r.json()}catch{throw Error('No hay respuesta válida del servidor ('+r.status+').')}
 if(!r.ok)throw Error(data.error||'Error '+r.status);
 return data;
}
const showReviews=()=>S.currentReviews?reviewList(S.currentReviews):'<p>Reviews are temporarily unavailable.</p>';
const statusBadge=s=>`<span class="pill">${esc(s)}</span>`;
let partnerSearchTimer,partnerSearchController,lastMeasuredSearch;
function catalogMatches(){
 const settings=S.site?.settings||{};
 return {
  listings:(S.site?.listings||[]).filter(x=>S.searchByNumber?matchesPartNumber(x,S.q):matchesSearch(x,S.q)),
  offers:S.searchByNumber?[]:publishedOffers(settings).filter(x=>matchesSearch(x,S.q))
 };
}
function noCatalogMatches(){
 const {listings,offers}=catalogMatches();
 return !listings.length&&!offers.length;
}
let openLocalMap;
const mapLink='<button type="button" class="secondary" data-local-map="search">Search nearby stores</button>';
const emptyResults='<div class="empty"><h3>No matching parts found.</h3><p>Try a part number or request help finding the part.</p><button class="secondary" data-request-part data-request-from-search>Request a part</button>'+mapLink+'</div>';
function catalogResults(){
 if(S.searchByNumber&&!normalizePartNumber(S.q))return '';
 if(!S.site)return '<p>Seller inventory is temporarily unavailable.</p>';
 const {listings,offers}=catalogMatches();
 if(!listings.length&&!offers.length)return '';
 const listingCard=x=>`<a class="product" href="#part/${esc(x.id)}"><img src="${esc(x.image_url)}" alt="${esc(x.title)}" loading="lazy"><div><small>Seller listing · ${esc(x.make)} ${esc(x.model)} · ${esc(x.year_min)}–${esc(x.year_max)}</small><h3>${esc(x.title)}</h3><p>${esc(x.shop_name)}</p>${S.searchByNumber?`<p data-no-translate>${esc(x.part_number)}</p>`:''}<strong>${money(x.price_cents)}</strong></div></a>`;
 const offerCard=x=>`<article class="offer-card"><div class="offer-kind">${x.kind==='affiliate'?'Affiliate link':'Sponsored placement'}</div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><a class="secondary" href="${esc(x.url)}" target="_blank" rel="sponsored nofollow noopener noreferrer" data-analytics-link="partner_click">View on partner website ↗</a><small>Check current price, availability and vehicle fitment with the provider.</small></article>`;
 return `<p class="search-count" role="status">${listings.length} seller listing${listings.length===1?'':'s'} · ${offers.length} partner offer${offers.length===1?'':'s'}${S.q?' matching “'+esc(S.q)+'”':''}</p>${listings.length?'<h3>Seller inventory</h3><div class="grid">'+listings.map(listingCard).join('')+'</div>':''}${offers.length?'<h3>Partner offers</h3><p>RePartes USA may earn a commission from qualifying purchases through affiliate links, at no extra charge to you. Purchases are completed on the partner website.</p><div class="offer-grid">'+offers.map(offerCard).join('')+'</div>':''}`;
}
function updateCatalogResults(){
 const area=document.getElementById('catalog-results');if(area){area.innerHTML=catalogResults();localize(area,currentLanguage);}
}
function setPartnerResults(area,markup){
 area.innerHTML=markup;
 localize(area,currentLanguage);
}
async function updatePartnerResults(trackSearch=false){
 clearTimeout(partnerSearchTimer);
 partnerSearchController?.abort();
 const area=document.getElementById('partner-results');
 if(!area)return;

 const q=S.q.trim();
 const byNumber=S.searchByNumber;
 const featured=!byNumber&&q.length===0;
 if(!featured&&(q.length<2||(byNumber&&!normalizePartNumber(q)))){area.innerHTML='';return;}
 const searchKey=JSON.stringify([q.toLowerCase(),byNumber]);
 const measured=trackSearch&&!featured&&(lastMeasuredSearch?.key!==searchKey||Date.now()-lastMeasuredSearch.at>5000);
 if(measured){
  lastMeasuredSearch={key:searchKey,at:Date.now()};
  window.repartesAnalytics?.track(byNumber?'oem_search':'search');
 }
 const heading=featured?'Featured parts from eBay':byNumber?'Part-number search on eBay · Affiliate links':'eBay inventory · Affiliate links';
 setPartnerResults(area,`<h2>${heading}</h2><p>${featured?'Loading featured parts…':'Searching eBay…'}</p>`);
 const controller=new AbortController();
 partnerSearchController=controller;
 const isCurrent=()=>!controller.signal.aborted&&S.q.trim()===q&&S.searchByNumber===byNumber&&area.isConnected;
 const params=new URLSearchParams(featured?{featured:'1'}:{q});

 try{
  const response=await fetch('/api/partner-search?'+params,{signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error('supplier');
  const data=await response.json();
  if(!isCurrent())return;
  if(data.status!=='connected'||!Array.isArray(data.items))throw Error('supplier');
  if(!data.items.length){
   if(featured)area.innerHTML='';
   else {
    if(trackSearch&&S.site&&noCatalogMatches()&&lastMeasuredSearch?.key===searchKey&&!lastMeasuredSearch.noResults){
     lastMeasuredSearch.noResults=true;
     window.repartesAnalytics?.track('no_results');
    }
    setPartnerResults(area,S.site&&noCatalogMatches()?emptyResults:'<p>No matching listings on eBay.</p>');
   }
   return;
  }
  const cards=data.items.map(x=>`<article class="product ebay-card">
   ${x.image?`<img src="${esc(x.image)}" alt="" loading="lazy">`:''}
   <div class="ebay-card-body">
    <small><b>eBay</b>${x.condition?' · '+esc(x.condition):''}</small>
    <h3 data-no-translate>${esc(x.title)}</h3>
    <strong>${money(Math.round(x.price*100))}</strong>
    <a class="secondary" href="${esc(x.url)}" rel="sponsored nofollow noopener noreferrer" target="_blank" data-analytics-link="ebay_click">View on eBay</a>
   </div>
  </article>`).join('');
  setPartnerResults(area,`<h2>${heading}</h2>${byNumber?'<p>Confirm the part number in the eBay listing before buying.</p>':''}<p>Check current price, availability, fitment and shipping on eBay. We may earn a commission from qualifying purchases.</p><div class="grid ebay-grid">${cards}</div>`);
 }catch{
  if(!isCurrent())return;
  const message=featured?'Featured eBay parts are temporarily unavailable.':'eBay search is temporarily unavailable. Try again shortly.';
  const requestButton=!featured&&noCatalogMatches()
   ? '<button class="secondary" data-request-part data-request-from-search>Request a part</button>'+mapLink
   : '';
  setPartnerResults(area,`<p>${message}</p>${requestButton}`);
 }
}

function home(){
 const st=S.site?.settings||{};
 layout(`
  <section class="search-hero">
   <div class="search-hero-inner">
    <h1>${esc(st.hero_title||'Keep your vehicle moving.')}</h1>
    <form id="part-search" role="search" class="hero-search">
     <label for="search"><span id="search-label">${S.searchByNumber?'Enter the full part number':'What part are you looking for?'}</span>
      <input id="search" name="q" type="search" maxlength="150" autocomplete="off" placeholder="${S.searchByNumber?'Example: AB-1234':'Part, vehicle or part number'}" value="${esc(S.q)}" aria-controls="catalog-results partner-results">
     </label>
     <button class="primary" type="submit">Find my part</button>
    </form>
    <div class="search-hints">
     <button type="button" data-local-map="browse">Nearby mechanics and parts stores</button>
     <button type="button" id="part-number-mode" aria-pressed="${S.searchByNumber}">Search by OEM number</button>
     <button type="button" data-search-term="brake pads">Brake pads</button>
     <button type="button" data-search-term="alternator">Alternator</button>
     <button type="button" data-search-term="turbo Duramax">Turbo Duramax</button>
    </div>
   </div>
  </section>
  <aside class="section seller-invite"><div><h2>Have auto parts to sell?</h2><p>Apply for a seller account, then list your parts with original photos, prices and vehicle details. Listings are reviewed before publication.</p></div><a class="primary" href="#sell">Sell your parts</a></aside>
  <section class="section shop-catalog" id="catalog" aria-label="${currentLanguage==='es'?'Catálogo de piezas':'Parts catalog'}">
   <div id="partner-results" aria-live="polite"></div>
   <div id="catalog-results">${catalogResults()}</div>
  </section>
  ${localMapMarkup(currentLanguage==='es',commercialOffers('map'))}
  <section class="section buyer-section">
   <h2>Auto parts buying guide</h2>
   <p>Compare part numbers, review the condition, and confirm the return terms with the seller or partner.</p>
   <a class="secondary" href="/guides/${currentLanguage==='es'?'comprar-piezas-usadas':'used-auto-parts'}.html">Read the parts buying guide</a>
  </section>
  <section class="section"><h2>Website reviews</h2><p><a class="primary" href="#feedback">Rate the website</a></p>${showReviews()}</section>`,{showBack:false});
 openLocalMap=mountLocalMap(document.getElementById('local-map'),currentLanguage==='es',()=>S.q);
 if(marketplaceRoute()[1]==='map')openLocalMap(false);
 void updatePartnerResults();
}

function part(id){
 const x=S.site?.listings?.find(z=>z.id===id);
 if(!S.site){layout('<section class="section empty"><p>Seller inventory is temporarily unavailable.</p><button data-act="retry">Reintentar</button></section>');return}
 if(!x){layout('<section class="section empty">Pieza no disponible. <a href="#home">Volver</a></section>');return}
 const on=!!S.site.settings?.payments_enabled;
 layout(`<section class="section"><a href="#home">← Volver al catálogo</a><div class="detail"><img src="${esc(x.image_url)}" alt="${esc(x.title)}"><article><div class="eyebrow">${esc(x.make)} · ${esc(x.model)}</div><h1>${esc(x.title)}</h1><h2>${money(x.price_cents)}</h2><p>Condición: ${esc(x.condition)} · Años: ${esc(x.year_min)}–${esc(x.year_max)}</p><p>Número de pieza: ${esc(x.part_number||'No especificado')}</p><p>Vendedor: ${esc(x.shop_name)}</p>${x.public_contact_enabled&&x.contact_email?'<p>Business email: <a href="mailto:'+encodeURIComponent(x.contact_email)+'">'+esc(x.contact_email)+'</a></p>':''}${x.public_contact_enabled&&x.contact_phone?'<p>Business phone: <a href="tel:'+esc(x.contact_phone)+'">'+esc(x.contact_phone)+'</a></p>':''}<button class="primary" data-act="checkout" data-id="${esc(x.id)}" ${on?'':'disabled'}>${on?'Comprar esta pieza':'Compras desactivadas'}</button><p>Envío incluido en el precio anunciado. Verifica la compatibilidad antes de comprar. <a href="#shipping">Devoluciones: solicita dentro de 30 días desde la entrega.</a></p></article></div><article class="panel"><h2>Descripción del vendedor</h2><p>${esc(x.description)}</p></article>${commercialOffers('part')}<h2>Verified buyer reviews</h2><p>Only customers with a paid order can rate a part.</p>${showReviews()}</section>`);
}
function signInForm(){
 return `<form class="panel" id="signin"><h2>Iniciar sesión</h2>${field('email','Correo electrónico','','email')}${field('password','Contraseña','','password')}<button class="primary">Entrar</button><p><a href="/#login/forgot">Forgot password?</a></p></form>`;
}
function passwordRecovery(mode){
 const reset=mode==='reset';
 const valid=recoveryUserId && recoveryUserId===S.session?.user?.id;
 const fields=reset
  ? '<label>New password (at least 10 characters)<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><label>Confirm new password<input name="confirm" type="password" minlength="10" autocomplete="new-password" required></label><button class="primary">Save new password</button>'
  : '<p>Enter the email address you used to sign up.</p><label>Email address<input name="email" type="email" autocomplete="email" required></label><button class="primary">Send reset link</button>';
 const body=reset&&!valid
  ? '<p>This reset link is no longer available.</p><a href="#login/forgot">Request a new link</a>'
  : `<form class="panel" id="${reset?'reset-password':'forgot-password'}">${fields}<p role="status" aria-live="polite"></p></form>`;
 layout(`<section class="section"><h1>${reset?'Choose a new password':'Reset your password'}</h1>${body}<p><a href="#login">Back to sign in</a></p></section>`);
}
function login(){
 const [page,mode]=marketplaceRoute();
 if(mode==='forgot'||mode==='reset'){passwordRecovery(mode);return}
 const base=page==='sell'?'#sell':'#login';
 const registering=mode==='signup';
 const form=registering
  ? `<form class="panel" id="signup"><h2>Sign up</h2>${field('display_name','Nombre')}${field('email','Correo','','email')}${field('password','Contraseña (mín. 10 caracteres)','','password')}<button class="primary">Sign up</button><p>Si es necesario, confirma tu dirección de correo.</p></form>`
  : signInForm();
 const switchForm=registering
  ? `Already have an account? <a href="${base}">Iniciar sesión</a>`
  : `New to RePartes USA? <a href="${base}/signup">Sign up</a>`;
 layout(`<section class="section"><h1>Tu cuenta RePartes USA</h1>${form}<p>${switchForm}</p></section>`);
}
function feedback(){
 if(!S.session){layout(authWall);return}
 layout('<section class="section"><h1>Review RePartes USA</h1><p>Rate your experience using this website. This is not a verified purchase review.</p>'+reviewForm('website')+'</section>');
}
function reviewOrder(id){
 if(!S.session){layout(authWall);return}
 const order=(S.mine?.purchases||[]).find(x=>x.id===id&&['paid','shipped'].includes(x.status));
 if(!order){layout('<section class="section empty">Only buyers with a paid order can review a part.</section>');return}
 layout('<section class="section"><h1>Rate your purchased part</h1><p>'+esc(order.listings?.title||'Part')+'</p>'+reviewForm('part',order.id)+'</section>');
}
const authWall='<section class="section empty">Inicia sesión para continuar. <a href="#login">Entrar</a></section>';
function sell(){
 if(!S.session){login();return}
 const seller=S.me?.seller,m=S.mine||{listings:[],sales:[]};
 const apply=`<form id="seller" class="panel"><h2>${S.me?.is_owner?'Create my own store':'Solicitar cuenta de vendedor'}</h2>${S.me?.is_owner?'<p>Your own sales settle through the main Stripe account. No extra Express account or internal commission.</p>':''}${field('shop_name','Nombre de la tienda',S.me?.is_owner?'RePartes USA Official Parts':'')}<button class="primary">${S.me?.is_owner?'Create my own store':'Solicitar revisión'}</button></form>`;
 const publish=`<form class="panel" id="listing"><h2>Publicar pieza</h2><p>Todos los anuncios requieren aprobación del Owner.</p>${field('title','Nombre de la pieza')}${field('make','Marca del auto')}${field('model','Modelo del auto')}${field('year_min','Año desde','2010','number')}${field('year_max','Año hasta','2020','number')}${field('part_number','Número de pieza','','text',false)}${field('price','Precio USD, envío incluido','49.99')}<label>Condición<select name="condition"><option value="used">Usada</option><option value="remanufactured">Remanufacturada</option><option value="new">Nueva</option></select></label><label>Fotografía original de la pieza (JPG, PNG o WebP, hasta 5 MB)<input name="part_photo" type="file" accept="image/jpeg,image/png,image/webp"></label><input name="image_url" type="hidden"><p>Sube la foto auténtica de tu artículo, tomada con tu teléfono. No se permiten imágenes de catálogo, IA ni artículos que no tengas.</p><label class="check"><input type="checkbox" name="seller_has_item" required> Confirmo que tengo físicamente esta pieza, lista para enviar.</label><label class="check"><input type="checkbox" name="original_photo_attested" required> Confirmo que la foto es original y corresponde exactamente al artículo.</label><label>Descripción<textarea name="description" rows="5" required></textarea></label><h3>Seller contact (optional)</h3><p>Publish business contact details only if you want buyers to see them. Never use private personal details.</p>${field('contact_email','Business email (optional)','','email',false)}${field('contact_phone','Business phone (optional)','','tel',false)}<label class="check"><input type="checkbox" name="public_contact_enabled"> I agree to show this contact information publicly on my part listing.</label><button class="primary">Enviar para aprobación</button></form>`;
 const rows=(m.listings||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${money(x.price_cents)}</td><td>${statusBadge(x.status)}</td><td>${['pending','approved','rejected'].includes(x.status)?`<button data-act="edit" data-id="${esc(x.id)}">Editar</button> <button data-act="withdraw" data-id="${esc(x.id)}">Retirar del mercado</button>`:'—'}</td></tr>`).join('');
 const sales=(m.sales||[]).map(x=>`<tr><td>${esc(x.listings?.title||'Pieza')}</td><td>${money(x.amount_cents)}</td><td>${statusBadge(x.status)}</td><td>${x.status==='paid'?`<button data-act="ship" data-id="${esc(x.id)}">Registrar tracking</button>`:esc(x.tracking_code||'—')}</td></tr>`).join('');
 layout(`<section class="section"><h1>Centro de vendedores</h1>${!seller?apply:`<div class="panel"><h2>${esc(seller.shop_name)} ${statusBadge(seller.status)}</h2><p>${seller.is_platform_store?'Owner store: paid to the main Stripe account, no internal commission.':'Stripe Connect: '+(seller.account_ready?'Listo':'Pendiente de configurar')}</p><p>Commission for this store: ${(seller.commission_bps/100).toFixed(2)}%</p>${seller.is_platform_store?'':'<button data-act="connect">Conectar Stripe para recibir pagos</button>'}</div>${publish}<h2>Mis anuncios</h2>${table(['Pieza','Precio','Estado','Acción'],rows)}<h2>Ventas</h2>${table(['Pieza','Precio','Estado','Envío'],sales)}`}</section>`);
}
const table=(heads,rows)=>`<div class="tablewrap"><table><thead><tr>${heads.map(x=>'<th>'+esc(x)+'</th>').join('')}</tr></thead><tbody>${rows||'<tr><td colspan="'+heads.length+'">Sin registros</td></tr>'}</tbody></table></div>`;
function orders(){
 if(!S.session){layout(authWall);return}
 const returns=S.mine?.returns||[];
 const rows=(S.mine?.purchases||[]).map(x=>{
  const r=returns.find(y=>y.order_id===x.id),day=x.delivered_at?Date.parse(x.delivered_at+'T00:00:00Z'):NaN;
  const age=Number.isFinite(day)?Math.floor((Date.now()-day)/86400000):NaN;
  const action=r?statusBadge('Devolución '+r.status)+(r.status==='approved'?' <button data-act="returntracking" data-id="'+esc(r.id)+'">Registrar envío de retorno</button>':''):
   x.status==='shipped'&&age>=0&&age<=30?'<a href="#return/'+esc(x.id)+'">Solicitar devolución</a>':
   x.status==='shipped'?'<a href="#contact">Contactar soporte</a>':'—';
  return `<tr><td>${esc(x.listings?.title||'Pieza')}</td><td>${money(x.amount_cents)}</td><td>${statusBadge(x.status)}</td><td>${esc(x.tracking_code||'—')}</td><td>${esc(x.delivered_at||'—')}</td><td>${action} ${['paid','shipped'].includes(x.status)?'<a href="#review/'+esc(x.id)+'">Rate purchased part</a>':''}</td></tr>`;
 }).join('');
 layout(`<section class="section"><h1>Mis pedidos</h1><p>Solicitudes de devolución: 30 días naturales desde la entrega confirmada. <a href="#shipping">Leer política</a>.</p>${table(['Pieza','Importe','Estado','Tracking','Entregado','Devolución'],rows)}</section>`);
}
function returnForm(id){
 if(!S.session){layout(authWall);return}
 const order=(S.mine?.purchases||[]).find(x=>x.id===id);
 if(!order){layout('<section class="section empty">Pedido no disponible. <a href="#orders">Volver</a></section>');return}
 if((S.mine?.returns||[]).some(x=>x.order_id===id)){layout('<section class="section empty">Ya existe una solicitud de devolución para este pedido. <a href="#orders">Volver</a></section>');return}
 layout(`<section class="section"><a href="#orders">← Mis pedidos</a><h1>Solicitar devolución</h1><p>Pedido ${esc(id)} · ${esc(order.listings?.title||'Autoparte')} · Entrega: ${esc(order.delivered_at||'pendiente')}</p><form id="returnrequest" class="panel" data-id="${esc(id)}"><label>Motivo<select name="reason" required><option value="damaged">Dañado al llegar</option><option value="defective">Defectuoso</option><option value="wrong_item">Pieza equivocada</option><option value="not_as_described">No coincide con el anuncio</option><option value="incompatible">Incompatibilidad</option><option value="changed_mind">Cambio de opinión</option><option value="other">Otro</option></select></label><label>Explica el caso (mínimo 20 caracteres)<textarea name="details" rows="5" minlength="20" maxlength="2000" required></textarea></label>${field('evidence_url','Enlace HTTPS a foto de evidencia (opcional)','','url',false)}<p>Espera la autorización e instrucciones antes de devolver la pieza.</p><button class="primary">Solicitar revisión</button></form></section>`);
}
function referrals(){
 if(!S.session){layout('<section class="section"><h1>Programa de referidos RePartes USA</h1><p>Invita a personas nuevas mediante un enlace personal. Por ahora no hay dinero, puntos ni descuentos prometidos por las invitaciones.</p><a class="primary" href="#login/signup">Crear una cuenta</a></section>');return}
 const r=S.referrals||{code:'',invites:0,qualified:0,recent:[]};
 layout(`<section class="section"><div class="eyebrow">INVITA Y COMPARTE</div><h1>Mi enlace de referidos</h1><p>Invita a nuevos usuarios y consulta sus registros y compras verificadas. Los referidos no generan pagos ni bonificaciones automáticas.</p><div class="metrics"><article class="metric"><small>Invitados registrados</small><strong>${esc(r.invites)}</strong></article><article class="metric"><small>Invitados con compra</small><strong>${esc(r.qualified)}</strong></article></div><div class="panel"><h2>Tu enlace personal</h2><input readonly aria-label="Enlace de referidos" value="${esc(refUrl())}"><button class="primary" data-act="copyref">Copiar enlace</button><p>No hay recompensa económica activa.</p></div><h2>Invitaciones recientes</h2>${table(['Fecha','Estado'],(r.recent||[]).map(x=>`<tr><td>${date(x.date)}</td><td>${x.qualified?'Compra confirmada':'Registrado'}</td></tr>`).join(''))}</section>`);
}
async function showOwnerUser(id){
 const dialog=document.createElement('dialog');
 dialog.className='panel';
 dialog.style.cssText='width:min(30rem,92vw);max-height:85vh;overflow:auto;margin:auto;overflow-wrap:anywhere';
 dialog.setAttribute('aria-labelledby','registered-user-title');
 dialog.innerHTML='<h2 id="registered-user-title">Registered user</h2><div aria-live="polite">Loading account details…</div><form method="dialog"><button type="submit" autofocus>Close</button></form>';
 app.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.showModal();
 const content=dialog.querySelector('[aria-live]');
 try{
  const u=await api('owner.user','GET',{id});
  if(!dialog.isConnected)return;
  const date=value=>value?new Date(value).toLocaleString('en-US'):null;
  const rows=[['Display name',u.name],['Email',u.email],['Email confirmed',u.emailConfirmed?'Yes':'No'],
   ['Account status',u.suspended?'Suspended':'Active'],['Registered',date(u.joined)],['Last sign-in',date(u.lastSignIn)||'No sign-in recorded']];
  if(u.shop)rows.push(['Shop name',u.shop.shop_name],['Seller status',u.shop.status]);
  content.innerHTML='<dl>'+rows.map(([label,value])=>`<dt><strong>${label}</strong></dt><dd>${esc(value||'Not provided')}</dd>`).join('')+'</dl>';
 }catch{content.textContent='Account details could not be loaded. Close this window and try again.'}
}
const actionButton=(type,id,status,label)=>`<button data-act="${type}" data-id="${esc(id)}" data-status="${esc(status)}">${esc(label)}</button>`;
function owner(){
 if(!S.me?.is_owner){
  const spanish=currentLanguage==='es';
  if(S.session){
   layout(`<section class="section"><h1>${spanish?'Acceso restringido':'Access restricted'}</h1><p>${spanish?'Tu cuenta no tiene acceso a esta página.':'Your account does not have access to this page.'}</p><a class="primary" href="/#home">Explorar piezas</a></section>`);
   return;
  }
  layout(`<section class="section"><h1>${spanish?'Acceso privado':'Private sign-in'}</h1>${signInForm()}</section>`);
  return;
 }
 const d=S.admin||{metrics:{},settings:{},sellers:[],listings:[],users:[],orders:[],returns:[],referrals:[],audit:[]},m=d.metrics||{},settings=d.settings||{};
 const quotePanel='<section class="panel"><h2>Part requests</h2><p>Private requests from visitors. Review the vehicle details and availability before contacting the customer.</p><div class="request-inbox">'+((S.partRequests||[]).map(q=>`<article class="request-inbox-card"><div class="flex"><strong>${esc(q.vehicle_year)} ${esc(q.make)} ${esc(q.model)}</strong>${statusBadge(q.status)}</div><h3>${esc(q.part)}</h3><p>${esc(q.details||'No additional details.')}</p>${q.zip_code?`<p><span>ZIP code</span> ${esc(q.zip_code)}</p>`:''}<p>${esc(q.contact_name)} · <a href="mailto:${encodeURIComponent(q.email)}">${esc(q.email)}</a>${q.phone?' · <a href="tel:'+encodeURIComponent(q.phone)+'">'+esc(q.phone)+'</a>':''}</p><small>${date(q.created_at)}</small><div class="flex">${actionButton('quotestatus',q.id,'reviewing','Mark reviewing')} ${actionButton('quotestatus',q.id,'closed','Close request')} ${q.status!=='new'?actionButton('quotestatus',q.id,'new','Reopen'):''}</div>${ownerQuoteTools(q,esc)}</article>`).join('')||'<p>No part requests yet.</p>')+'</div></section>';
 const testState=S.checkoutTest||{},testRecord=testState.record;
 const testPassed=Boolean(testRecord?.paid_webhook_at&&testRecord?.refund_webhook_at&&testRecord?.status==='refunded');
 const testPanel=`<section class="panel"><h2>Payment launch checklist</h2><p>Server environment: <strong>${esc(testState.mode||'disabled')}</strong>. Customer payments: <strong>${settings.payments_enabled?'enabled':'off'}</strong>.</p><h3>Private purchase and refund test</h3><p>This uses $10 in Stripe test funds. No real card or physical inventory is needed. Test records are separate from marketplace sales.</p><p>Status: <strong>${testPassed?'Payment and refund webhooks verified':esc(testRecord?.status||'Not started')}</strong></p><p>Payment webhook: ${testRecord?.paid_webhook_at?'received':'pending'} · Refund webhook: ${testRecord?.refund_webhook_at?'received':'pending'}</p>${testState.mode==='test'&&testState.configured?'<button class="primary" data-act="checkoutteststart">Open private test checkout</button> '+(testRecord?.paid_webhook_at&&!testRecord.refund_webhook_at?'<button data-act="checkouttestrefund">Refund test payment</button> ':''):'<p>Test checkout requires CHECKOUT_MODE=test and a server-side test key.</p>'}<button data-act="retry">Refresh test results</button><h3>Real inventory</h3><p>Only publish parts that a seller actually has, using original photos and accurate compatibility, condition and price.</p><a href="/#sell">Submit a real part</a></section>`;
 const cards=[['Ventas cobradas',money(m.gross_cents)],['Comisiones brutas',money(m.commission_cents)],['Pedidos',m.orders_paid||0],['Anuncios pendientes',m.listings_pending||0],['Vendedores pendientes',m.sellers_pending||0],['Usuarios',m.buyers_total||0],['Referidos registrados',d.referral_stats?.registered||0],['Referidos compradores',d.referral_stats?.qualified||0]];
 const socials=settings.social_links||{};
 const socialForm='<form class="panel" id="socialsettings"><h2>Official social media profiles</h2><p>Add each of your official social accounts whenever you create one. Empty links stay hidden. No social media account is used for sign-in.</p>'+SOCIAL_NETWORKS.map(([k,name])=>field(k,name+' profile URL',socials[k]||'','url',false)).join('')+'<button class="primary">Save official social links</button></form>';
 const offers=Array.isArray(settings.monetization_offers)?settings.monetization_offers:[];
 const publisher=settings.adsense_publisher_id||'';
 const adsPanel='<form class="panel" id="adssettings"><h2>Advertising — Google AdSense Auto ads</h2><p>Ads are OFF by default. Saving your real publisher ID enables ads.txt verification; it does NOT activate ads. Google must approve this site, and consent/privacy settings must be completed before turning ads on. No income is guaranteed.</p>'+field('adsense_publisher_id','Your real AdSense publisher ID (ca-pub-XXXXXXXXXXXXXXXX)',publisher,'text',false)+'<p><a href="/ads.txt" target="_blank" rel="noopener">Check public ads.txt ↗</a> · <a href="https://adsense.google.com/" target="_blank" rel="noopener noreferrer">Open Google AdSense ↗</a></p><label class="check"><input name="adsense_enabled" type="checkbox" '+(settings.adsense_enabled?'checked':'')+'> Enable automatic ads on public pages (not account / Owner pages)</label><label class="check"><input name="confirm_approved" type="checkbox"> I confirm that AdSense shows this site as Ready / approved</label><label class="check"><input name="confirm_privacy" type="checkbox"> I confirm I configured required Google CMP / privacy messages and reviewed applicable laws</label><button class="primary">Save advertising settings</button></form>';
 const offerRows=offers.map(x=>'<article class="offer-card"><div class="offer-kind">'+esc(x.kind)+' · '+esc(x.placement)+'</div><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><p><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.url)+'</a></p><button type="button" data-act="offeredit" data-id="'+esc(x.id)+'">Edit offer</button> <button type="button" data-act="offerremove" data-id="'+esc(x.id)+'">Remove offer</button></article>').join('');
 const offersPanel='<section class="panel"><h2>Affiliate & sponsor partners</h2><p>Only add valid affiliate tracking links from networks that accepted you, or sponsorships agreed directly with real businesses. Every public promotion is clearly labelled. No sponsored traffic or fake clicks.</p><div class="offer-grid">'+(offerRows||'<p>No commercial offers yet.</p>')+'</div><form id="offeradd"><h3>Add a genuine commercial offer</h3><label>Type<select name="kind"><option value="affiliate">Affiliate referral link</option><option value="sponsored">Paid sponsorship</option></select></label><label>Placement<select name="placement"><option value="home">Homepage / catalog</option><option value="part">Real part pages</option><option value="map">Local map</option></select></label>'+field('title','Advertiser / partner title')+field('url','Exact HTTPS tracking or sponsor URL','','url')+'<label>Short useful description<textarea name="description" minlength="15" maxlength="260" rows="3" required></textarea></label><label class="check"><input name="confirm_relationship" type="checkbox" required> I confirm this is my real affiliate tracking link or a real sponsor agreement.</label><button type="submit" class="primary">Add approved partner offer</button><button type="button" data-act="offercancel" hidden>Cancel editing</button></form></section>';
 const sellers=(d.sellers||[]).map(x=>`<tr><td>${esc(x.shop_name)}</td><td>${statusBadge(x.status)}</td><td>${x.connect_configured?'Ready':'Pending'}</td><td>${(x.commission_bps/100).toFixed(2)}% ${x.is_platform_store?'(Owner)':actionButton('sellercommission',x.user_id,'','Adjust')}</td><td>${x.is_platform_store?'Protected':actionButton('sellerstatus',x.user_id,'approved','Approve')+' '+actionButton('sellerstatus',x.user_id,'suspended','Suspend')}</td></tr>`).join('');
 const listings=(d.listings||[]).map(x=>`<tr><td><b>${esc(x.title)}</b><p>${esc(x.make)} ${esc(x.model)} · ${esc(x.year_min)}–${esc(x.year_max)} · ${esc(x.condition)}</p><p>${esc(x.description.slice(0,180))}</p>${x.image_url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(x.image_url)+'">Ver foto original ↗</a>':'Sin foto original'}<p>Vendedor declara inventario: ${x.seller_has_item?'Sí':'No'} · Foto original declarada: ${x.original_photo_attested?'Sí':'No'}</p></td><td>${money(x.price_cents)}</td><td>${statusBadge(x.status)}</td><td>${['reserved','sold'].includes(x.status)?'Bloqueado':actionButton('listingstatus',x.id,'approved','Aprobar')+' '+actionButton('listingstatus',x.id,'rejected','Rechazar')+' '+actionButton('listingstatus',x.id,'removed','Ocultar')}</td></tr>`).join('');
 const purchases=(d.orders||[]).map(x=>`<tr><td>${esc(x.listings?.title||'Pieza')}</td><td>${money(x.amount_cents)}</td><td>${money(x.platform_fee_cents)}</td><td>${statusBadge(x.status)}</td><td>${x.status==='shipped'&&!x.delivered_at?actionButton('delivery',x.id,'','Confirmar entrega')+' ':''}${['paid','shipped'].includes(x.status)?actionButton('refund',x.id,'','Reembolso'):'—'}</td></tr>`).join('');
 const returnRows=(d.returns||[]).map(x=>`<tr><td>${esc(x.order_id.slice(0,8))}</td><td>${esc(x.reason)}</td><td>${esc(x.details.slice(0,180))} ${x.evidence_url?'<a href="'+esc(x.evidence_url)+'" target="_blank" rel="noopener noreferrer">Foto</a>':''}</td><td>${statusBadge(x.status)}</td><td>${esc(x.return_tracking||'—')}</td><td>${x.status==='requested'?actionButton('returnstatus',x.id,'approved','Aprobar')+' '+actionButton('returnstatus',x.id,'rejected','Rechazar'):['approved','in_transit'].includes(x.status)?actionButton('returnstatus',x.id,'received','Marcar recibida'):x.status==='received'?actionButton('refund',x.order_id,'','Reembolsar vía Stripe'):'—'}</td></tr>`).join('');
 const referralRows=(d.referrals||[]).map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.referred_id.slice(0,8))}</td><td>${date(x.created_at)}</td><td>${x.qualified?'Compra confirmada':'Registro'}</td></tr>`).join('');
 const reviewRows=(d.reviews||[]).map(x=>`<tr><td>${x.subject==='part'?'Part — verified buyer':'Website member'}</td><td>${stars(x.rating)}</td><td><b>${esc(x.title)}</b><p>${esc(x.comment)}</p></td><td>${statusBadge(x.status)}</td><td>${x.status==='pending'?actionButton('reviewstatus',x.id,'approved','Approve')+' '+actionButton('reviewstatus',x.id,'rejected','Reject'):'—'}</td></tr>`).join('');
 const users=(d.users||[]).map(x=>`<tr><td>${actionButton('userprofile',x.id,'',x.display_name||'View unnamed account')}</td><td>${x.is_banned?'Suspendido':'Activo'}</td><td>${actionButton('userban',x.id,x.is_banned?'unban':'ban',x.is_banned?'Reactivar':'Suspender')}</td></tr>`).join('');
 layout(`<section class="section"><div class="eyebrow">PANEL PRIVADO · CONTROL ADMINISTRATIVO</div><h1>Dashboard Owner</h1><p>Las métricas provienen de órdenes reales; las comisiones no son ganancias netas.</p><div class="metrics">${cards.map(([name,val])=>`<article class="metric"><small>${esc(name)}</small><strong>${esc(val)}</strong></article>`).join('')}</div><section class="panel owner-analytics" id="owner-analytics"></section>${quotePanel}${testPanel}<section class="panel"><h2>External inventory connection</h2><p><strong>${S.supplier?.configured?'Configured — live API verification occurs on search':'Not connected'}</strong></p><p>eBay Browse API integration is prepared. It requires approved production access, eBay Partner Network membership, a campaign ID, and server-side credentials before real inventory can appear.</p><p>Until connected, search uses approved seller listings and your published affiliate offers. Adding a link does not import a supplier catalog.</p><a class="secondary" href="https://partnernetwork.ebay.com/" target="_blank" rel="noopener noreferrer">eBay Partner Network ↗</a></section><form class="panel" id="settings"><h2>Control de la página principal</h2>${field('hero_title','Título',settings.hero_title||'')}${field('hero_subtitle','Subtítulo',settings.hero_subtitle||'')}${field('announcement','Anuncio',settings.announcement||'')}${field('support_email','Correo de soporte',settings.support_email||'','email')}${field('commission_bps','Comisión en puntos base (1500 = 15%)',settings.commission_bps||1500,'number')}<label class="check"><input name="payments_enabled" type="checkbox" ${settings.payments_enabled?'checked':''}> Permitir compras (solo tras verificar Stripe)</label><button class="primary">Guardar configuración</button></form>${socialForm}${adsPanel}${offersPanel}<h2>Vendedores</h2>${table(['Store','Status','Stripe','Commission','Actions'],sellers)}<h2>Moderación de piezas</h2>${table(['Pieza','Precio','Estado','Acciones'],listings)}<p>Antes de aprobar una pieza, verifica personalmente que el vendedor la tiene, que la foto es real y que el producto está disponible.</p><h2>Pedidos y reembolsos</h2>${table(['Pieza','Importe','Comisión','Estado','Acción'],purchases)}<h2>Devoluciones (30 días desde entrega)</h2>${table(['Pedido','Motivo','Descripción','Estado','Seguimiento','Acción'],returnRows)}<h2>Referidos</h2><p>Registros: ${esc(d.referral_stats?.registered||0)} · Compradores: ${esc(d.referral_stats?.qualified||0)} · Recompensas desactivadas.</p>${table(['Código','Cuenta','Fecha','Estado'],referralRows)}<h2>Reviews and ratings</h2><p>Only authentic website feedback and verified buyer part reviews are eligible. Approval is required for public display.</p>${table(['Type','Stars','Review','Status','Action'],reviewRows)}<h2>Usuarios</h2>${table(['Usuario','Estado','Acción'],users)}<h2>Auditoría</h2><div class="panel">${(d.audit||[]).slice(0,30).map(x=>`<p>${esc(x.action)} · ${date(x.created_at)} · ${esc(x.target_id||'')}</p>`).join('')||'Sin eventos registrados'}</div></section>`);
 stopOwnerAnalytics=mountOwnerAnalytics(document.getElementById('owner-analytics'),{api,language:currentLanguage,esc});
}
function publicInfo(kind){
 const email=S.site?.settings?.support_email||'';
 const support=email?'<a href="mailto:'+esc(email)+'">'+esc(email)+'</a>':'Correo de soporte pendiente de publicación';
 const pages={
  advertising:{title:'Publicidad, patrocinadores y enlaces de afiliados',sections:[
   '<h2>Publicidad y enlaces comerciales</h2><p>RePartes USA puede mostrar publicidad automática de Google AdSense una vez que su sitio y cuenta sean aprobados. Los anuncios automáticos son gestionados por Google y pueden utilizar tecnologías de medición y personalización conforme a los requisitos legales aplicables y a los controles de consentimiento.</p>',
   '<h2>Enlaces de afiliados y patrocinios</h2><p>Los enlaces comerciales llevan etiquetas como Affiliate link o Sponsored placement. Podríamos recibir comisiones por compras elegibles realizadas en sitios externos a través de nuestros enlaces de afiliados o compensación por patrocinios contratados. El precio, la garantía y las condiciones de compra del comercio externo son responsabilidad de ese comercio. No publicamos patrocinadores que no existen.</p>',
   '<h2>Colaboraciones comerciales</h2><p>Para consultar una colaboración o propuesta de patrocinio, escribe a %%EMAIL%%. La aceptación y los términos de cualquier acuerdo deben verificarse antes de publicar un anuncio.</p>',
   '<h2>Independencia y privacidad</h2><p>Un anuncio no es una garantía ni una verificación de compatibilidad de una pieza. Nunca solicitamos que un visitante haga clic en un anuncio para ayudarnos económicamente. Consulta nuestro aviso de privacidad y los ajustes disponibles en los proveedores externos.</p>'
  ]},
  about:{title:'Sobre RePartes USA',sections:[
   '<h2>¿Qué es RePartes USA?</h2><p>RePartes USA es un marketplace en línea para conectar a personas que buscan autopartes con vendedores independientes en Estados Unidos. El catálogo podrá incluir piezas usadas, reacondicionadas o nuevas, siempre que sean legales, estén correctamente descritas y estén permitidas por el procesador de pagos y los servicios de transporte.</p>',
   '<h2>¿Cómo funciona?</h2><p>Los vendedores solicitarán acceso, publicarán la información de sus piezas y estarán sujetos a revisión de anuncios. Los compradores podrán buscar por marca, modelo, compatibilidad y número de pieza. Cuando se habiliten las compras, los precios se mostrarán en dólares estadounidenses (USD) y los pagos se procesarán mediante Stripe.</p>',
   '<h2>Estado de lanzamiento</h2><p>Actualmente, RePartes USA está preparando su operación comercial. No está aceptando pagos ni pedidos nuevos. No anunciamos productos o vendedores inexistentes como si estuvieran disponibles.</p>'
  ]},
  contact:{title:'Contacto y atención al cliente',sections:[
   '<h2>Comunícate con RePartes USA</h2><p>Para consultas sobre anuncios, el funcionamiento del marketplace, privacidad, reportes de vendedores o futuros pedidos, escribe a: <strong>%%EMAIL%%</strong>.</p>',
   '<h2>Compras y reclamos</h2><p>Las compras están temporalmente desactivadas. Cuando comiencen las operaciones, este mismo canal permitirá iniciar solicitudes de soporte sobre órdenes, incidencias de envío y reclamos. No se ha publicado una línea telefónica ni un horario de atención.</p>',
   '<h2>Información comercial</h2><p>Nombre de la plataforma: RePartes USA. Operación prevista: marketplace de autopartes para clientes en Estados Unidos. Moneda prevista: USD. Antes de comenzar a cobrar se completarán los datos exigidos para la verificación empresarial.</p>'
  ]},
  shipping:{title:'Envíos, devoluciones y reembolsos',sections:[
   '<h2>Política de devoluciones: 30 días desde la entrega</h2><p>RePartes USA permitirá solicitar una devolución durante los <strong>30 días naturales posteriores a la entrega confirmada</strong> de cada pieza. El plazo comienza al día siguiente de la fecha de entrega indicada por el transportista. Esta política aplicará a las compras efectuadas cuando la tienda comience a operar.</p>',
   '<h2>Cómo solicitar una devolución</h2><p>Antes de enviar una pieza de vuelta, escribe a <strong>%%EMAIL%%</strong> con el número de pedido, nombre de la pieza, fecha de entrega, motivo de la devolución y fotografías si existe daño o discrepancia. El equipo revisará la solicitud y proporcionará instrucciones y una dirección de devolución. No envíes piezas a ninguna dirección sin instrucciones.</p>',
   '<h2>Condiciones para que la devolución sea aceptada</h2><p>Para devoluciones por cambio de opinión o compra equivocada, la pieza debe conservarse sin instalar, sin modificaciones y en condiciones equivalentes a las recibidas, permitiendo una revisión razonable. Conserva los accesorios suministrados. Las piezas incorrectas, dañadas al llegar, defectuosas o que no coincidan con el anuncio podrán reclamarse dentro del mismo plazo, incluso cuando el defecto se descubra durante una instalación razonable y documentada. Cada caso será revisado con la evidencia disponible; esta política no limita derechos obligatorios del consumidor.</p>',
   '<h2>¿Quién paga el envío de regreso?</h2><p><strong>Producto equivocado, dañado al llegar, defectuoso o distinto a lo anunciado:</strong> el vendedor asumirá los costos razonables de la devolución autorizada; las instrucciones se proporcionarán por el canal de soporte. <strong>Cambio de opinión, compra incorrecta o incompatibilidad no atribuible a un error del anuncio:</strong> el comprador paga el envío de regreso. No se aplicará una tarifa adicional de reposición por una devolución aprobada.</p>',
   '<h2>Plazo para enviar la pieza y recibir el reembolso</h2><p>Tras recibir la autorización, el comprador deberá despachar la devolución dentro de los siguientes <strong>14 días naturales</strong>, salvo que el soporte indique otro plazo por escrito. Una vez recibida e inspeccionada la pieza, si la devolución cumple la política, se iniciará el reembolso al <strong>método de pago original</strong> dentro de 10 días hábiles. La llegada del dinero a la cuenta del comprador depende también de su banco o emisor. Para productos incorrectos, defectuosos o que no coincidan con el anuncio, el importe reembolsado incluirá el precio total pagado por ese artículo.</p>',
   '<h2>Envíos y seguimiento</h2><p>Los vendedores independientes serán responsables de embalar correctamente las piezas, organizar el envío permitido legalmente y proporcionar seguimiento verificable. El precio de cada artículo deberá reflejar el costo de envío anunciado. Las fechas y restricciones de entrega aplicables se informarán antes de autorizar el cobro; no garantizamos actualmente un tiempo fijo de envío.</p>',
   '<h2>Estado actual: pagos desactivados</h2><p>RePartes USA está en prelanzamiento y todavía <strong>no acepta compras ni procesa devoluciones reales</strong>. Esta política ya define el compromiso de 30 días, pero la operación de atención, seguimiento y reembolsos deberá probarse antes de habilitar pagos. Si necesitas información, escribe a %%EMAIL%%.</p>'
  ]},
  privacy:{title:'Aviso de privacidad',sections:[
   '<h2>Medición del sitio</h2><p>Medimos visitas, tipos de página, acciones y origen general del tráfico con un identificador aleatorio guardado en la pestaña. La medición guarda el tipo de dispositivo y la hora, sin guardar direcciones IP, términos escritos en el buscador, datos de cuenta ni enlaces privados en los registros de Analytics. El sistema respeta Global Privacy Control y Do Not Track. Los registros de tráfico se conservan hasta 120 días, con limpieza diaria.</p>',
   '<h2>Part requests</h2><p>When you request a part, we store your vehicle details, requested part, name, email, optional ZIP code and optional phone so RePartes USA can review and respond to your inquiry. These requests are private to the Owner. Unfinished forms are saved on your device for up to 7 days and can be cleared using Clear saved draft. A request is not an order and does not guarantee availability or compatibility.</p>',
   '<h2>Información tratada por la plataforma</h2><p>Para operar las cuentas, anuncios y posibles compras, el servicio puede tratar datos proporcionados por los usuarios como correo electrónico, nombre de perfil, detalles de piezas, datos de envío y seguimiento, así como registros técnicos y de seguridad necesarios para prestar el servicio.</p>',
   '<h2>Proveedores tecnológicos</h2><p>El servicio utiliza Supabase para cuentas y datos de la plataforma y Netlify para alojar el sitio y las funciones del servidor. Cuando se activen pagos, Stripe gestionará el procesamiento de las transacciones. RePartes USA no solicita que los compradores escriban el número completo de su tarjeta en formularios propios.</p>',
   '<h2>Finalidad y solicitudes</h2><p>Los datos se utilizan para administrar el servicio, responder consultas, gestionar transacciones y proteger la integridad de las cuentas. Para consultas sobre datos personales, acceso, correcciones o solicitudes de eliminación, escribe a %%EMAIL%%. Algunas solicitudes pueden estar sujetas a obligaciones de conservación legales o de seguridad.</p>',
   '<h2>Publicidad, tecnologías y consentimiento</h2><p>Si se activa Google AdSense, Google y sus socios pueden usar cookies u otras tecnologías para publicar, limitar, medir o personalizar anuncios conforme a sus políticas y a la configuración de privacidad y consentimiento aplicable. Los enlaces identificados como afiliados o patrocinados pueden redirigir a sitios externos con sus propias políticas y mecanismos de seguimiento. La publicidad se activa únicamente mediante una configuración expresa del Owner. Antes de habilitar publicidad dirigida, la plataforma deberá configurar avisos y opciones de privacidad apropiados, incluido el consentimiento cuando sea exigible.</p>',
   '<h2>Información pendiente de completar</h2><p>Este aviso es inicial. Antes del lanzamiento público comercial se deberá completar y revisar la política de retención de datos, cookies, destinatarios, derechos aplicables y cualquier otro requisito legal de las jurisdicciones donde opere la plataforma.</p>'
  ]},
  terms:{title:'Términos de uso',sections:[
   '<h2>Naturaleza de la plataforma</h2><p>RePartes USA está diseñado para facilitar el contacto y las futuras transacciones entre compradores y vendedores independientes de autopartes. No se afirma que la plataforma sea fabricante, proveedor o garante de las piezas anunciadas por terceros.</p>',
   '<h2>Obligaciones de los vendedores</h2><p>Los anuncios deben describir las piezas de forma veraz, identificar su condición y compatibilidad y acreditar su legítima procedencia. No se permitirán artículos robados, falsificados, prohibidos por ley, peligrosos o no autorizados para su venta o transporte. RePartes USA podrá retirar publicaciones que incumplan las reglas aplicables.</p>',
   '<h2>Condiciones de compra y devoluciones</h2><p>Todos los precios se expresarán en dólares estadounidenses (USD). Una vez habilitadas las compras, se permitirá solicitar devoluciones durante los <strong>30 días naturales posteriores a la entrega confirmada</strong>, conforme a las condiciones, responsabilidades de envío y procedimiento descritos en la <a href="#shipping">política de envíos y devoluciones</a>. Las compras siguen desactivadas hasta completar las condiciones comerciales, los controles operativos y la verificación de Stripe.</p>',
   '<h2>Atención</h2><p>Las consultas sobre la plataforma se pueden dirigir a %%EMAIL%%. Este documento se encuentra en preparación para su revisión antes de iniciar operaciones comerciales.</p>'
  ]}
 };
 const p=pages[kind]||pages.terms;
 const nav='<div class="policy-nav"><a href="#about">Sobre nosotros</a> · <a href="#contact">Contacto</a> · <a href="#shipping">Envíos y devoluciones</a> · <a href="#privacy">Privacidad</a> · <a href="#terms">Términos</a></div>';
 const body=p.sections.join('').replaceAll('%%EMAIL%%',support);
 layout('<section class="section"><div class="eyebrow">INFORMACIÓN DEL MARKETPLACE</div><h1>'+esc(p.title)+'</h1><div class="panel policy-copy">'+body+'</div>'+nav+'</section>');
}
let version=0;
async function route(){
 const current=++version;
 if(isQuotePage){
  const render=content=>renderQuotePage(app,content,currentLanguage,languageSelector);
  render('<h1>Loading quotes…</h1>');
  try{
   const result=await api('quote.compare','POST',{token:location.hash.slice(1)});
   if(version===current){
    render(quoteComparison(result,esc));
    window.repartesAnalytics?.quoteOpened();
   }
  }catch{
   if(version===current)render('<h1>This quote link is unavailable.</h1><p>Check the link and try again.</p><button data-act="retry">Reintentar</button>');
  }
  return;
 }
 const [marketPage,id]=marketplaceRoute();
 if(!isOwnerPage&&marketPage==='owner'){location.replace(ownerPath);return}
 const p=isOwnerPage?'owner':marketPage;
 layout('<section class="section"><h2>Cargando datos…</h2></section>');
 try{
  if(['orders','sell','return','review'].includes(p)&&S.session)S.mine=await api('mine');
  if(!isOwnerPage&&!S.site&&['home','catalog','part','contact',''].includes(p))await loadPublicCatalog();
  if(['home','catalog',''].includes(p)||(p==='part'&&id)){
   const reviewQuery=p==='part'?{scope:'part',listing_id:id}:{scope:'website'};
   const reviews=await api('reviews','GET',reviewQuery).catch(()=>null);
   if(version!==current)return;
   S.currentReviews=reviews;
  }
  if(p==='referrals'&&S.session)S.referrals=await api('referrals');
  if(p==='owner'&&S.me?.is_owner){
   const [dashboard,test,quotes,supplier]=await Promise.all([api('dashboard'),api('checkout-test'),api('part-requests'),api('supplier-status')]);
   if(version!==current)return;
   S.admin=dashboard;
   S.checkoutTest=test;
   S.partRequests=quotes.requests;
   S.supplier=supplier;
  }
  if(version!==current)return;
  if(p==='contact'&&id==='support'){supportPage({layout,language:currentLanguage,email:S.site?.settings?.support_email,esc});return;}
  if(p==='home'||p==='catalog'||!p)home();else if(p==='part')part(id);else if(p==='login')login();else if(p==='sell')sell();else if(p==='orders')orders();else if(p==='return')returnForm(id);else if(p==='referrals')referrals();else if(p==='feedback')feedback();else if(p==='review')reviewOrder(id);else if(p==='owner')owner();else if(['about','contact','shipping','privacy','terms','legal','advertising'].includes(p))publicInfo(p==='legal'?'terms':p);else home();
 }catch(err){if(version!==current)return;layout('<section class="section empty"><h2>La operación no se pudo completar</h2><p>'+esc(err.message)+'</p><button data-act="retry">Reintentar</button></section>')}
}
async function refreshIdentity(){
 const userId=S.session?.user?.id;
 const identity=S.session?await api('me'):null;
 if(S.session?.user?.id===userId)S.me=identity;
}
async function refreshCatalog(){S.site=await api('site')}
async function loadPublicCatalog(){
 try{await refreshCatalog();}
 catch{S.site=null;}
}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-act]');if(!b)return;
 const a=b.dataset.act,id=b.dataset.id,status=b.dataset.status;
 b.disabled=true;
 try{
  if(a==='retry'){if(b.dataset.reload!==undefined)location.reload();else await route();return}
  if(a==='quote-copy'){
   const token=S.partRequests?.find(request=>request.id===id)?.quote_token;
   if(!token)return;
   const url=location.origin+quotePath+'#'+token;
   try{
    await navigator.clipboard.writeText(url);
    toast(currentLanguage==='es'?'Enlace privado copiado.':'Private quote link copied.');
   }catch{
    window.prompt(currentLanguage==='es'?'Copia el enlace privado.':'Copy the private quote link.',url);
   }
   return;
  }
  if(a==='quote-withdraw'){
   const question=currentLanguage==='es'?'¿Retirar esta cotización de la página del comprador?':'Withdraw this quote from the buyer page?';
   if(!confirm(question))return;
   await api('admin.quote.withdraw','POST',{id,request_id:status});
   await route();
   return;
  }
  if(a==='userprofile'){await showOwnerUser(id);return}
  if(a==='quotestatus'){await api('admin.quote.status','POST',{id,status});toast('Part request updated.');await route();return}
  if(a==='checkoutteststart'){const r=await api('admin.checkout-test.start','POST',{});const url=new URL(r.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('Unexpected checkout address');location.href=url.href;return}
  if(a==='checkouttestrefund'){await api('admin.checkout-test.refund','POST',{});toast('Test refund requested. Refresh to confirm its webhook.');await route();return}

  if(a==='offeredit'){
   const offer=S.admin?.settings?.monetization_offers?.find(x=>x.id===id),form=document.getElementById('offeradd');
   if(!offer||!form)return;
   form.reset();setOfferMode(form,id);
   for(const name of OFFER_DRAFT_FIELDS)form.elements.namedItem(name).value=offer[name]||'';
   form.scrollIntoView({block:'start'});form.elements.namedItem('title').focus({preventScroll:true});saveOfferDraft();return;
  }
  if(a==='offercancel'){
   const form=document.getElementById('offeradd');if(!form)return;
   form.reset();setOfferMode(form);clearOfferDraft();return;
  }
  if(a==='offerremove'){
   if(!confirm('Remove this affiliate or sponsor offer from the public website?'))return;
   await api('admin.offer.remove','POST',{id});
   const form=document.getElementById('offeradd');if(form?.dataset.id===id){form.reset();setOfferMode(form);clearOfferDraft();}
   await refreshCatalog();toast('Offer removed.');await route();return;
  }
  if(a==='sellercommission'){const found=S.admin?.sellers?.find(x=>x.user_id===id);if(!found)return;const amount=prompt('Enter the new commission percentage for this seller (0–30%). Changes apply only to new sales.',(found.commission_bps/100).toFixed(2));if(amount===null)return;if(!/^\d{1,2}(\.\d{1,2})?$/.test(amount)||Number(amount)>30)throw Error('Enter a valid percentage from 0 to 30 with up to two decimals.');await api('admin.commission','POST',{id,commission_bps:Math.round(Number(amount)*100)});toast('Seller commission updated for future orders.');await route();return}
  if(a==='withdraw'){if(!confirm('¿Retirar esta pieza del mercado? No se podrá comprar.'))return;await api('listing.withdraw','POST',{id});toast('Anuncio retirado');await route();return}
  if(a==='copyref'){await navigator.clipboard.writeText(refUrl());toast('Enlace de referidos copiado');return}
  if(a==='logout'){clearOfferDraft();document.getElementById('offeradd')?.reset();await sb.auth.signOut();S.session=null;S.me=null;if(!isOwnerPage)location.hash='#home';await route();return}
  if(a==='connect'){const r=await api('seller.connect','POST',{});if(new URL(r.url).protocol!=='https:')throw Error('Enlace no seguro');location.href=r.url;return}
  if(a==='checkout'){if(!S.session){location.hash='#login';return}if(!confirm('Continuar al pago protegido por Stripe?'))return;const r=await api('checkout','POST',{listing_id:id});if(new URL(r.url).protocol!=='https:')throw Error('Enlace no seguro');location.href=r.url;return}
  if(a==='edit'){const x=S.mine?.listings?.find(z=>z.id===id),f=document.getElementById('listing');if(x&&f){for(const [k,v] of Object.entries(x)){const elem=f.elements.namedItem(k);if(elem&&elem.type==='checkbox')elem.checked=Boolean(v);else if(elem&&elem.type!=='file')elem.value=v??''}f.elements.namedItem('price').value=(x.price_cents/100).toFixed(2);f.dataset.id=id;f.scrollIntoView();toast('Pieza cargada. Al guardar deberá aprobarse nuevamente.')}return}
  if(a==='returntracking'){const t=prompt('Número real de seguimiento para devolver la pieza');if(!t)return;await api('return.tracking','POST',{id,tracking_code:t});toast('Envío de retorno registrado');await route();return}
  if(a==='delivery'){const d=prompt('Fecha de entrega confirmada por transportista (AAAA-MM-DD)');if(!d)return;await api('admin.delivery','POST',{id,delivered_at:d});toast('Entrega registrada');await route();return}
  if(a==='ship'){const t=prompt('Número real de seguimiento');if(!t)return;await api('order.ship','POST',{id,tracking_code:t});toast('Seguimiento guardado');await route();return}
  const actions={sellerstatus:'admin.seller',listingstatus:'admin.listing',returnstatus:'admin.return',reviewstatus:'admin.review',userban:'admin.ban',refund:'admin.refund'};
  if(actions[a]){
   if(!confirm('Confirmar esta operación administrativa?'))return;
   const payload=a==='userban'?{id,is_banned:status==='ban'}:a==='refund'?{id}:{id,status};
   if(a==='listingstatus'&&status==='approved')payload.verified_real_inventory=confirm('¿Verificaste que el vendedor tiene físicamente la pieza, que la fotografía es original y la pieza está lista para envío?');
   if(a==='listingstatus'&&status==='approved'&&!payload.verified_real_inventory)return;
   if(a==='returnstatus')payload.note=prompt('Nota de revisión para el caso (opcional)')||'';
   await api(actions[a],'POST',payload);toast('Cambio registrado');await route();
  }
 }catch(err){toast(err.message)}finally{if(b.isConnected)b.disabled=false}
});
document.addEventListener('input',ev=>{if(ev.target.id==='search'){
 S.q=ev.target.value;updateCatalogResults();clearTimeout(partnerSearchTimer);partnerSearchController?.abort();
 const area=document.getElementById('partner-results');if(area)area.innerHTML='';
 const length=S.q.trim().length;
 if(length===0||length>=2)partnerSearchTimer=setTimeout(()=>updatePartnerResults(true),650);
}});
function setPartNumberMode(byNumber){
 S.searchByNumber=byNumber;
 const mode=document.getElementById('part-number-mode');
 const form=document.getElementById('part-search');
 mode.setAttribute('aria-pressed',String(byNumber));
 form.querySelector('#search-label').textContent=byNumber?'Enter the full part number':'What part are you looking for?';
 form.elements.q.placeholder=byNumber?'Example: AB-1234':'Part, vehicle or part number';
 localize(form,currentLanguage);
}
document.addEventListener('click',ev=>{
 const map=ev.target.closest('[data-local-map]');
 if(map){openLocalMap?.(map.dataset.localMap==='search');return;}
 const mode=ev.target.closest('#part-number-mode');
 if(mode){
  setPartNumberMode(!S.searchByNumber);
  updateCatalogResults();
  updatePartnerResults(true);
  document.getElementById('search').focus();
  return;
 }
 const button=ev.target.closest('[data-search-term]');if(!button)return;
 setPartNumberMode(false);
 S.q=button.dataset.searchTerm;document.getElementById('search').value=S.q;
 updateCatalogResults();updatePartnerResults(true);document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'});
});
document.addEventListener('submit',ev=>{if(ev.target.id!=='part-search')return;ev.preventDefault();S.q=document.getElementById('search').value;updateCatalogResults();updatePartnerResults(true);document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'});});
document.addEventListener('submit',async ev=>{
 const form=ev.target;
 if(!form.matches('[data-quote-form]'))return;
 ev.preventDefault();
 const button=form.querySelector('[type="submit"]');
 if(button.disabled)return;
 const status=form.querySelector('[data-quote-status]');
 button.disabled=true;
 status.textContent=currentLanguage==='es'?'Guardando cotización…':'Saving quote…';
 try{
  await submitOwnerQuote(form,api,sb.storage);
  if(form.isConnected)await route();
 }catch(error){status.textContent=error.message;}
 finally{button.disabled=false;}
});
document.addEventListener('submit',async ev=>{
 const f=ev.target;if(!['signin','signup','seller','listing','settings','socialsettings','adssettings','offeradd','returnrequest','review'].includes(f.id))return;ev.preventDefault();
 const v=Object.fromEntries(new FormData(f).entries()),button=f.querySelector('button');if(button)button.disabled=true;
 try{
  if(f.id==='adssettings'){
   await api('admin.ads','POST',{adsense_publisher_id:v.adsense_publisher_id,adsense_enabled:f.elements.namedItem('adsense_enabled').checked,confirm_approved:f.elements.namedItem('confirm_approved').checked,confirm_privacy:f.elements.namedItem('confirm_privacy').checked});
   await refreshCatalog();toast('AdSense settings saved. Ads only run when enabled and the publisher is approved.');
  }
  if(f.id==='offeradd'){
   const editing=Boolean(f.dataset.id);
   await api(editing?'admin.offer.update':'admin.offer.add','POST',{...v,...(editing?{id:f.dataset.id}:{}),confirm_relationship:f.elements.namedItem('confirm_relationship').checked});
   clearOfferDraft();f.reset();setOfferMode(f);
   await refreshCatalog();toast(editing?'Partner offer updated.':'Verified partner link saved.');
  }
  if(f.id==='socialsettings'){const links={};for(const [k] of SOCIAL_NETWORKS)links[k]=String(v[k]||'').trim();await api('admin.socials','POST',{links});toast('Official social links saved.');await refreshCatalog()}
  if(f.id==='review'){await api('review.submit','POST',{subject:f.dataset.subject,order_id:f.dataset.id,...v,rating:Number(v.rating)});toast('Review submitted. It will appear after moderation.');location.hash=f.dataset.subject==='website'?'#home':'#orders'}
  if(f.id==='signin'){const destination=marketplaceRoute()[0]==='sell'?'#sell':'#home';const {error}=await sb.auth.signInWithPassword({email:v.email,password:v.password});if(error)throw error;if(isOwnerPage)await refreshIdentity();else location.hash=destination}
  if(f.id==='signup'){if(v.password.length<10)throw Error('Contraseña demasiado corta');const {data,error}=await sb.auth.signUp({email:v.email,password:v.password,options:{data:{display_name:v.display_name,...(pendingRef()?{referral_code:pendingRef()}:{})}}});if(error)throw error;toast(data.session?'Cuenta creada':'Verifica tu correo electrónico');if(data.session)location.hash=marketplaceRoute()[0]==='sell'?'#sell':'#home'}
  if(f.id==='seller'){const r=await api('seller.apply','POST',v);await refreshIdentity();toast(r.owner_store?'Your own store is ready. Upload original photos of your parts.':'Application submitted for review.')}
  if(f.id==='returnrequest'){await api('return.request','POST',{order_id:f.dataset.id,...v});toast('Solicitud enviada a revisión');location.hash='#orders'}
  if(f.id==='listing'){
    if(f.dataset.id)v.id=f.dataset.id;
    const file=f.elements.namedItem('part_photo')?.files?.[0];
    if(file){
     if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('La foto debe ser JPG, PNG o WebP y pesar menos de 5 MB.');
     const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
     const dest=S.session.user.id+'/'+crypto.randomUUID()+'.'+ext;
     const {error}=await sb.storage.from('part-photos').upload(dest,file,{contentType:file.type,upsert:false});
     if(error)throw Error('No se pudo subir la foto: '+error.message);
     v.image_url=sb.storage.from('part-photos').getPublicUrl(dest).data.publicUrl;
    }
    v.public_contact_enabled=f.elements.namedItem('public_contact_enabled').checked;
    v.seller_has_item=f.elements.namedItem('seller_has_item').checked;
    v.original_photo_attested=f.elements.namedItem('original_photo_attested').checked;
    if(!v.image_url)throw Error('Debes subir una fotografía original del artículo.');
    await api('listing.save','POST',v);toast('Pieza real enviada a verificación del Owner');
   }
  if(f.id==='settings'){v.commission_bps=Number(v.commission_bps);v.payments_enabled=f.elements.namedItem('payments_enabled').checked;await api('admin.settings','POST',v);toast('Configuración actualizada');await refreshCatalog()}
  await route();
 }catch(err){toast(err.message)}finally{if(button?.isConnected)button.disabled=false}
});
document.addEventListener('submit',async ev=>{
 const form=ev.target;
 if(!['forgot-password','reset-password'].includes(form.id))return;
 ev.preventDefault();
 const button=form.querySelector('button'),status=form.querySelector('[role="status"]');
 if(button.disabled)return;
 button.disabled=true;
 try{
  if(form.id==='forgot-password'){
   const {error}=await sb.auth.resetPasswordForEmail(form.elements.email.value.trim(),{redirectTo:location.origin+'/'});
   if(error && error.code!=='user_not_found')throw error;
   status.textContent='If an account exists for this email, check your inbox and spam folder for a reset link.';
  }else{
   const password=form.elements.password.value;
   if(password!==form.elements.confirm.value){status.textContent='The passwords do not match.';return}
   if(!recoveryUserId||recoveryUserId!==S.session?.user?.id){passwordRecovery('reset');return}
   const {error}=await sb.auth.updateUser({password});
   if(error)throw error;
   recoveryUserId=null;
   form.reset();
   layout('<section class="section"><h1>Password updated</h1><p>Your new password is ready to use.</p><a href="#home">Browse parts</a></section>');
  }
 }catch(error){status.textContent=error.status===429?'Too many requests. Please try again later.':(form.id==='forgot-password'?'We could not send the reset email. Please try again later.':'Could not update your password. Try a different password or request a new reset link.')}
 finally{button.disabled=false}
});
document.addEventListener('change',async ev=>{if(ev.target.id==='language'){currentLanguage=ev.target.value;setLanguage(currentLanguage);await route()}});
if(!isOwnerPage&&!isQuotePage)mountPartRequests({submit:data=>api('quote.submit','POST',data),getSearchQuery:()=>S.q});
window.addEventListener('hashchange',route);
(async()=>{
 if(isQuotePage){await route();return;}
 if(!sb){layout('<section class="section empty"><h2>Configuración de Supabase pendiente</h2><p>Define las variables públicas VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Netlify para conectar el catálogo y las cuentas.</p></section>');return}
 try{
  const {data}=await sb.auth.getSession();S.session=data.session;
  if(recoveryCallback){
   if(S.session && recoveryCallback.token===S.session.access_token)recoveryUserId=S.session.user.id;
   recoveryCallback=null;
   history.replaceState(null,'','/#login/reset');
  }
  if(recoveryUserId)await route();
  else await refreshIdentity();
  await claimRef();
  sb.auth.onAuthStateChange((_event,session)=>{
   const previousUser=S.session?.user?.id;
   S.session=session;
   if(recoveryUserId!==session?.user?.id)recoveryUserId=null;
   if(previousUser===session?.user?.id)return;
   S.me=null;
   if(isOwnerPage){
    S.admin=null;
    S.checkoutTest=null;
    S.partRequests=null;
    S.supplier=null;
    void route();
   }
   setTimeout(async()=>{try{await refreshIdentity();await claimRef();await route()}catch(err){toast(err.message)}},0);
  });
  await route();
 }catch(err){layout('<section class="section empty"><h2>No fue posible conectar RePartes USA</h2><p>'+esc(err.message)+'</p><button data-act="retry" data-reload>Reintentar</button></section>')}
})();
