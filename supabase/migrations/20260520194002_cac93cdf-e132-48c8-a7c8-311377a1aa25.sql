
drop trigger if exists trg_mevak_timeline_client_status   on public.clients;
drop trigger if exists trg_mevak_timeline_alerta          on public.mevak_alertas;
drop trigger if exists trg_mevak_timeline_onboarding      on public.mevak_onboarding_status;
drop trigger if exists trg_mevak_timeline_reunion_tarea   on public.mevak_reunion_tareas;
drop trigger if exists trg_mevak_timeline_reunion         on public.mevak_reuniones;
notify pgrst, 'reload schema';
