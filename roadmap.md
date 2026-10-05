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