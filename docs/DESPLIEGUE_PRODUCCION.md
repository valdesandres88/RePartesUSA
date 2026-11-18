# RePartes USA — Activación de producción

**Estado:** código publicado en GitHub; base de datos Supabase instalada; Stripe y Netlify pendientes de vincular. Los pagos empiezan desactivados.

## 1. Desplegar desde GitHub
1. Abre https://app.netlify.com/start
2. Conecta GitHub y elige el repositorio `valdesandres88/RePartesUSA`.
3. Build command: `npm run build`. Publish directory: `dist`.
4. Netlify lee `netlify.toml` y aloja las funciones de `netlify/functions/`. No hagas solo drag-and-drop de la carpeta: las funciones deben desplegarse también.
5. No habilites compras hasta configurar servidores y probar la compra completa.

## 2. Variables de Netlify
En **Site configuration → Environment variables**, añade las siguientes:
- `VITE_SUPABASE_URL`: URL pública del proyecto RePartes USA.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publishable de ese proyecto (pública, adecuada para navegador).
- `SUPABASE_URL`: misma URL.
- `SUPABASE_SERVICE_ROLE_KEY`: **secreto**, solo para funciones de servidor; no en el cliente, no en GitHub.
- `OWNER_USER_ID`: UUID del usuario owner que has confirmado en Supabase Authentication → Users.
- `SITE_URL`: https://URL-PUBLICADA-EN-NETLIFY (sin slash al final).
- `CHECKOUT_MODE`: `disabled` hasta realizar pruebas. Usa `test` con `sk_test_` y `live` solo con `sk_live_`.
- `STRIPE_SECRET_KEY`: clave secreta Stripe del entorno correspondiente, solo en servidor.
- `STRIPE_WEBHOOK_SECRET`: secreto del webhook verificado Stripe.
- `STRIPE_TAX_ENABLED`: `false` hasta configurar y verificar impuestos.
- `CRON_SECRET`: secreto fuerte aleatorio para el endpoint `/api/cleanup`.

No compartas ni publiques secretos. Las variables `VITE_` sí quedan visibles en el JavaScript compilado, por eso deben contener solo información pública. Configura las variables de Vite en el contexto de Build y las otras para funciones. Tras configurarlas, redeploy.

## 3. Auth/Owner
- Supabase Auth → habilita correo y contraseña, confirma email y configura Site URL con el dominio de Netlify. Agrega los Redirect URLs apropiados.
- Inicia sesión en `/#login` y toma el ID de tu usuario confirmado desde Supabase.
- Añade ese UUID a `OWNER_USER_ID` de Netlify; ese usuario accede a `/#owner`. No guardes contraseñas en el repositorio.

## 4. Stripe Connect (obligatorio para ventas)
- Configura una cuenta Stripe Business y verifica titularidad y obligaciones del negocio.
- Habilita Connect Express para vendedores que reciban pagos.
- Registra el webhook `https://TU-SITIO.netlify.app/api/stripe-webhook` y suscribe `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.
- Prueba el onboarding, una compra test, firma webhook, comisión, stock, reclamación, reembolso, order status y permisos. Solo después cambia a claves live.
- El owner activa compras en `/#owner` cuando `CHECKOUT_MODE` y el webhook están bien configurados.

## 5. Reconciliación de reservas
Netlify runs `reservation-recovery` every 15 minutes on published deploys. It checks reservations older than 35 minutes against Stripe and validates environment, session, order and amount. Only orphaned or expired reservations are released; pending asynchronous payments remain reserved. Each run checks up to 20 orders within a 20-second processing budget. Verify its Scheduled badge and successful logs before launch. The optional manual endpoint `POST /api/cleanup` still requires `Authorization: Bearer <CRON_SECRET>`. The built-in schedule does not need that secret.

## 6. Precauciones operativas
- El catálogo no tiene productos inventados. Las órdenes, ventas y comisiones deben comenzar en cero.
- El cálculo de comisión es bruto; no es beneficio neto después de Stripe, impuestos, contracargos, devoluciones o gastos.
- Antes de ventas públicas: condiciones, devoluciones, privacidad, seguridad de piezas, compatibilidad, tax nexus/sales tax, antifraude, manejo de disputas, soporte y mantenimiento.
- El archivo `supabase/schema.sql` es referencia para un proyecto **nuevo**; las tablas del proyecto actual **ya están instaladas**, no lo vuelvas a ejecutar.
- El sitio sin credenciales mostrará un aviso de configuración pendiente en lugar de ventas falsas.

## Verificación final
- GitHub Actions: pruebas `npm test`, `node --check` y `npm run build`.
- Supabase: `site_settings.payments_enabled` debe permanecer `false` hasta terminar pruebas.
- Netlify: verificar URL real, respuesta `GET /api/market?action=site`, login, dashboard, moderação, checkout test y eventos de Stripe.
