// Each answer links to the same workflow available in the storefront.
const topics=[
 {words:'foto fotos camara galeria album imagen photo camera upload picture',label:['Upload photos','Subir fotos'],answer:['Use the photo field to choose a JPG, PNG or WebP up to 5 MB. On iPhone, choose Photo Library or Files. If your photo is HEIC, export it as JPEG first.','Toca el campo de foto y elige Fototeca o Archivos en tu iPhone. Usa JPG, PNG o WebP de hasta 5 MB. Si la foto es HEIC, expórtala como JPEG.'],url:'#sell'},
 {words:'devolucion devolver reembolso return refund damaged danado',label:['Returns','Devoluciones'],answer:['For a marketplace order, open My orders and select the return option. The return window is 30 calendar days from confirmed delivery. For an eBay purchase, open the order on eBay.','Para una compra del marketplace, entra en Mis pedidos y selecciona la devolución. Tienes 30 días naturales desde la entrega confirmada. Para compras en eBay, abre el pedido en eBay.'],url:'#orders'},
 {words:'cotizacion cotizaciones presupuesto quote quotes quotation oferta',label:['Private quotes','Cotizaciones privadas'],answer:['Open the complete private link the team shared with you. If a quote is missing, it may have been withdrawn. Reply to whoever shared the link for updated availability.','Abre el enlace privado completo que recibiste. Si falta una oferta, puede que se haya retirado. Responde a quien te envió el enlace para confirmar la disponibilidad.']},
 {words:'mapa map mecanico mecanicos mechanic garage ubicacion location nearby cerca cercanos zip',label:['Map and location','Mapa y ubicación'],answer:['Open the local map and enter a city or ZIP code. To search from your phone, select Use my location and allow access when prompted.','Abre el mapa local y escribe tu ciudad o ZIP. Para buscar desde tu teléfono, toca Usar mi ubicación y permite el acceso cuando se te solicite.'],url:'#home/map'},
 {words:'cuenta correo contrasena entrar login password sign account registro registrar email acceso',label:['Account access','Acceso a la cuenta'],answer:['Sign in with the email used to register. If verification is pending, check your inbox and spam folder for the confirmation message. For a password or access issue that persists, contact support below.','Inicia sesión con el correo que usaste al registrarte. Si falta la confirmación, revisa tu bandeja de entrada y la carpeta de spam. Si persiste el problema de contraseña o acceso, usa el contacto de soporte de abajo.'],url:'#login'},
 {words:'pedido pedidos tracking envio entrega order orders shipping delivery rastreo',label:['Order tracking','Seguimiento de pedidos'],answer:['Open My orders with the account used for the purchase. Tracking appears when the seller records the shipment. Purchases completed on eBay are tracked in your eBay account.','Abre Mis pedidos con la cuenta que usaste para comprar. El seguimiento aparece cuando el vendedor registra el envío. Las compras realizadas en eBay se consultan en tu cuenta de eBay.'],url:'#orders'},
 {words:'pieza piezas busqueda buscar repuesto oem alternador parts part search find stock',label:['Find a part','Encontrar una pieza'],answer:['Search by part, vehicle or OEM number. If there is no match, select Request a part, or open the local map to contact nearby stores.','Busca por pieza, vehículo o número OEM. Si no hay coincidencias, toca Solicitar una pieza o abre el mapa local para contactar tiendas cercanas.'],url:'#home'}
];
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[];
export function matchSupportTopic(input){
 const tokens=new Set(normalize(input));
 let best=null,score=0;
 for(const topic of topics){
  const matches=topic.words.split(' ').filter(word=>tokens.has(word)).length;
  if(matches>score){score=matches;best=topic;}
 }
 return best;
}

export function supportPage({layout,language,email,esc,send}){
 const i=language==='es'?1:0,t=(en,es)=>i?es:en;
 const contact=/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email||'')
  ?`<a href="mailto:${esc(email)}">${esc(email)}</a>`:'<a href="#contact">'+t('Contact page','Página de contacto')+'</a>';
 layout(`<section class="section"><div class="panel"><h1>${t('Automated support','Soporte técnico automatizado')}</h1>
 <form id="support-question"><label>${t('What do you need help with?','¿Con qué necesitas ayuda?')}<input name="question" type="search" maxlength="300" required placeholder="${t('For example, how do I upload a photo?','Por ejemplo, ¿cómo subo una foto?')}"></label><button class="primary">${t('Find an answer','Buscar respuesta')}</button></form>
 <div class="flex" id="support-topics">${topics.map((item,n)=>`<button type="button" data-topic="${n}">${item.label[i]}</button>`).join('')}</div>
 <div role="status" aria-live="polite" id="support-answer"></div>
 <form id="support-send"><h2>${t('Message the team','Escribir al equipo')}</h2><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>${t('Your message','Tu mensaje')}<textarea name="message" required minlength="3" maxlength="1000"></textarea></label><button class="primary">${t('Send message','Enviar mensaje')}</button><p role="status"></p></form>
 <p>${t('For personal assistance','Para atención personal')} · ${contact}</p></div></section>`);
 const inbox=document.getElementById('support-send');
 let requestId=crypto.randomUUID();
 inbox.onsubmit=async event=>{
  event.preventDefault();
  const button=inbox.querySelector('button'),status=inbox.querySelector('[role="status"]');
  if(button.disabled)return;
  button.disabled=true;
  const message=inbox.elements.message.value.trim();
  try{
   const result=await send({id:requestId,email:inbox.elements.email.value,message});
   const topic=matchSupportTopic(message);
   status.textContent=t('Automated reply: We received your message. Your reference is ','Respuesta automática: Recibimos tu mensaje. Tu referencia es ')+result.reference+'. '+(topic?topic.answer[i]:t('Our team can follow up using the email you provided.','El equipo puede responder al correo que indicaste.'));
   inbox.reset();requestId=crypto.randomUUID();
  }catch(error){status.textContent=error.message}
  finally{button.disabled=false}
 };
 const answer=document.getElementById('support-answer');
 function show(topic){
  answer.innerHTML=topic?`<h2>${topic.label[i]}</h2><p>${topic.answer[i]}</p>${topic.url?`<a class="secondary" href="${topic.url}">${t('Open this section','Abrir esta sección')}</a>`:''}`:
   '<p>'+t('Choose a topic above or use the support contact below.','Elige uno de los temas de arriba o usa el contacto de soporte de abajo.')+'</p>';
 }
 document.getElementById('support-question').onsubmit=event=>{event.preventDefault();show(matchSupportTopic(event.currentTarget.elements.question.value));};
 document.getElementById('support-topics').onclick=event=>{const button=event.target.closest('[data-topic]');if(button)show(topics[Number(button.dataset.topic)]);};
}
