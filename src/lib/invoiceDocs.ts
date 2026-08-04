import { supabase } from "@/integrations/supabase/client";

export type InvoiceDocKind = "generated" | "afip";

export async function subirDoc(
  invoiceId: string,
  file: Blob,
  fileName: string,
  kind: InvoiceDocKind
) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${invoiceId}/${kind}_${Date.now()}_${safe}`;
  const { error } = await supabase.storage
    .from("invoices")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("invoice_documents")
    .insert({ invoice_id: invoiceId, kind, file_path: path, file_name: fileName });
  if (e2) throw e2;
  return path;
}

/** Link temporal de descarga (default 5 minutos). */
export async function getSignedUrl(filePath: string, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(filePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
