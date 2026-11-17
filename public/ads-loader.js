/* RePartes USA: only load the official AdSense Auto ads tag after Owner enables it. */
(()=>{
 let loaded=false;
 const eligible=()=>{
  if(location.pathname.startsWith('/guides/'))return true;
  if(location.pathname!=='/')return false;
  return ['home','catalog','part'].includes((location.hash||'#home').slice(1).split('/')[0]);
 };
 async function load(){
  if(!eligible()){if(loaded)location.reload();return;}
  if(loaded)return;
  try{
   const r=await fetch('/api/market?action=adsconfig',{cache:'no-store'});
   if(!r.ok)return;
   const s=await r.json(),id=String(s.publisher_id||'');
   if(s.enabled!==true||!/^ca-pub-[0-9]{16}$/.test(id)||!eligible()||loaded)return;
   loaded=true;
   const script=document.createElement('script');
   script.async=true;script.crossOrigin='anonymous';
   script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(id);
   document.head.appendChild(script);
  }catch(error){console.warn('Ad configuration unavailable');}
 }
 load();
 if(location.pathname==='/')window.addEventListener('hashchange',load);
})();
