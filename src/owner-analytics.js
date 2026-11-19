import {money} from './money.js';

const pageLabels={
 home:['Home','Inicio'],catalog:['Catalog','Catálogo'],part:['Part detail','Ficha de pieza'],
 quotes:['Quote comparison','Comparación de cotizaciones'],login:['Sign in / register','Acceso y registro'],
 sell:['Seller center','Centro de vendedores'],orders:['Orders','Pedidos'],return:['Returns','Devoluciones'],
 review:['Part review','Reseña de pieza'],feedback:['Site feedback','Opinión sobre la web'],referrals:['Referrals','Referidos'],
 about:['About','Nosotros'],contact:['Contact','Contacto'],shipping:['Shipping and returns','Envíos y devoluciones'],
 privacy:['Privacy','Privacidad'],terms:['Terms','Términos'],advertising:['Affiliates and advertising','Afiliados y publicidad'],
 guide_en:['Buying guide (EN)','Guía de compra (EN)'],guide_es:['Buying guide (ES)','Guía de compra (ES)']
};
const sourceLabels={
 direct:['Direct / no referrer','Directo / sin referencia'],google:['Google','Google'],bing:['Bing','Bing'],
 tiktok:['TikTok','TikTok'],facebook:['Facebook','Facebook'],instagram:['Instagram','Instagram'],
 threads:['Threads','Threads'],x:['X','X'],telegram:['Telegram','Telegram'],youtube:['YouTube','YouTube'],
 pinterest:['Pinterest','Pinterest'],reddit:['Reddit','Reddit'],email:['Email','Correo'],other:['Other websites','Otros sitios web']
};
const deviceLabels={mobile:['Phone or tablet','Teléfono o tableta'],desktop:['Computer','Computadora']};

export function mountOwnerAnalytics(root,{api,language,esc}){
 if(!root)return;
 const spanish=language==='es',text=(en,es)=>spanish?es:en;
 const locale=spanish?'es-US':'en-US';
 const fmt=n=>new Intl.NumberFormat(locale).format(Number(n)||0);
 const date=new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',timeZone:'UTC'});
 const label=(items,key)=>items[key]?.[spanish?1:0]||'';
 const rangeKey='repartes:analytics-range';
 let saved='7';
 try{saved=sessionStorage.getItem(rangeKey)||'7';}catch{}
 root.innerHTML=`<div class="analytics-heading">
   <h2>Analytics</h2>
   <div class="analytics-controls"><label>${text('Period','Período')}
    <select data-analytics-range>${[7,30,90].map(days=>`<option value="${days}" ${String(days)===saved?'selected':''}>${text('Last '+days+' days','Últimos '+days+' días')}</option>`).join('')}</select>
   </label><button type="button" data-analytics-refresh>${text('Refresh','Actualizar')}</button></div>
  </div>
  <p class="analytics-caption">${text('Miami time. A visit is a browser-tab session that resets after 30 minutes of inactivity. Web traffic starts counting from activation.','Hora de Miami. Una visita es una sesión por pestaña que se reinicia después de 30 minutos de inactividad. El tráfico se cuenta desde que se activó la medición.')}</p>
  <p data-analytics-status role="status" hidden></p><div data-analytics-content></div>`;

 const picker=root.querySelector('[data-analytics-range]');
 const refresh=root.querySelector('[data-analytics-refresh]');
 const status=root.querySelector('[data-analytics-status]');
 const content=root.querySelector('[data-analytics-content]');

 function rows(title,entries){
  return `<section class="analytics-list"><h3>${title}</h3>${entries.length?
   `<dl>${entries.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${fmt(value)}</dd></div>`).join('')}</dl>`:
   `<p>${text('No activity in this period.','Sin actividad en este período.')}</p>`}</section>`;
 }
 function render(data){
  const a=data.activity;
  const cards=[
   [text('Visits','Visitas'),fmt(data.visits)], [text('Page views','Páginas vistas'),fmt(data.views)],
   [text('Searches','Búsquedas'),fmt((a.search||0)+(a.oem_search||0))],
   [text('Part requests','Solicitudes de piezas'),fmt(data.requests)],
   [text('Quotes created','Cotizaciones creadas'),fmt(data.quotes)],
   [text('New accounts','Cuentas nuevas'),fmt(data.registrations)],
   [text('Confirmed sales','Ventas confirmadas'),fmt(data.sales.orders)],
   [text('Gross sales','Ventas brutas'),money(data.sales.gross_cents)]
  ];
  const chartMax=Math.max(1,...data.daily.map(day=>day.views));
  const hasViews=data.daily.some(day=>day.views>0);
  const dayLabel=day=>date.format(new Date(day+'T00:00:00Z'));
  const attribution=[
   [text('OEM searches','Búsquedas OEM'),a.oem_search],
   [text('Searches with no matches','Búsquedas sin coincidencias'),a.no_results],
   [text('eBay listing clicks','Clics en anuncios de eBay'),a.ebay_click],
   [text('Other partner clicks','Clics en otros socios'),a.partner_click],
   [text('Quote links opened','Enlaces de cotización abiertos'),a.quote_open]
  ];
  content.innerHTML=`<div class="metrics analytics-metrics">${cards.map(([name,value])=>
   `<article class="metric"><small>${name}</small><strong>${value}</strong></article>`).join('')}</div>
   <section class="analytics-chart"><h3>${text('Page views by day','Páginas vistas por día')}</h3>
   ${hasViews?`<div class="analytics-plot" aria-hidden="true"><div class="analytics-bars" style="min-width:${data.daily.length*8}px">
    ${data.daily.map(day=>`<div title="${esc(dayLabel(day.day)+' · '+fmt(day.views))}" style="--height:${Math.max(2,100*day.views/chartMax)}%"></div>`).join('')}
   </div></div><div class="analytics-dates"><span>${dayLabel(data.daily[0].day)}</span><span>${dayLabel(data.daily.at(-1).day)}</span></div>
   <details><summary>${text('Daily totals','Totales diarios')}</summary>
    <table><thead><tr><th scope="col">${text('Day','Día')}</th><th scope="col">${text('Visits','Visitas')}</th><th scope="col">${text('Page views','Páginas vistas')}</th></tr></thead>
    <tbody>${data.daily.slice().reverse().map(day=>`<tr><th scope="row">${dayLabel(day.day)}</th><td>${fmt(day.visits)}</td><td>${fmt(day.views)}</td></tr>`).join('')}</tbody></table>
   </details>`:`<p>${text('No page views recorded in this period.','Todavía no hay páginas vistas en este período.')}</p>`}
   </section>
   <div class="analytics-breakdowns">
    ${rows(text('Most viewed pages','Páginas más vistas'),data.pages.map(x=>[label(pageLabels,x.page),x.views]))}
    ${rows(text('Traffic sources','Fuentes de tráfico'),data.sources.map(x=>[label(sourceLabels,x.source),x.visits]))}
    ${rows(text('Devices','Dispositivos'),data.devices.map(x=>[label(deviceLabels,x.device),x.visits]))}
    ${rows(text('Search and quote activity','Actividad de búsqueda y cotizaciones'),attribution)}
   </div>
   <p class="analytics-caption">${text('Gross marketplace commission','Comisión bruta del marketplace')} <strong>${money(data.sales.fee_cents)}</strong></p>`;
 }

 let request=0;
 async function load(){
  const current=++request;
  const days=picker.value;
  status.hidden=false;
  status.textContent=text('Loading analytics…','Cargando métricas…');
  content.setAttribute('aria-busy','true');
  try{
   const report=await api('analytics.report','GET',{days});
   if(current!==request||!root.isConnected)return;
   render(report);
   status.hidden=true;
  }catch{
   if(current!==request||!root.isConnected)return;
   content.replaceChildren();
   status.textContent=text('Analytics could not load. Tap Refresh to retry.','No se pudieron cargar las métricas. Toca Actualizar para volver a intentar.');
  }finally{
   if(current===request)content.removeAttribute('aria-busy');
  }
 }
 picker.addEventListener('change',()=>{
  try{sessionStorage.setItem(rangeKey,picker.value);}catch{}
  content.replaceChildren();
  void load();
 });
 refresh.addEventListener('click',load);
 void load();
}
