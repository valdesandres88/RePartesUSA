# Política de devoluciones y proceso de RePartes USA (30 días)

Estado: borrador operativo de prelanzamiento; las compras reales siguen desactivadas.

## Reglas publicadas

1. Se puede solicitar una devolución dentro de los 30 días naturales posteriores a la entrega confirmada. El cómputo empieza al día siguiente de la entrega.
2. El comprador contactará con el correo de soporte del sitio e indicará su número de pedido, artículo, fecha de entrega y motivo. Adjuntará fotografías si corresponden.
3. Para cambios de opinión o errores de compatibilidad no atribuibles a la descripción del anuncio, la pieza debe estar sin instalar, sin modificar y en estado equivalente al recibido. El comprador paga el envío de retorno.
4. Para piezas equivocadas, defectuosas, dañadas al llegar o distintas de lo anunciado, el vendedor debe asumir el costo razonable de devolución autorizada. La instalación razonable que descubre un defecto no excluye automáticamente la reclamación.
5. Tras autorizarse la devolución, el comprador tendrá 14 días naturales para despachar el artículo, salvo autorización diferente por escrito.
6. Una vez recibida e inspeccionada la pieza, los reembolsos aprobados se iniciarán al medio de pago original dentro de diez días hábiles. El abono bancario puede tardar más.
7. No se cobrará tarifa de reposición en devoluciones autorizadas. Para productos incorrectos, defectuosos o diferentes de su anuncio, se reembolsará el precio total abonado por el artículo.
8. Los derechos legales irrenunciables del consumidor prevalecen sobre estas condiciones.

## Procedimiento administrativo provisional

- Registrar solicitud, número de pedido, fecha de entrega verificada mediante transportista y plazo de treinta días.
- Revisar anuncio, motivo, imágenes y correspondencia con el vendedor.
- Autorizar el retorno por correo y comunicar las instrucciones correctas; no publicar direcciones privadas.
- Registrar seguimiento, recepción de mercancía e inspección.
- Gestionar el reembolso únicamente a través de Stripe y comprobar su confirmación antes de reportarlo como realizado.
- Conservar historial de comunicaciones e incidencias con permisos administrativos.

## Antes de aceptar dinero real

- Implementar y probar solicitudes de devolución con estado, evidencias y fechas de entrega.
- Definir la logística de retorno de piezas pesadas, inflamables o restringidas.
- Añadir notificaciones automáticas y registro interno de decisiones.
- Probar devolución completa, reversión de transferencia al vendedor, comisión y conciliación en Stripe test mode.
- Publicar plazos de entrega, impuestos, privacidad y términos definitivos tras revisión legal.
- Mantener payments_enabled = false y CHECKOUT_MODE = disabled hasta aprobar los controles y la verificación de Stripe.

La política pública está en la página Envíos y devoluciones de la web. Esta documentación es una guía interna, no una certificación legal ni de Stripe.
