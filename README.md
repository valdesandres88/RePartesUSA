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
- Registro e inicio de sesión: correo electrónico/contraseña y Google exclusivamente. **Google aparece solo si el endpoint público de Supabase Auth indica que el proveedor Google está habilitado**. Debe configurarse Google OAuth en Supabase > Authentication > Providers y el cliente OAuth en Google Cloud con callback `https://qajrhtcsxkfrdxlypxig.supabase.co/auth/v1/callback`. Añade `https://repartesusa-marketplace.netlify.app/**` a los redirect URLs permitidos en Supabase Auth. No incrustes Google client secrets en el frontend ni los envíes por chat.
- X, Telegram, Instagram, Facebook, TikTok, YouTube, Threads, Pinterest y LinkedIn son **únicamente enlaces oficiales**, administrados por Owner desde `Panel Owner > Official social media profiles`; los campos vacíos no aparecen al público. Ninguna de estas redes concede acceso a cuentas.
- Las opiniones sobre la web pueden enviarse por usuarios registrados y requieren moderación. Las reseñas de piezas requieren una compra real pagada, una sola por pedido, y aprobación Owner. No hay reseñas falsas ni valoraciones inventadas.
- Cada vendedor puede anunciar correo/teléfono comercial de manera voluntaria, aprobado por Owner; no se publica el correo de inicio de sesión.
- Comisiones ajustables individualmente por vendedor desde Owner; la comisión vigente se calcula al reservar cada pedido. Inventario propio del Owner no paga comisión interna, sino las tarifas de procesamiento de Stripe que correspondan.
