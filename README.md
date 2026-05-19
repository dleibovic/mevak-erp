# Mevak ERP/CRM

## Integraciones externas

### Tipos de cambio
- **Proveedor**: [open.er-api.com](https://open.er-api.com) (free tier, sin API key).
- **Pull mensual**: edge function `pull-exchange-rates` (cron día 1 de cada mes 00:00 UTC). Inserta filas en `exchange_rates` con `source='api'`.
- **Override manual**: tabla `exchange_rate_overrides`. UI en *Configuración → Métricas SaaS → Tipos de cambio*. Cuando `prefer_manual=true`, la función `get_exchange_rate` devuelve el valor manual y los snapshots del mes quedan marcados `needs_recompute=true`.
- **Health check semanal**: edge function `exchange-rate-health-check` (cron lunes 09:00 UTC). Genera notificaciones in-app a admins si:
  - El último rate de una moneda mayor (ARS, EUR, BRL, MXN, COP, CLP, PEN, UYU) tiene más de 8 días.
  - La variación mes contra mes supera el 20%.

### MRR / Churn
- Snapshots en `mrr_snapshots` (por moneda + consolidado USD) y `client_mrr_history`.
- Recompute diario via edge function `recompute-mrr` (cron diario). Recalcula solo el mes actual y dispara `auto_churn_paused_clients`.
- Recompute histórico manual: función SQL `start_mrr_recompute(_months)`, expuesta como botón "Recalcular MRR" en *Configuración → Métricas SaaS*. Solo admin. Bloqueo de paralelismo via índice único parcial sobre `mrr_recompute_runs.status='running'`.

### Parámetros configurables
Tabla `app_settings` (singleton id=1):
- `paused_to_churned_days` (default 60): días antes de que un cliente pausado pase a churn automático.
- `mrr_base_currency` (default 'USD').
