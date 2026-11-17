/* Shared Back navigation for the marketplace and standalone buyer guides. */
(()=>{
 const sameSite=value=>{try{return new URL(value).origin===location.origin;}catch{return false;}};
 const remember=previous=>{
  history.replaceState({...history.state,repartesNavigation:{previous:sameSite(previous)?previous:null}},'',location.href);
 };
 if(!history.state?.repartesNavigation)remember(document.referrer);
 window.addEventListener('hashchange',event=>{
  // A native Back/Forward visit already has its own saved previous page.
  if(!history.state?.repartesNavigation)remember(event.oldURL);
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-back-button]');if(!button)return;
  event.preventDefault();
  const previous=history.state?.repartesNavigation?.previous;
  if(history.length>1&&sameSite(previous)){history.back();return;}
  // Direct links have no previous website page: return to the catalog.
  if(location.pathname!=='/'||location.hash!=='#home')location.href='/#home';
  else window.scrollTo({top:0,behavior:'smooth'});
 });
})();
