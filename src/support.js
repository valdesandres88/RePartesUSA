// Each answer links to the same workflow available in the storefront.
const topics=[
 {words:'foto fotos camara galeria album imagen photo camera upload picture',label:['Upload photos','Subir fotos'],answer:['Use the photo field to choose a JPG, PNG or WebP up to 5 MB. On iPhone, choose Photo Library or Files. If your photo is HEIC, export it as JPEG first.','Toca el campo de foto y elige Fototeca o Archivos en tu iPhone. Usa JPG, PNG o WebP de hasta 5 MB. Si la foto es HEIC, expórtala como JPEG.'],url:'#sell'},
 {words:'devolucion devolver reembolso return refund damaged danado',label:['Returns','Devoluciones'],answer:['For a marketplace order, open My orders and select the return option. The return window is 30 calendar days from confirmed delivery. For an eBay purchase, open the order on eBay.','Para una compra del marketplace, entra en Mis pedidos y selecciona la devolución. Tienes 30 días naturales desde la entrega confirmada. Para compras en eBay, abre el pedido en eBay.'],url:'#orders'},
 {words:'cotizacion cotizaciones presupuesto quote quotes quotation oferta',label:['Private quotes','Cotizaciones privadas'],answer:['Open the complete private link the team shared with you. If a quote is missing, it may have been withdrawn. Reply to whoever shared the link for updated availability.','Abre el enlace privado completo que recibiste. Si falta una oferta, puede que se haya retirado. Responde a quien te envió el enlace para confirmar la disponibilidad.']},
 {words:'mapa map mecanico mecanicos mechanic garage ubicacion location nearby cerca cercanos zip',label:['Map and location','Mapa y ubicación'],answer:['Open the local map and enter a city or ZIP code. To search from your phone, select Use my location and allow access when prompted.','Abre el mapa local y escribe tu ciudad o ZIP. Para buscar desde tu teléfono, toca Usar mi ubicación y permite el acceso cuando se te solicite.'],url:'#home/map'},
 {words:'cuenta correo contrasena entrar login password sign account registro registrar email acceso',label:['Account access','Acceso a la cuenta'],answer:['Sign in with the email used to register. If verification is pending, check your inbox and spam folder for the confirmation message. For a password or access issue that persists, send a message in the support chat.','Inicia sesión con el correo que usaste al registrarte. Si falta la confirmación, revisa tu bandeja de entrada y la carpeta de spam. Si persiste el problema de contraseña o acceso, escribe en el chat de soporte.'],url:'#login'},
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

export function supportPage({layout,language,send}){
 const i=language==='es'?1:0,t=(en,es)=>i?es:en;
 layout(`<section class="section"><h1>${t('Help center','Centro de ayuda')}</h1>
 <p><button type="button" class="primary" id="open-support-chat">${t('Chat with support','Chat con soporte')}</button></p>
 <section class="panel" aria-labelledby="support-faq-title"><h2 id="support-faq-title">${t('Frequently asked questions','Preguntas frecuentes')}</h2>
 ${topics.map(topic=>`<details><summary>${topic.label[i]}</summary><p>${topic.answer[i]}</p>${topic.url?`<p><a href="${topic.url}">${t('Open this section','Abrir esta sección')}</a></p>`:''}</details>`).join('')}</section>
 <section class="panel" id="support-chat" aria-labelledby="support-chat-title" hidden>
 <h2 id="support-chat-title" tabindex="-1">${t('Chat with support','Chat con soporte')}</h2>
 <p>${t('Send a message to our team. You may see an automatic answer here. Leave your email so the team can follow up.','Envía un mensaje al equipo. Podrías ver una respuesta automática aquí. Deja tu correo para que el equipo pueda responderte.')}</p>
 <div role="log" aria-label="${t('Chat messages','Mensajes del chat')}" id="support-log"></div>
 <form id="support-send"><label>${t('Your email','Tu correo electrónico')}<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
 <label>${t('Your message','Tu mensaje')}<textarea name="message" required minlength="3" maxlength="1000"></textarea></label>
 <button class="primary">${t('Send message','Enviar mensaje')}</button><p role="status"></p></form></section></section>`);
 const chat=document.getElementById('support-chat');
 function openChat(){
  chat.hidden=false;
  chat.querySelector('h2').focus({preventScroll:true});
  chat.scrollIntoView({block:'center',behavior:'instant'});
 }
 document.getElementById('open-support-chat').onclick=openChat;
 const inbox=document.getElementById('support-send'),log=document.getElementById('support-log');
 function addMessage(label,text){
  const entry=document.createElement('div'),author=document.createElement('strong'),body=document.createElement('p');
  entry.className='panel';
  author.textContent=label;
  body.textContent=text;
  entry.append(author,body);
  log.append(entry);
 }
 let requestId=crypto.randomUUID();
 inbox.onsubmit=async event=>{
  event.preventDefault();
  const {email,message}=inbox.elements;
  const button=inbox.querySelector('button'),status=inbox.querySelector('[role="status"]');
  if(button.disabled)return;
  const text=message.value.trim();
  if(text.length<3){
   status.textContent=t('Enter at least 3 characters.','Escribe al menos 3 caracteres.');
   return;
  }
  button.disabled=email.readOnly=message.readOnly=true;
  status.textContent=t('Sending…','Enviando…');
  try{
   const result=await send({id:requestId,email:email.value.trim(),message:text});
   const topic=result.auto_reply?matchSupportTopic(text):null;
   addMessage(t('You','Tú'),text);
   addMessage('RePartes USA',t('Message received. Reference: ','Mensaje recibido. Referencia: ')+result.reference+(topic?' · '+topic.answer[i]:''));
   message.value='';
   requestId=crypto.randomUUID();
   status.textContent='';
  }catch{
   status.textContent=t('Could not send the message. Please try again.','No se pudo enviar el mensaje. Inténtalo de nuevo.');
  }finally{button.disabled=email.readOnly=message.readOnly=false;}
 };
}
