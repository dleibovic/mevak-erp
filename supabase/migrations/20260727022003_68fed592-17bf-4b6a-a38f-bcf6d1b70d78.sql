DO $$
DECLARE
  t text;
  editable text[] := ARRAY[
    'invoices','monthly_invoices','expenses','expense_categories','transactions',
    'client_executive_commission','payment_methods','exchange_rates',
    'exchange_rate_overrides','exchange_rate_validation_ranges','app_settings','alert_settings',
    'clients','client_platforms','client_sub_brands',
    'mevak_ai_config_history','mevak_ai_conversations','mevak_ai_message_feedback','mevak_ai_messages',
    'mevak_ai_tool_cache','mevak_ai_tool_calls','mevak_alertas','mevak_app_settings',
    'mevak_comentarios_internos','mevak_contactos','mevak_documentos','mevak_fotos',
    'mevak_interacciones_whatsapp','mevak_kpis_mensuales','mevak_kpis_semanales',
    'mevak_menu_items','mevak_menu_uploads','mevak_objetivos','mevak_onboarding_items',
    'mevak_onboarding_status','mevak_onboarding_templates','mevak_promociones',
    'mevak_reportes_mensuales','mevak_reportes_semanales','mevak_reuniones',
    'mevak_roadmap_items','mevak_roadmaps','mevak_sucursal_plataforma','mevak_sucursales','mevak_tareas'
  ];
  readonly text[] := ARRAY[
    'mrr_snapshots','mrr_recompute_runs','client_mrr_history','client_price_history',
    'churn_events','audit_log','mevak_onboarding_audit','mevak_timeline_eventos',
    'prospects','prospect_alerts','prospect_interactions','prospect_platforms','prospect_stage_history',
    'countries','cities','provinces','platforms','food_categories','funnel_stages',
    'contact_channels','lost_reasons','employees','profiles','notifications',
    'mevak_cliente_usuarios'
  ];
BEGIN
  FOREACH t IN ARRAY editable LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admon_select_'||t, t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                     USING (public.has_role(auth.uid(),'administracion'))$f$, 'admon_select_'||t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admon_insert_'||t, t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
                     WITH CHECK (public.has_role(auth.uid(),'administracion'))$f$, 'admon_insert_'||t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admon_update_'||t, t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
                     USING (public.has_role(auth.uid(),'administracion'))
                     WITH CHECK (public.has_role(auth.uid(),'administracion'))$f$, 'admon_update_'||t, t);
  END LOOP;
  FOREACH t IN ARRAY readonly LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admon_select_'||t, t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                     USING (public.has_role(auth.uid(),'administracion'))$f$, 'admon_select_'||t, t);
  END LOOP;
END $$;