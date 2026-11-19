export function localMapMarkup(es,offers){
 const t=(en,spanish)=>es?spanish:en;
 return `<details id="local-map" class="section panel local-map">
  <summary>${t('Nearby mechanics and parts stores','Mecánicos y repuestos cerca de ti')}</summary>
  <form><label>${t('What do you need?','¿Qué necesitas?')}<select name="category">
   <option value="auto parts store">${t('Parts stores','Tiendas de repuestos')}</option>
   <option value="auto repair shop">${t('Mechanics','Mecánicos y talleres')}</option>
   <option value="auto salvage yard">${t('Salvage yards','Desguaces y piezas usadas')}</option></select></label>
   <label>${t('Part, specialty or business (optional)','Pieza, especialidad o negocio (opcional)')}<input name="term" type="search" maxlength="100"></label>
   <label>${t('City or ZIP code','Ciudad o código ZIP')}<input name="area" maxlength="100" value="Miami, FL" required></label>
   <div class="flex"><button type="submit" class="primary">${t('Search map','Buscar en el mapa')}</button>
   <button type="button" data-nearby>${t('Use my location','Usar mi ubicación')}</button></div>
  </form><p role="status"></p><iframe title="${t('Local business map','Mapa de negocios cercanos')}" referrerpolicy="strict-origin-when-cross-origin"></iframe>
  <a data-open-maps target="_blank" rel="noopener noreferrer">${t('Open in Google Maps','Abrir en Google Maps')} ↗</a>
  <p>${t('Call the business to confirm stock, fitment and current pricing.','Llama al negocio para confirmar inventario, compatibilidad y precio.')}</p>${offers}</details>`;
}

export function mountLocalMap(root,es,getQuery){
 const form=root.querySelector('form'),frame=root.querySelector('iframe'),status=root.querySelector('[role="status"]');
 let version=0;
 function show(area){
  const q=[form.elements.category.value,form.elements.term.value.trim(),'near',area].filter(Boolean).join(' ');
  frame.src='https://maps.google.com/maps?'+new URLSearchParams({q,output:'embed',hl:es?'es':'en'});
  root.querySelector('[data-open-maps]').href='https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:q});
 }
 function search(){version++;status.textContent='';show(form.elements.area.value.trim()||'Miami, FL');}
 root.addEventListener('toggle',()=>{if(root.open&&!frame.hasAttribute('src'))search();});
 form.addEventListener('submit',event=>{event.preventDefault();search();});
 root.querySelector('[data-nearby]').addEventListener('click',()=>{
  const ticket=++version;
  const fallback=()=>{if(ticket===version)status.textContent=es?'Escribe una ciudad o ZIP para buscar.':'Enter a city or ZIP code to search.';};
  if(!navigator.geolocation){fallback();return;}
  status.textContent=es?'Buscando tu ubicación…':'Finding your location…';
  navigator.geolocation.getCurrentPosition(({coords})=>{
   if(ticket!==version||!root.isConnected)return;
   const area=coords.latitude.toFixed(3)+', '+coords.longitude.toFixed(3);
   form.elements.area.value=area;
   status.textContent=es?'Mostrando negocios cerca de tu ubicación.':'Showing businesses near your location.';
   show(area);
  },fallback,{timeout:10000,maximumAge:60000});
 });
 return mode=>{
  if(mode==='install'){form.elements.category.value='auto repair shop';form.elements.term.value='';}
  if(mode==='search'){form.elements.term.value=getQuery().slice(0,100);form.elements.category.value='auto parts store';}
  root.open=true;
  search();
  root.scrollIntoView({block:'start'});
 };
}
