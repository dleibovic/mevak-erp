-- ============================================================================
-- 1) Safe UUID parser for storage object paths (fail closed on malformed paths)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mevak_storage_path_uuid(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(_name, '/', 1)::uuid
    ELSE NULL::uuid
  END;
$$;

-- ============================================================================
-- 2) Recreate mevak bucket policies using the safe parser
-- ============================================================================
-- mevak-fotos
DROP POLICY IF EXISTS "mevak_storage_read_mevak-fotos" ON storage.objects;
CREATE POLICY "mevak_storage_read_mevak-fotos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mevak-fotos' AND public.mevak_can_access_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_insert_mevak-fotos" ON storage.objects;
CREATE POLICY "mevak_storage_insert_mevak-fotos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_update_mevak-fotos" ON storage.objects;
CREATE POLICY "mevak_storage_update_mevak-fotos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)))
WITH CHECK (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_delete_mevak-fotos" ON storage.objects;
CREATE POLICY "mevak_storage_delete_mevak-fotos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'mevak-fotos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

-- mevak-documentos
DROP POLICY IF EXISTS "mevak_storage_read_mevak-documentos" ON storage.objects;
CREATE POLICY "mevak_storage_read_mevak-documentos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mevak-documentos' AND public.mevak_can_access_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_insert_mevak-documentos" ON storage.objects;
CREATE POLICY "mevak_storage_insert_mevak-documentos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_update_mevak-documentos" ON storage.objects;
CREATE POLICY "mevak_storage_update_mevak-documentos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)))
WITH CHECK (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_delete_mevak-documentos" ON storage.objects;
CREATE POLICY "mevak_storage_delete_mevak-documentos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'mevak-documentos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

-- mevak-catalogos
DROP POLICY IF EXISTS "mevak_storage_read_mevak-catalogos" ON storage.objects;
CREATE POLICY "mevak_storage_read_mevak-catalogos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mevak-catalogos' AND public.mevak_can_access_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_insert_mevak-catalogos" ON storage.objects;
CREATE POLICY "mevak_storage_insert_mevak-catalogos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_update_mevak-catalogos" ON storage.objects;
CREATE POLICY "mevak_storage_update_mevak-catalogos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)))
WITH CHECK (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

DROP POLICY IF EXISTS "mevak_storage_delete_mevak-catalogos" ON storage.objects;
CREATE POLICY "mevak_storage_delete_mevak-catalogos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'mevak-catalogos' AND public.mevak_can_write_client(auth.uid(), public.mevak_storage_path_uuid(name)));

-- ============================================================================
-- 3) Scoped read access to invoice documents (table + invoices bucket)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mevak_can_access_invoice(_user_id uuid, _invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.monthly_invoices mi
    WHERE mi.id = _invoice_id
      AND (
        mi.billing_user_id = _user_id
        OR public.mevak_can_access_client(_user_id, mi.client_id)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.mevak_can_access_invoice(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mevak_can_access_invoice(uuid, uuid) TO authenticated;

CREATE POLICY "mevak read invoice_documents"
ON public.invoice_documents
FOR SELECT TO authenticated
USING (public.mevak_can_access_invoice(auth.uid(), invoice_id));

CREATE POLICY "invoices_read_client_staff"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'invoices'
  AND public.mevak_can_access_invoice(auth.uid(), public.mevak_storage_path_uuid(name))
);