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
const activityLabels={
 view:['Page viewed','Página vista'],search:['Search','Búsqueda'],oem_search:['OEM search','Búsqueda OEM'],
 no_results:['No matching parts','Sin coincidencias'],ebay_click:['eBay click','Clic hacia eBay'],
 partner_click:['Partner link click','Clic hacia un socio'],quote_open:['Quote link opened','Enlace de cotización abierto'],
 part_request:['Part request submitted','Solicitud de pieza recibida'],quote_created:['Quote created','Cotización creada'],
 registration:['Account created','Cuenta creada'],sale:['Sale confirmed','Venta confirmada']
};
const refreshInterval=10000;


export function mountOwnerAnalytics(root,{api,language,esc}){
 if(!root)return;
 const spanish=language==='es',text=(en,es)=>spanish?es:en;
 const locale=spanish?'es-US':'en-US';
 const countFormat=new Intl.NumberFormat(locale);
 const decimalFormat=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
 const percentFormat=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1});
 const fmt=n=>countFormat.format(Number(n)||0);
 const ratio=(numerator,denominator,format)=>denominator>0?format.format(numerator/denominator):'—';
 const date=new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',timeZone:'UTC'});
 const clock=new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit',second:'2-digit',timeZone:'America/New_York'});
 const label=(items,key)=>items[key]?.[spanish?1:0]||'';
 const rangeKey='repartes:analytics-range';
 let saved='7';
 try{saved=sessionStorage.getItem(rangeKey)||'7';}catch{}
 root.innerHTML=`<div class="analytics-heading">
   <div class="analytics-title"><h2>Analytics</h2><span class="analytics-live-badge" data-analytics-live></span></div>
   <div class="analytics-controls"><label>${text('Period','Período')}
    <select data-analytics-range>${[7,30,90].map(days=>`<option value="${days}" ${String(days)===saved?'selected':''}>${text('Last '+days+' days','Últimos '+days+' días')}</option>`).join('')}</select>
   </label><button type="button" data-analytics-refresh>${text('Refresh','Actualizar')}</button></div>
  </div>
  <p class="analytics-caption">${text('Miami time. A visit is a browser-tab session that resets after 30 minutes of inactivity. Web traffic starts counting from activation.','Hora de Miami. Una visita es una sesión por pestaña que se reinicia después de 30 minutos de inactividad. El tráfico se cuenta desde que se activó la medición.')}</p>
  <p class="analytics-caption"><span data-analytics-updated></span> ${text('Updates automatically every 10 seconds while this tab is visible.','Se actualiza cada 10 segundos mientras esta pestaña está visible.')}</p>
  <p data-analytics-status role="status" hidden></p>
  <section class="analytics-live-panel" data-analytics-recent hidden></section>
  <div data-analytics-content></div>`;

 const picker=root.querySelector('[data-analytics-range]');
 const refresh=root.querySelector('[data-analytics-refresh]');
 const status=root.querySelector('[data-analytics-status]');
 const content=root.querySelector('[data-analytics-content]');
 const livePanel=root.querySelector('[data-analytics-recent]');
 const badge=root.querySelector('[data-analytics-live]');
 const updated=root.querySelector('[data-analytics-updated]');

 function renderLive(data){
  livePanel.hidden=false;
  livePanel.innerHTML=`<div class="analytics-presence">
   <strong>${fmt(data.active_sessions)}</strong>
   <div><h3>${text('Active sessions','Sesiones activas')}</h3><p>${text('Activity in the last 5 minutes','Con actividad en los últimos 5 minutos')}</p></div>
  </div>
  <div class="analytics-feed"><h3>${text('Recent activity','Actividad reciente')}</h3>
   ${data.recent.length?`<ol>${data.recent.map(activity=>{
    const details=[label(pageLabels,activity.page),label(sourceLabels,activity.source)].filter(Boolean);
    return `<li><div><strong>${esc(label(activityLabels,activity.kind))}</strong>${details.length?`<span>${esc(details.join(' · '))}</span>`:''}</div>
     <time datetime="${esc(activity.occurred_at)}">${clock.format(new Date(activity.occurred_at))}</time></li>`;
   }).join('')}</ol>`:`<p>${text('No events in the last 15 minutes.','Sin eventos en los últimos 15 minutos.')}</p>`}
  </div>`;
 }

 function rows(title,entries,format=fmt){
  return `<section class="analytics-list"><h3>${title}</h3>${entries.length?
   `<dl>${entries.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(format(value))}</dd></div>`).join('')}</dl>`:
   `<p>${text('No activity in this period.','Sin actividad en este período.')}</p>`}</section>`;
 }
 function render(data){
  const wasExpanded=Boolean(content.querySelector('details')?.open);
  const summaryWasFocused=content.querySelector('summary')===document.activeElement;
  const plotScroll=content.querySelector('.analytics-plot')?.scrollLeft||0;
  const a=data.activity;
  const searches=(a.search||0)+(a.oem_search||0);
  const outboundClicks=(a.ebay_click||0)+(a.partner_click||0);
  const cards=[
   [text('Visits','Visitas'),fmt(data.visits)], [text('Page views','Páginas vistas'),fmt(data.views)],
   [text('Searches','Búsquedas'),fmt(searches)],
   [text('Part requests','Solicitudes de piezas'),fmt(data.requests)],
   [text('Quotes created','Cotizaciones creadas'),fmt(data.quotes)],
   [text('New accounts','Cuentas nuevas'),fmt(data.registrations)],
   [text('Confirmed sales','Ventas confirmadas'),fmt(data.sales.orders)],
   [text('Gross sales','Ventas brutas'),money(data.sales.gross_cents)],
   [text('Outbound shopping clicks','Clics hacia tiendas externas'),fmt(outboundClicks)]
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
  const performance=[
   [text('Pages viewed per visit','Páginas vistas por visita'),ratio(data.views,data.visits,decimalFormat)],
   [text('Searches with no matches (%)','Búsquedas sin coincidencias (%)'),ratio(a.no_results||0,searches,percentFormat)],
   [text('OEM searches as share of all searches','Búsquedas OEM del total'),ratio(a.oem_search||0,searches,percentFormat)],
   [text('Average confirmed order','Valor promedio del pedido confirmado'),data.sales.orders>0?money(Math.round(data.sales.gross_cents/data.sales.orders)):'—']
  ];
  const shareRows=(entries,total)=>entries.map(([name,value])=>[
   name,total>0?fmt(value)+' · '+ratio(value,total,percentFormat):fmt(value)
  ]);
  content.innerHTML=`<div class="metrics analytics-metrics">${cards.map(([name,value])=>
   `<article class="metric"><small>${name}</small><strong>${value}</strong></article>`).join('')}</div>
   ${rows(text('Search and sales performance','Rendimiento de búsqueda y ventas'),performance,value=>value)}
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
    ${rows(text('Traffic sources','Fuentes de tráfico'),shareRows(data.sources.map(x=>[label(sourceLabels,x.source),x.visits]),data.visits),value=>value)}
    ${rows(text('Devices','Dispositivos'),shareRows(data.devices.map(x=>[label(deviceLabels,x.device),x.visits]),data.visits),value=>value)}
    ${rows(text('Search and quote activity','Actividad de búsqueda y cotizaciones'),attribution)}
    ${rows(text('Outbound clicks by destination','Clics externos por destino'),shareRows([
     ['eBay',a.ebay_click||0],
     [text('Other affiliate and partner links','Otros enlaces de afiliados y socios'),a.partner_click||0]
    ],outboundClicks),value=>value)}
   </div>
   <p class="analytics-caption">${text('Gross marketplace commission','Comisión bruta del marketplace')} <strong>${money(data.sales.fee_cents)}</strong></p>`;
  const daily=content.querySelector('details');
  if(daily)daily.open=wasExpanded;
  if(summaryWasFocused)content.querySelector('summary')?.focus({preventScroll:true});
  const plot=content.querySelector('.analytics-plot');
  if(plot)plot.scrollLeft=plotScroll;
 }

 let timer,pending,metricsSnapshot,recentSnapshot;

 function connection(state,en,es){
  badge.dataset.state=state;
  badge.textContent=text(en,es);
 }
 function pause(){
  clearTimeout(timer);
  const current=pending;
  pending=undefined;
  current?.abort();
 }
 async function load(){
  if(!root.isConnected||document.hidden||pending)return;
  clearTimeout(timer);
  const current=new AbortController();
  pending=current;
  const timeout=setTimeout(()=>current.abort(),15000);
  if(metricsSnapshot===undefined){
   connection('connecting','Connecting','Conectando');
   status.hidden=false;
   status.textContent=text('Loading analytics…','Cargando métricas…');
  }
  try{
   const {live,...metrics}=await api('analytics.report','GET',{days:picker.value},{signal:current.signal});
   if(pending!==current||!root.isConnected)return;
   const nextMetrics=JSON.stringify(metrics);
   if(metricsSnapshot!==nextMetrics){
    render(metrics);
    metricsSnapshot=nextMetrics;
   }
   const {observed_at,...recent}=live;
   const nextRecent=JSON.stringify(recent);
   if(recentSnapshot!==nextRecent){
    renderLive(recent);
    recentSnapshot=nextRecent;
   }
   updated.textContent=text('Last update','Última actualización')+' '+clock.format(new Date(observed_at))+'.';
   connection('live','Live','En vivo');
   status.hidden=true;
  }catch{
   if(pending!==current||!root.isConnected)return;
   connection('retrying','Reconnecting','Reconectando');
   status.hidden=false;
   status.textContent=text('Analytics are reconnecting.','Reconectando Analytics.');
  }finally{
   clearTimeout(timeout);
   if(pending===current){
    pending=undefined;
    if(root.isConnected&&!document.hidden)timer=setTimeout(load,refreshInterval);
   }
  }
 }
 function visibility(){
  if(document.hidden){
   pause();
   connection('paused','Paused','En pausa');
  }else void load();
 }
 picker.addEventListener('change',()=>{
  try{sessionStorage.setItem(rangeKey,picker.value);}catch{}
  pause();
  metricsSnapshot=undefined;
  content.replaceChildren();
  void load();
 });
 refresh.addEventListener('click',load);
 document.addEventListener('visibilitychange',visibility);
 visibility();
 return ()=>{
  pause();
  document.removeEventListener('visibilitychange',visibility);
 };
}
