import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Paperclip, Download, Files } from "lucide-react";
import { toast } from "sonner";
import { subirDoc } from "@/lib/invoiceDocs";
import { fmtDate } from "@/lib/format";

export function InvoiceDocsCell({ invoiceId }: { invoiceId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["invoice-docs", invoiceId],
    queryFn: async () =>
      (
        await supabase
          .from("invoice_documents")
          .select("*")
          .eq("invoice_id", invoiceId)
          .order("uploaded_at", { ascending: false })
      ).data ?? [],
  });

  async function descargar(path: string) {
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            await subirDoc(invoiceId, file, file.name, "afip");
            toast.success("Factura AFIP adjuntada");
            qc.invalidateQueries({ queryKey: ["invoice-docs", invoiceId] });
          } catch (err: any) {
            toast.error(err.message);
          }
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
        <Paperclip className="h-4 w-4 mr-1" />Adjuntar AFIP
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost">
            <Files className="h-4 w-4 mr-1" />Documentos ({docs.length})
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-2">
          {docs.length === 0 && (
            <div className="text-sm text-muted-foreground p-2">Sin documentos</div>
          )}
          <div className="space-y-1">
            {docs.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <Badge variant={d.kind === "afip" ? "default" : "secondary"}>
                  {d.kind === "afip" ? "AFIP" : "Generada"}
                </Badge>
                <span className="truncate flex-1" title={d.file_name}>{d.file_name}</span>
                <span className="text-xs text-muted-foreground">{d.uploaded_at ? fmtDate(d.uploaded_at) : ""}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => descargar(d.file_path)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}
