# Marca Mevak

## Deuda entre socios
- [x] Unificar movimientos y registro de repagos en Cuenta corriente socios; retirar la página Deudas.
- [x] Verificar compilación y pruebas de saldos, conversión y fechas.

## Instalación en celular
- [x] Agregar manifest, íconos de marca y metadatos para pantalla de inicio sin caché de páginas.

- [x] Aplicar paleta, fuentes, radios y efectos mediante tokens globales.
- [x] Incorporar selector Sistema/Claro/Oscuro y adaptar el logo y controles compartidos.
- [x] Verificar tipos y apariencia pública en claro/oscuro para desktop y celular.
- [ ] Verificar el selector en el encabezado con una sesión iniciada (requiere ingresar en la vista previa).

## Clientes semanales: fuente única de facturación
- [x] Dashboard: "Facturación" por país y moneda sale de `v_client_metrics.current_mrr` (ya no de `monthly_fee × sucursales × multiplicador`).
- [x] Alertas: "asignados sin facturar" considera cualquier factura con `period_month` dentro del mes en curso (rango, no solo el día 1).
- [ ] Decidir si la vista `v_client_metrics` debe respetar los permisos por cliente (hoy los ignora), ya que el Dashboard lo ve también el rol ejecutivo.
## Seguimiento por mail (secuencia de guías)
- [x] Envío con Resend (directo o por conector), remitente mevak.com.ar, responder-a configurable, baja en un clic.
- [x] Textos ES/EN de los 3 mails, nombre de guía, links a auditoría y Calendly.
- [x] Reglas: elegibilidad, avance de etapa, frenado de antiguos y escalonado al encender, los 2 invitados saltean el mail 1.
- [x] Ingreso de leads: pedido de auditoría frena la secuencia y pasa a Interesado; idioma y rubro.
- [x] Webhook de Resend: entregado/abierto/clic/rebote/spam y respuestas reenviadas a Darío.
- [x] Prospecting: estado de secuencia, envíos, respondió, pausar/reanudar, interruptor y contadores.
- [ ] Cargar RESEND_API_KEY y mandar la vista previa a dario@mevak.com.ar (falta la clave).
- [ ] Crear el webhook en Resend y cargar RESEND_WEBHOOK_SECRET (lo hace el dueño en Resend).
- [ ] Validar textos y recién ahí encender la secuencia (decisión del dueño).
