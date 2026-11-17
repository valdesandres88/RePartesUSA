# RePartes USA — marketplace de autopartes físicas

Aplicación real con Vite, Supabase, Netlify Functions y Stripe Connect. El sistema no incluye productos, vendedores, ventas ni reseñas simuladas.

## Inventario auténtico

- Cada vendedor registrado debe subir **una fotografía original** de la pieza mediante el formulario, desde su teléfono. Se guarda en el bucket `part-photos` de Supabase Storage (JPG/PNG/WebP, máx. 5 MB).
- El vendedor debe confirmar que tiene físicamente la pieza lista para despachar y que la fotografía muestra exactamente ese artículo.
- Cada producto representa **una unidad única**: la transacción reserva la pieza y la retira del inventario tras el pago confirmado.
- El Owner debe revisar disponibilidad, condición, compatibilidad, procedencia legítima y fotografía antes de aprobar. No es una verificación automatizada de autenticidad.
- El vendedor puede retirar inmediatamente una pieza no disponible. No se usan fotografías de muestra ni productos de relleno.

## Pagos y envíos

Stripe Connect permite conectar las cuentas verificadas de vendedores, y Stripe Checkout realiza el cobro bajo controles de reserva, webhooks firmados y comprobación de importes. El checkout NO se habilita automáticamente: requiere `site_settings.payments_enabled = true`, `CHECKOUT_MODE` válido, webhook firmado, una pieza aprobada por Owner y cuenta Stripe del vendedor lista para cobrar.

**Estado de prelanzamiento: `payments_enabled = false`**. No se ha afirmado que el sitio ya acepte dinero real. Antes del lanzamiento: verificar datos comerciales, condiciones de Stripe Connect, impuestos, procedimientos de entrega y cumplimiento legal.

Los vendedores introducen seguimiento real del envío; el Owner registra la fecha de entrega tras verificarla. Solo entonces comienza el plazo de devolución de 30 días.

## Devoluciones y referidos

- Solicitud de devolución dentro de 30 días naturales desde la entrega confirmada, revisión Owner, autorización y registro del retorno. El reembolso real solo se procesa por Stripe y solo tras los controles establecidos.
- Código y enlace personal para referidos; estadísticas de registros y compradores que completan una compra real. **No hay premios, créditos ni pagos de afiliados activados**.

## Monetización legítima y publicidad automática

- **Google AdSense Auto ads:** desde `/#owner` el Owner puede guardar su ID de editor real (`ca-pub-` + 16 dígitos). Esta operación publica automáticamente el archivo `/ads.txt` en el dominio de la web para verificar la titularidad. El script de publicidad permanece **apagado por defecto**.
- Para encender los anuncios, el Owner debe verificar externamente que el sitio aparece como **Ready** en AdSense, preparar el contenido editorial suficiente, configurar una CMP certificada / avisos de privacidad y consentimiento donde apliquen, y marcar explícitamente ambas confirmaciones. El servidor bloquea la activación sin estos requisitos declarados. No hay publicidad ni ingresos garantizados sin aprobación y tráfico auténtico. El sitio no puede consultar automáticamente los ingresos de AdSense sin una conexión autorizada.
- La publicidad se prepara para páginas públicas de catálogo o guías; no se carga deliberadamente en el acceso, pedidos, creación de anuncios ni Panel Owner. En el SPA, al navegar desde una página con anuncios a una privada se recarga para evitar que los scripts de publicidad permanezcan activos.
- **Afiliados y patrocinadores:** el Owner puede registrar hasta 12 ofertas con enlaces HTTPS auténticos de socios aprobados; estos enlaces se muestran en la web etiquetados `Affiliate link` o `Sponsored placement` y con `rel=sponsored nofollow`. No hay ofertas de ejemplo ni enlaces de seguimiento inventados. Ingresos de afiliados requieren una relación aprobada con la red y conversiones válidas; patrocinios requieren contrato real.
- **Contenido original indexable:** guías en `/guides/used-auto-parts.html` y `/guides/comprar-piezas-usadas.html`, enlazadas desde la página y publicadas en `/sitemap.xml`. Es contenido informativo general y no reemplaza verificación de compatibilidad o inspección profesional.
- La información publicitaria se identifica en `/#advertising` y el aviso de privacidad informa sobre las tecnologías de terceros. Antes del lanzamiento publicitario, el Owner debe revisar obligaciones legales y de consentimiento por región.
- **Pagos Stripe de piezas siguen desactivados** y no están conectados al interruptor de AdSense. No se activan anuncios destacados de pago, suscripciones, tarifas ni cobros a terceros de forma implícita.

## Infraestructura

1. Netlify construye con `npm run build` y publica `dist`, usando las variables de `.env.example`.
2. Supabase: proyecto RePartes USA; se aplicaron migraciones incrementales. **No vuelvas a ejecutar `supabase/schema.sql` sobre la base existente.**
3. El owner es el usuario Supabase Auth indicado mediante la variable privada `OWNER_USER_ID`.
4. Nunca incrustes claves de servicio o Stripe secretas en el navegador. Solo claves públicas `VITE_*` se envían al frontend.
5. `npm run check` ejecuta pruebas unitarias y build.

## Lanzamiento

El sitio comercial no puede ofrecer productos sin que vendedores reales hayan registrado inventario auténtico y el Owner lo haya aprobado. Tampoco se puede prometer compra inmediata hasta configurar Stripe Connect, pagos, entrega, reclamaciones e impuestos.

## Idiomas y acceso

- La web se presenta en inglés por defecto, con selector English / Español; otros idiomas deberán traducirse y verificarse antes de ofrecerse públicamente.
- **Registro e inicio de sesión actualmente solo con correo electrónico y contraseña.** Google se implementará más adelante, si el Owner lo solicita expresamente. No hay botones ni flujos Google OAuth en la versión actual. Para una futura integración, se deberá configurar Google OAuth en Supabase y Google Cloud, sin exponer secretos en el frontend.
- X, Telegram, Instagram, Facebook, TikTok, YouTube, Threads, Pinterest y LinkedIn son **únicamente enlaces oficiales**, administrados por Owner desde `Panel Owner > Official social media profiles`; los campos vacíos no aparecen al público. Ninguna de estas redes concede acceso a cuentas.
- Las opiniones sobre la web pueden enviarse por usuarios registrados y requieren moderación. Las reseñas de piezas requieren una compra real pagada, una sola por pedido, y aprobación Owner. No hay reseñas falsas ni valoraciones inventadas.
- Cada vendedor puede anunciar correo/teléfono comercial de manera voluntaria, aprobado por Owner; no se publica el correo de inicio de sesión.
- Comisiones ajustables individualmente por vendedor desde Owner; la comisión vigente se calcula al reservar cada pedido. Inventario propio del Owner no paga comisión interna, sino las tarifas de procesamiento de Stripe que correspondan.
