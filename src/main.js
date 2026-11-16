import {createClient} from '@supabase/supabase-js';
import {money} from './money.js';
import './styles.css';

const cfg=import.meta.env;
const sb=cfg.VITE_SUPABASE_URL&&cfg.VITE_SUPABASE_PUBLISHABLE_KEY?createClient(cfg.VITE_SUPABASE_URL,cfg.VITE_SUPABASE_PUBLISHABLE_KEY):null;
const S={session:null,me:null,site:null,mine:null,admin:null,q:''},app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(name,label,value='',type='text')=>`<label>${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" required></label>`;
const date=s=>s?new Date(s).toLocaleDateString('es-US'):'—';
function toast(msg){window.alert(msg)}
function layout(inner){
 const nav=S.session?`<a href="#orders">Mis pedidos</a><a href="#sell">Vender</a>${S.me?.is_owner?'<a class="ownerlink" href="#owner">Panel Owner</a>':''}<button data-act="logout">Salir</button>`:'<a href="#login">Iniciar sesión</a>';
 app.innerHTML=`<div class="ribbon">AUTOPARTES USADAS · MARKETPLACE USA</div><header class="header"><a href="#home" class="logo">R<span>↗</span> REPARTES <em>USA</em></a><nav><a href="#home">Explorar piezas</a>${nav}</nav></header><main>${inner}</main><footer><b>REPARTES USA</b><p>Marketplace de vendedores independientes · Envíos a Estados Unidos · Los pagos se procesan en Stripe cuando estén habilitados.</p><a href="#legal">Condiciones y privacidad</a></footer>`;
}
async function api(action,method='GET',body){
 const headers={};
 if(method==='POST')headers['Content-Type']='application/json';
 if(S.session?.access_token)headers.Authorization='Bearer '+S.session.access_token;
 const r=await fetch('/api/market?action='+encodeURIComponent(action),{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let data;try{data=await r.json()}catch{throw Error('No hay respuesta válida del servidor ('+r.status+').')}
 if(!r.ok)throw Error(data.error||'Error '+r.status);
 return data;
}
const statusBadge=s=>`<span class="pill">${esc(s)}</span>`;
function home(){
 const st=S.site?.settings||{},all=S.site?.listings||[];
 const q=S.q.toLowerCase(),shown=all.filter(x=>(x.title+' '+x.make+' '+x.model+' '+x.part_number).toLowerCase().includes(q));
 const card=x=>`<a class="product" href="#part/${esc(x.id)}"><img src="${esc(x.image_url||'/placeholder.svg')}" alt="${esc(x.title)}" loading="lazy"><div><small>${esc(x.make)} · ${esc(x.model)} · ${esc(x.year_min)}–${esc(x.year_max)}</small><h3>${esc(x.title)}</h3><p>${esc(x.shop_name)}</p><strong>${money(x.price_cents)}</strong></div></a>`;
 layout(`<section class="hero"><div><div class="eyebrow">${esc(st.announcement||'MARKETPLACE DE AUTOPARTES')}</div><h1>${esc(st.hero_title||'Encuentra la pieza que necesitas.')}</h1><p>${esc(st.hero_subtitle||'Piezas reales de vendedores independientes.')}</p><div class="flex"><a class="primary" href="#catalog">Ver catálogo ↗</a><a class="secondary" href="#sell">Vender una pieza</a></div></div><div class="herographic"><span>PIEZAS REALES<br>PRECIOS CLAROS</span><b>⚙</b></div></section><section class="section" id="catalog"><div class="eyebrow">EXPLORAR</div><h2>Inventario disponible <small>${all.length} piezas</small></h2><input id="search" placeholder="Buscar por marca, modelo o número de pieza" value="${esc(S.q)}"><div class="grid" id="products">${shown.length?shown.map(card).join(''):'<div class="empty">Aún no hay piezas aprobadas. Los vendedores podrán agregar inventario real.</div>'}</div></section><section class="section three"><article><b>01</b><h3>Encuentra tu pieza</h3><p>Consulta compatibilidad, condición y precio.</p></article><article><b>02</b><h3>Paga con Stripe</h3><p>El pago estará disponible tras la activación comercial.</p></article><article><b>03</b><h3>Recibe tu compra</h3><p>El vendedor registra seguimiento de envío.</p></article></section>`);
}
function part(id){
 const x=S.site?.listings?.find(z=>z.id===id);
 if(!x){layout('<section class="section empty">Pieza no disponible. <a href="#home">Volver</a></section>');return}
 const on=!!S.site.settings?.payments_enabled;
 layout(`<section class="section"><a href="#home">← Volver al catálogo</a><div class="detail"><img src="${esc(x.image_url||'/placeholder.svg')}" alt="${esc(x.title)}"><article><div class="eyebrow">${esc(x.make)} · ${esc(x.model)}</div><h1>${esc(x.title)}</h1><h2>${money(x.price_cents)}</h2><p>Condición: ${esc(x.condition)} · Años: ${esc(x.year_min)}–${esc(x.year_max)}</p><p>Número de pieza: ${esc(x.part_number||'No especificado')}</p><p>Vendedor: ${esc(x.shop_name)}</p><button class="primary" data-act="checkout" data-id="${esc(x.id)}" ${on?'':'disabled'}>${on?'Comprar esta pieza':'Compras desactivadas'}</button><p>Envío incluido en el precio anunciado. Verifica la compatibilidad antes de comprar.</p></article></div><article class="panel"><h2>Descripción del vendedor</h2><p>${esc(x.description)}</p></article></section>`);
}
function login(){
 layout(`<section class="section"><h1>Tu cuenta RePartes USA</h1><div class="two"><form class="panel" id="signin"><h2>Iniciar sesión</h2>${field('email','Correo electrónico','','email')}${field('password','Contraseña','','password')}<button class="primary">Entrar</button></form><form class="panel" id="signup"><h2>Crear cuenta</h2>${field('display_name','Nombre')}${field('email','Correo','','email')}${field('password','Contraseña (mín. 10 caracteres)','','password')}<button class="secondary">Registrarme</button><p>Si es necesario, confirma tu dirección de correo.</p></form></div></section>`);
}
const authWall='<section class="section empty">Inicia sesión para continuar. <a href="#login">Entrar</a></section>';
function sell(){
 if(!S.session){layout(authWall);return}
 const seller=S.me?.seller,m=S.mine||{listings:[],sales:[]};
 const apply=`<form id="seller" class="panel"><h2>Solicitar cuenta de vendedor</h2>${field('shop_name','Nombre de la tienda')}<button class="primary">Solicitar revisión</button></form>`;
 const publish=`<form class="panel" id="listing"><h2>Publicar pieza</h2><p>Todos los anuncios requieren aprobación del Owner.</p>${field('title','Nombre de la pieza')}${field('make','Marca del auto')}${field('model','Modelo del auto')}${field('year_min','Año desde','2010','number')}${field('year_max','Año hasta','2020','number')}${field('part_number','Número de pieza')}${field('price','Precio USD, envío incluido','49.99')}<label>Condición<select name="condition"><option value="used">Usada</option><option value="remanufactured">Remanufacturada</option><option value="new">Nueva</option></select></label>${field('image_url','Enlace HTTPS de fotografía (opcional)')}<label>Descripción<textarea name="description" rows="5" required></textarea></label><button class="primary">Enviar para aprobación</button></form>`;
 const rows=(m.listings||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${money(x.price_cents)}</td><td>${statusBadge(x.status)}</td><td>${['pending','approved','rejected'].includes(x.status)?`<button data-act="edit" data-id="${esc(x.id)}">Editar</button>`:'—'}</td></tr>`).join('');
 const sales=(m.sales||[]).map(x=>`<tr><td>${esc(x.listings?.title||'Pieza')}</td><td>${money(x.amount_cents)}</td><td>${statusBadge(x.status)}</td><td>${x.status==='paid'?`<button data-act="ship" data-id="${esc(x.id)}">Registrar tracking</button>`:esc(x.tracking_code||'—')}</td></tr>`).join('');
 layout(`<section class="section"><h1>Centro de vendedores</h1>${!seller?apply:`<div class="panel"><h2>${esc(seller.shop_name)} ${statusBadge(seller.status)}</h2><p>Stripe Connect: ${seller.account_ready?'Listo':'Pendiente de configurar'}</p><button data-act="connect">Conectar Stripe para recibir pagos</button></div>${publish}<h2>Mis anuncios</h2>${table(['Pieza','Precio','Estado','Acción'],rows)}<h2>Ventas</h2>${table(['Pieza','Precio','Estado','Envío'],sales)}`}</section>`);
}
const table=(heads,rows)=>`<div class="tablewrap"><table><thead><tr>${heads.map(x=>'<th>'+esc(x)+'</th>').join('')}</tr></thead><tbody>${rows||'<tr><td colspan="'+heads.length+'">Sin registros</td></tr>'}</tbody></table></div>`;
function orders(){
 if(!S.session){layout(authWall);return}
 const rows=(S.mine?.purchases||[]).map(x=>`<tr><td>${esc(x.listings?.title||'Pieza')}</td><td>${money(x.amount_cents)}</td><td>${statusBadge(x.status)}</td><td>${esc(x.tracking_code||'Pendiente')}</td><td>${date(x.created_at)}</td></tr>`).join('');
 layout(`<section class="section"><h1>Mis pedidos</h1>${table(['Pieza','Importe','Estado','Seguimiento','Fecha'],rows)}</section>`);
}
const actionButton=(type,id,status,label)=>`<button data-act="${type}" data-id="${esc(id)}" data-status="${esc(status)}">${esc(label)}</button>`;
function owner(){
 if(!S.me?.is_owner){layout(authWall);return}
 const d=S.admin||{metrics:{},settings:{},sellers:[],listings:[],users:[],orders:[],audit:[]},m=d.metrics||{},settings=d.settings||{};
 const cards=[['Ventas cobradas',money(m.gross_cents)],['Comisiones brutas',money(m.commission_cents)],['Pedidos',m.orders_paid||0],['Anuncios pendientes',m.listings_pending||0],['Vendedores pendientes',m.sellers_pending||0],['Usuarios',m.buyers_total||0]];
 const sellers=(d.sellers||[]).map(x=>`<tr><td>${esc(x.shop_name)}</td><td>${statusBadge(x.status)}</td><td>${x.connect_configured?'Configurado':'Pendiente'}</td><td>${actionButton('sellerstatus',x.user_id,'approved','Aprobar')} ${actionButton('sellerstatus',x.user_id,'suspended','Suspender')}</td></tr>`).join('');
 const listings=(d.listings||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${money(x.price_cents)}</td><td>${statusBadge(x.status)}</td><td>${['reserved','sold'].includes(x.status)?'Bloqueado':actionButton('listingstatus',x.id,'approved','Aprobar')+' '+actionButton('listingstatus',x.id,'rejected','Rechazar')+' '+actionButton('listingstatus',x.id,'removed','Ocultar')}</td></tr>`).join('');
 const purchases=(d.orders||[]).map(x=>`<tr><td>${esc(x.listings?.title||'Pieza')}</td><td>${money(x.amount_cents)}</td><td>${money(x.platform_fee_cents)}</td><td>${statusBadge(x.status)}</td><td>${['paid','shipped'].includes(x.status)?actionButton('refund',x.id,'','Reembolso'):'—'}</td></tr>`).join('');
 const users=(d.users||[]).map(x=>`<tr><td>${esc(x.display_name||'Sin nombre')}</td><td>${x.is_banned?'Suspendido':'Activo'}</td><td>${actionButton('userban',x.id,x.is_banned?'unban':'ban',x.is_banned?'Reactivar':'Suspender')}</td></tr>`).join('');
 layout(`<section class="section"><div class="eyebrow">PANEL PRIVADO · CONTROL ADMINISTRATIVO</div><h1>Dashboard Owner</h1><p>Las métricas provienen de órdenes reales; las comisiones no son ganancias netas.</p><div class="metrics">${cards.map(([name,val])=>`<article class="metric"><small>${esc(name)}</small><strong>${esc(val)}</strong></article>`).join('')}</div><form class="panel" id="settings"><h2>Control de la página principal</h2>${field('hero_title','Título',settings.hero_title||'')}${field('hero_subtitle','Subtítulo',settings.hero_subtitle||'')}${field('announcement','Anuncio',settings.announcement||'')}${field('support_email','Correo de soporte',settings.support_email||'','email')}${field('commission_bps','Comisión en puntos base (1500 = 15%)',settings.commission_bps||1500,'number')}<label class="check"><input name="payments_enabled" type="checkbox" ${settings.payments_enabled?'checked':''}> Permitir compras (solo tras verificar Stripe)</label><button class="primary">Guardar configuración</button></form><h2>Vendedores</h2>${table(['Tienda','Estado','Stripe','Acciones'],sellers)}<h2>Moderación de piezas</h2>${table(['Pieza','Precio','Estado','Acciones'],listings)}<h2>Pedidos y reembolsos</h2>${table(['Pieza','Importe','Comisión','Estado','Acción'],purchases)}<h2>Usuarios</h2>${table(['Usuario','Estado','Acción'],users)}<h2>Auditoría</h2><div class="panel">${(d.audit||[]).slice(0,30).map(x=>`<p>${esc(x.action)} · ${date(x.created_at)} · ${esc(x.target_id||'')}</p>`).join('')||'Sin eventos registrados'}</div></section>`);
}
function legal(){layout('<section class="section panel"><h1>Condiciones y privacidad</h1><p>Esta plataforma conecta compradores con vendedores independientes. Los vendedores son responsables de la descripción, origen, seguridad, compatibilidad y entrega de las piezas. Los pagos serán procesados con Stripe.</p><p>Antes de aceptar ventas reales deben publicarse políticas definitivas de privacidad, devoluciones, restricciones de productos y resolución de disputas; el contenido actual es informativo y no sustituye asesoría legal.</p></section>')}
let version=0;
async function route(){
 const current=++version,hash=(location.hash||'#home').slice(1),[p,id]=hash.split('/');
 layout('<section class="section"><h2>Cargando datos…</h2></section>');
 try{
  if(['orders','sell'].includes(p)&&S.session)S.mine=await api('mine');
  if(p==='owner'&&S.me?.is_owner)S.admin=await api('dashboard');
  if(version!==current)return;
  if(p==='home'||p==='catalog'||!p)home();else if(p==='part')part(id);else if(p==='login')login();else if(p==='sell')sell();else if(p==='orders')orders();else if(p==='owner')owner();else if(p==='legal')legal();else home();
 }catch(err){layout('<section class="section empty"><h2>La operación no se pudo completar</h2><p>'+esc(err.message)+'</p><button data-act="retry">Reintentar</button></section>')}
}
async function refreshIdentity(){S.me=S.session?await api('me'):null}
async function refreshCatalog(){S.site=await api('site')}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-act]');if(!b)return;
 const a=b.dataset.act,id=b.dataset.id,status=b.dataset.status;
 b.disabled=true;
 try{
  if(a==='retry'){await route();return}
  if(a==='logout'){await sb.auth.signOut();S.session=null;S.me=null;location.hash='#home';await route();return}
  if(a==='connect'){const r=await api('seller.connect','POST',{});if(new URL(r.url).protocol!=='https:')throw Error('Enlace no seguro');location.href=r.url;return}
  if(a==='checkout'){if(!S.session){location.hash='#login';return}if(!confirm('Continuar al pago protegido por Stripe?'))return;const r=await api('checkout','POST',{listing_id:id});if(new URL(r.url).protocol!=='https:')throw Error('Enlace no seguro');location.href=r.url;return}
  if(a==='edit'){const x=S.mine?.listings?.find(z=>z.id===id),f=document.getElementById('listing');if(x&&f){for(const [k,v] of Object.entries(x)){const elem=f.elements.namedItem(k);if(elem)elem.value=v??''}f.elements.namedItem('price').value=(x.price_cents/100).toFixed(2);f.dataset.id=id;f.scrollIntoView();toast('Pieza cargada. Al guardar deberá aprobarse nuevamente.')}return}
  if(a==='ship'){const t=prompt('Número real de seguimiento');if(!t)return;await api('order.ship','POST',{id,tracking_code:t});toast('Seguimiento guardado');await route();return}
  const actions={sellerstatus:'admin.seller',listingstatus:'admin.listing',userban:'admin.ban',refund:'admin.refund'};
  if(actions[a]){
   if(!confirm('Confirmar esta operación administrativa?'))return;
   const payload=a==='userban'?{id,is_banned:status==='ban'}:a==='refund'?{id}:{id,status};
   await api(actions[a],'POST',payload);toast('Cambio registrado');await route();
  }
 }catch(err){toast(err.message)}finally{if(b.isConnected)b.disabled=false}
});
document.addEventListener('input',ev=>{if(ev.target.id==='search'){S.q=ev.target.value;home();document.getElementById('search')?.focus()}});
document.addEventListener('submit',async ev=>{
 const f=ev.target;if(!['signin','signup','seller','listing','settings'].includes(f.id))return;ev.preventDefault();
 const v=Object.fromEntries(new FormData(f).entries()),button=f.querySelector('button');if(button)button.disabled=true;
 try{
  if(f.id==='signin'){const {error}=await sb.auth.signInWithPassword({email:v.email,password:v.password});if(error)throw error;location.hash='#home'}
  if(f.id==='signup'){if(v.password.length<10)throw Error('Contraseña demasiado corta');const {data,error}=await sb.auth.signUp({email:v.email,password:v.password,options:{data:{display_name:v.display_name}}});if(error)throw error;toast(data.session?'Cuenta creada':'Verifica tu correo electrónico');if(data.session)location.hash='#home'}
  if(f.id==='seller'){await api('seller.apply','POST',v);await refreshIdentity();toast('Solicitud enviada al Owner')}
  if(f.id==='listing'){if(f.dataset.id)v.id=f.dataset.id;await api('listing.save','POST',v);toast('Pieza enviada a revisión')}
  if(f.id==='settings'){v.commission_bps=Number(v.commission_bps);v.payments_enabled=f.elements.namedItem('payments_enabled').checked;await api('admin.settings','POST',v);toast('Configuración actualizada');await refreshCatalog()}
  await route();
 }catch(err){toast(err.message)}finally{if(button?.isConnected)button.disabled=false}
});
window.addEventListener('hashchange',route);
(async()=>{
 if(!sb){layout('<section class="section empty"><h2>Configuración de Supabase pendiente</h2><p>Define las variables públicas VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Netlify para conectar el catálogo y las cuentas.</p></section>');return}
 try{
  const {data}=await sb.auth.getSession();S.session=data.session;
  await Promise.all([refreshCatalog(),refreshIdentity()]);
  sb.auth.onAuthStateChange((_event,session)=>{S.session=session;setTimeout(async()=>{try{await refreshIdentity();await route()}catch(err){toast(err.message)}},0)});
  await route();
 }catch(err){layout('<section class="section empty"><h2>No fue posible conectar RePartes USA</h2><p>'+esc(err.message)+'</p><button data-act="retry">Reintentar</button></section>')}
})();
