# Cobranza, Descuentos e Historial de Ajustes

Implementación end-to-end de tres módulos interconectados sobre el ERP Mevak: asignación de método/responsable de cobro, descuentos con vencimiento automático, e historial completo de cambios de precio.

---

## 1. Cambios de base de datos (migración SQL)

### Enums nuevos
- `payment_channel`: `stripe_dario`, `us_dario`, `maria_transferencia`, `maria_efectivo`, `dario_transferencia`, `dario_efectivo`.
- `discount_duration`: `30_days`, `60_days`, `90_days`, `custom`.
- `price_change_type`: `increase`, `decrease`, `discount_applied`, `discount_expired`, `manual_adjustment`.
- `monthly_invoice_status`: `pending`, `invoiced`, `paid`, `overdue`.

### Tabla `clients` (ALTER)
- `payment_channel payment_channel` (nullable inicialmente para migrar datos existentes).
- `billing_user_id uuid` → `auth.users.id` (nullable).
- `discount_percentage numeric` (0–100, nullable).
- `discount_starts_at date`, `discount_ends_at date`, `discount_duration discount_duration`, `discount_active boolean default false`.
- Vista/función SQL `effective_monthly_fee(client_id)` que devuelve el fee con descuento si `discount_active AND discount_ends_at >= today`, sino el `monthly_fee` pleno.

Mismos campos de descuento replicados en `prospects` (sólo `discount_percentage`, `discount_starts_at`, `discount_ends_at`, `discount_duration`).

### Tabla nueva `monthly_invoices`
Campos: `id, client_id, billing_user_id, period_month (date, primer día del mes), amount, currency, payment_channel, status, invoiced_at, invoiced_by, paid_at, paid_by, created_at, updated_at`.
Constraint único `(client_id, period_month)`.
Trigger `set_row_updated_at`.

> Nota: la tabla `invoices` actual queda intacta (factura individual con due_date). `monthly_invoices` es la "lista mensual de cobranza por usuario" que pide el prompt.

### Tabla nueva `client_price_history`
Campos: `id, client_id, change_type, previous_amount, new_amount, currency, percentage_change (generated), reason text, effective_date date, discount_duration, discount_ends_at, created_by uuid, created_at`.

### Triggers
- `clients_price_history_trg` AFTER UPDATE OF `monthly_fee`, `discount_percentage`, `discount_active` ON `clients`: inserta una fila en `client_price_history` con el `change_type` apropiado y `created_by = auth.uid()` (cuando exista).
- Cambios disparados desde Edge Functions usan `set_config('app.acting_user', ...)` para registrar autoría.

### RLS (todas las tablas nuevas)
- `monthly_invoices`: `is_admin(auth.uid())` ALL; usuarios ven/actualizan sus filas (`billing_user_id = auth.uid()`).
- `client_price_history`: SELECT para admins y para el ejecutivo asignado al cliente; INSERT sólo desde triggers/funciones SECURITY DEFINER.
- Política existente de `clients` se mantiene; se agrega política para que el `billing_user_id` pueda leer sus clientes.

---

## 2. Edge Functions

### `generate-monthly-invoices` (cron mensual, día 1, 02:00)
Idempotente: para cada cliente activo, hace `INSERT ... ON CONFLICT (client_id, period_month) DO NOTHING` con `amount = effective_monthly_fee(client_id)`, `currency = fee_currency`, `payment_channel`, `billing_user_id`, `status='pending'`. Programada con `pg_cron` + `pg_net`.

### `expire-discounts` (cron diario 06:00)
1. Busca clientes con `discount_active=true AND discount_ends_at < current_date`.
2. UPDATE `discount_active=false` (el trigger registra en `client_price_history` con tipo `discount_expired`).
3. Recalcula `monthly_invoices` del periodo en curso si está `pending` (refleja el monto pleno).
4. Crea notificación in-app (tabla `notifications` existente o nueva sencilla) y envía email al `billing_user_id` y a admins via Lovable Email (`send-transactional-email` + template `discount-expired`).

### Email infrastructure
Si aún no existe dominio configurado, mostrar el setup de email de Lovable. Crear template React Email `discount-expired` con datos: cliente, monto anterior, monto nuevo, fecha de vencimiento.

---

## 3. UI — Clientes

### Formulario (crear/editar)
- Nuevo bloque "Cobranza":
  - Select **Quién cobra** (`payment_channel`, 6 opciones).
  - Select **Usuario asignado a facturación** (`billing_user_id`) cargado desde `profiles`.
- Nuevo bloque "Descuento":
  - Input `discount_percentage` (%).
  - Select duración (30/60/90/A definir). Si "A definir" → date picker `discount_ends_at`. Caso contrario se calcula `discount_starts_at = today` y `discount_ends_at = today + N days`.
  - Vista calculada: monto final con descuento + fecha de vencimiento.
- Sub-sección **Historial de precios** (timeline) consultando `client_price_history` filtrado por `client_id`.

### Listado de clientes
- Columnas nuevas: Quién cobra, Usuario asignado, Badge "Descuento vigente hasta DD/MM" (azul) o "Vencido" (rojo).
- Filtros: por `payment_channel` y por `billing_user_id`.
- Acción bulk: seleccionar varias filas → reasignar `billing_user_id`.
- Banner superior si hay clientes con `payment_channel IS NULL` o `billing_user_id IS NULL`: "N clientes sin método/responsable de cobro".

---

## 4. UI — Facturación

Nueva pestaña/vista **"Mi facturación del mes"** en `src/pages/Billing.tsx`:

- Default = mes en curso, usuario logueado. Admins: selector de usuario y selector de mes.
- KPIs: Total a facturar (ARS/EUR), Total facturado, Total pendiente, Cantidad clientes pendientes vs facturados.
- Tabla agrupable por `payment_channel` con subtotales: cliente, monto, moneda, canal, status, acciones.
- Cada fila: botón "Marcar como facturado" → UPDATE `monthly_invoices.status='invoiced'`, `invoiced_at=now()`, `invoiced_by=auth.uid()`. Botón "Marcar como cobrado" → `status='paid'`.
- Export CSV.

La pestaña "Facturas" actual (factura formal con due_date) se mantiene tal cual.

---

## 5. UI — Historial global

En `src/pages/Admin.tsx` (o nueva ruta `/historial-precios`): tabla consolidada de `client_price_history` con filtros (cliente, change_type, rango de fechas, usuario), métricas resumen (aumentos del mes, descuentos vigentes, descuentos vencidos en el periodo) y export CSV.

---

## 6. Notificaciones in-app

Tabla `notifications` ligera (`id, user_id, title, body, link, is_read, created_at`) + bell icon en `AppLayout` con contador (subscripción Realtime). Inserciones desde la Edge `expire-discounts`.

---

## Detalles técnicos

```text
clients
  ├── payment_channel, billing_user_id (nuevos)
  ├── discount_* (nuevos)
  └── trigger → client_price_history

monthly_invoices ──── billing_user_id ──── auth.users
       │
       └── status: pending → invoiced → paid

Edge cron:
  generate-monthly-invoices  (1° de cada mes)
  expire-discounts           (diario)
                  │
                  ├── update clients.discount_active
                  ├── insert notifications
                  └── send-transactional-email (template discount-expired)
```

- Multi-moneda: nada de conversión, todo separado por `currency`.
- Estilos: shadcn + tokens existentes; badges verde/amarillo/rojo/azul para status.
- Idempotencia: `monthly_invoices` UNIQUE por `(client_id, period_month)`; `expire-discounts` filtra por flag y es seguro re-ejecutar.
- Migración: campos nuevos NULL para clientes existentes; banner pidiendo completarlos.

---

## QA — casos a probar

1. Cliente con descuento 30 días: el `effective_monthly_fee` y el `monthly_invoices.amount` del mes muestran el descuento.
2. Forzar `discount_ends_at = ayer` y ejecutar `expire-discounts` manualmente: monto vuelve al pleno, llega email + notificación in-app, aparece fila `discount_expired` en historial.
3. Cambiar `billing_user_id`: el cliente aparece/desaparece de "Mi facturación" del usuario correspondiente.
4. Vista de facturación agrupada por canal muestra subtotales correctos por moneda.
5. Cambiar `monthly_fee` desde el form: trigger inserta fila `increase`/`decrease` con autoría correcta.
6. Cliente con `payment_channel` NULL: aparece en banner; al completarlo, banner se actualiza.

---

## Orden de implementación

1. Migración SQL (enums, ALTER clients, tablas, triggers, función `effective_monthly_fee`, RLS).
2. Edge Functions + cron (`generate-monthly-invoices`, `expire-discounts`).
3. Email template `discount-expired` y setup email infra si falta.
4. UI clientes (form + listado + bulk + banner + historial por cliente).
5. UI facturación mensual.
6. UI historial global.
7. Notificaciones in-app (tabla + bell).
