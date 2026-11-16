# RePartes USA

Marketplace real de autopartes usadas. Aplicación Vite + Supabase + Netlify Functions + Stripe Connect.

No contiene ventas simuladas. Los pagos permanecen desactivados hasta verificar Stripe y configurar el owner.

## Configuración

1. Conectar el repositorio a Netlify (build: `npm run build`, publish: `dist`).
2. En Netlify cargar variables como en `.env.example`. Nunca publicar claves privadas.
3. En Supabase RePartes USA usar el esquema instalado; no reejecutar migraciones iniciales ya aplicadas.
4. Vincular Stripe Connect y probar pagos/refunds antes de habilitar modo `live`.
5. Establecer `OWNER_USER_ID` de la cuenta confirmada en Supabase Auth, no un password en código.

**Estado:** infraestructura en proceso de instalación; no poner en producción comercial sin verificar cobros, reembolsos, impuestos, seguridad y devoluciones.
