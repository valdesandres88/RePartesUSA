(()=>{
 const key='repartes:analytics-session:v1';
 const idleMs=30*60*1000;
 const routes=new Set('home catalog part login sell orders return review feedback referrals about contact shipping privacy terms advertising'.split(' '));
 const names=['google','bing','tiktok','facebook','instagram','threads','x','telegram','youtube','pinterest','reddit','email'];
 const domains={
  google:['google.com'],bing:['bing.com'],tiktok:['tiktok.com'],facebook:['facebook.com','fb.com','fb.me'],
  instagram:['instagram.com'],threads:['threads.com','threads.net'],x:['x.com','twitter.com','t.co'],
  telegram:['telegram.org','t.me'],youtube:['youtube.com','youtu.be'],pinterest:['pinterest.com','pin.it'],
  reddit:['reddit.com','redd.it'],email:['mail.google.com','outlook.live.com']
 };

 function currentPage(){
  const path=location.pathname.replace(/\/$/,'');
  if(path==='/quotes')return 'quotes';
  if(path==='/guides/used-auto-parts.html')return 'guide_en';
  if(path==='/guides/comprar-piezas-usadas.html')return 'guide_es';
  if(path&&path!=='/index.html')return '';
  const route=location.hash.slice(1).split('/')[0]||'home';
  if(route==='legal')return 'terms';
  return routes.has(route)?route:'';
 }

 function source(){
  const tag=(new URLSearchParams(location.search).get('utm_source')||'').toLowerCase();
  if(names.includes(tag))return tag;
  if(!document.referrer)return 'direct';
  try{
   const host=new URL(document.referrer).hostname;
   if(host===location.hostname)return 'direct';
   for(const name of ['email',...names.filter(name=>name!=='email')]){
    if(domains[name].some(domain=>host===domain||host.endsWith('.'+domain)))return name;
   }
  }catch{}
  return 'other';
 }

 const device=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'mobile':'desktop';
 let currentSession;
 try{currentSession=JSON.parse(sessionStorage.getItem(key));}catch{}
 function getSession(){
  const now=Date.now();
  if(!currentSession?.id||!Number.isFinite(currentSession.last)||now-currentSession.last>=idleMs||
     currentSession.last>now||currentSession.device!==device){
   currentSession={id:crypto.randomUUID(),source:source(),device};
  }
  currentSession.last=now;
  try{sessionStorage.setItem(key,JSON.stringify(currentSession));}catch{}
  return currentSession;
 }

 function track(kind){
  const page=currentPage();
  if(!page||navigator.globalPrivacyControl||navigator.doNotTrack==='1'||!globalThis.crypto?.randomUUID)return;
  const session=getSession();
  const body=JSON.stringify({id:crypto.randomUUID(),session_id:session.id,page,kind,source:session.source,device});
  void fetch('/api/market?action=analytics.event',{
   method:'POST',keepalive:true,credentials:'omit',headers:{'Content-Type':'application/json'},body
  }).catch(()=>{});
 }

 let lastView, lastComparison;
 function view(){
  const locationKey=location.pathname+location.hash;
  if(lastView===locationKey)return;
  lastView=locationKey;
  track('view');
 }
 function quoteOpened(){
  if(lastComparison===location.hash)return;
  lastComparison=location.hash;
  track('quote_open');
 }

 window.repartesAnalytics={track,quoteOpened};
 view();
 window.addEventListener('hashchange',view);
 document.addEventListener('click',ev=>{
  const link=ev.target.closest('[data-analytics-link]');
  if(link)track(link.dataset.analyticsLink);
 });
 document.addEventListener('auxclick',ev=>{
  if(ev.button!==1)return;
  const link=ev.target.closest('[data-analytics-link]');
  if(link)track(link.dataset.analyticsLink);
 });
})();
