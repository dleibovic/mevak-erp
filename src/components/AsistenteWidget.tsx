import { useEffect, useRef, useState } from "react";
import { MessageSquare, Minus, X, Send, Loader2, Bot } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Data = {
  type: "table" | "chart";
  title?: string;
  columns?: string[];
  rows?: Record<string, any>[];
  chart?: { kind: "bar" | "line"; x: string; series: string[] };
};
type Msg = { role: "user" | "assistant"; content: string; data?: Data; error?: boolean };

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))"];
const fmtCell = (v: any) => (typeof v === "number" ? v.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : v ?? "—");
const label = (c: string) => c.replace(/_/g, " ");

function DataView({ data }: { data: Data }) {
  const rows = data.rows ?? [];
  if (!rows.length) return null;
  return (
    <div className="mt-2 rounded-lg border border-border bg-card">
      {data.title && <div className="px-3 pt-2 text-xs font-semibold text-muted-foreground">{data.title}</div>}
      {data.type === "chart" && data.chart ? (
        <div className="h-56 p-2">
          <ResponsiveContainer width="100%" height="100%">
            {data.chart.kind === "line" ? (
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey={data.chart.x} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmtCell(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {data.chart.series.map((s, i) => <Line key={s} dataKey={s} stroke={COLORS[i % 3]} />)}
              </LineChart>
            ) : (
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey={data.chart.x} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmtCell(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {data.chart.series.map((s, i) => <Bar key={s} dataKey={s} fill={COLORS[i % 3]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>{(data.columns ?? Object.keys(rows[0])).map((c) => <TableHead key={c} className="text-xs capitalize">{label(c)}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {(data.columns ?? Object.keys(rows[0])).map((c) => <TableCell key={c} className="py-1.5 text-xs">{fmtCell(r[c])}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function AsistenteWidget() {
  const { role, roleLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if (open && !busy) inputRef.current?.focus(); }, [open, busy]);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncViewport = () => {
      panelRef.current?.style.setProperty("--assistant-vh", `${viewport.height}px`);
      panelRef.current?.style.setProperty("--assistant-top", `${viewport.offsetTop}px`);
    };
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, [open]);

  if (roleLoading || (role !== "admin" && role !== "administracion")) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const history = next.filter((m) => !m.error).slice(-12).map(({ role, content }) => ({ role, content }));
      const { data, error } = await supabase.functions.invoke("asistente", { body: { messages: history } });
      if (error) {
        let msg = "No pude responder ahora. Probá de nuevo.";
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* noop */ }
        setMsgs((m) => [...m, { role: "assistant", content: msg, error: true }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: data?.reply ?? data?.error ?? "Sin respuesta.", data: data?.data }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "No pude conectarme con el asistente.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="icon" aria-label="Abrir asistente"
        className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-elevated md:bottom-6 md:right-6">
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div ref={panelRef} className="fixed inset-x-0 top-[var(--assistant-top,0px)] z-50 flex h-[var(--assistant-vh,100dvh)] flex-col overflow-hidden bg-background md:inset-x-auto md:top-auto md:bottom-6 md:right-6 md:h-[600px] md:w-[440px] md:rounded-2xl md:border md:border-border md:shadow-elevated">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div>
          <div>
            <div className="text-sm font-semibold">Asistente Mevak</div>
            <div className="text-[11px] text-muted-foreground">Preguntá sobre los datos del ERP</div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Minimizar" onClick={() => setOpen(false)}><Minus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Cerrar" onClick={() => { setOpen(false); setMsgs([]); }}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        {msgs.length === 0 && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Probá con:</p>
            {["Comparame los gastos de enero 2025 vs enero 2026", "Decime los clientes con deuda de Argentina", "¿Cuánto facturé en septiembre 2026?"].map((s) => (
              <button key={s} onClick={() => setInput(s)} className="block w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-secondary">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] text-sm", m.role === "user" ? "rounded-2xl bg-primary px-3 py-2 text-primary-foreground" : "w-full", m.error && "text-destructive")}>
              {m.role === "user" ? (
                <div className="whitespace-pre-wrap">{m.content}</div>
              ) : (
                <div className="break-words text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="pl-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                  }}>{m.content}</ReactMarkdown>
                </div>
              )}
              {m.data && <DataView data={m.data} />}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Pensando…</div>}
        <div ref={endRef} />
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
        <Textarea ref={inputRef} value={input} rows={1} placeholder="Escribí tu pregunta…" className="max-h-32 min-h-10 resize-none"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button size="icon" onClick={send} disabled={busy || !input.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
