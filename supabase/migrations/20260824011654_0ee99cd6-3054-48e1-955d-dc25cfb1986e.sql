BEGIN;

-- 1) mevak_kpi_definiciones: restringir lectura a staff interno (antes: cualquier autenticado)
DROP POLICY IF EXISTS kpi_def_read ON public.mevak_kpi_definiciones;
CREATE POLICY kpi_def_read ON public.mevak_kpi_definiciones FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'administracion')
    OR public.has_mevak_role(auth.uid(), 'direccion')
    OR public.has_mevak_role(auth.uid(), 'ejecutivo')
  );

-- 2) Storage: reemplazar políticas ALL por INSERT/UPDATE/DELETE explícitas (mismo alcance de escritura)

DROP POLICY IF EXISTS "mevak_storage_write_mevak-fotos" ON storage.objects;
CREATE POLICY "mevak_storage_insert_mevak-fotos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));
CREATE POLICY "mevak_storage_update_mevak-fotos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid))
  WITH CHECK (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));
CREATE POLICY "mevak_storage_delete_mevak-fotos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));

DROP POLICY IF EXISTS "mevak_storage_write_mevak-documentos" ON storage.objects;
CREATE POLICY "mevak_storage_insert_mevak-documentos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));
CREATE POLICY "mevak_storage_update_mevak-documentos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid))
  WITH CHECK (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));
CREATE POLICY "mevak_storage_delete_mevak-documentos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));

DROP POLICY IF EXISTS "mevak_storage_write_mevak-catalogos" ON storage.objects;
CREATE POLICY "mevak_storage_insert_mevak-catalogos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));
CREATE POLICY "mevak_storage_update_mevak-catalogos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid))
  WITH CHECK (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));
CREATE POLICY "mevak_storage_delete_mevak-catalogos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid));

COMMIT;