import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai@2";
import { streamText, tool, stepCountIs, type ModelMessage } from "npm:ai@5";
import { z } from "npm:zod@3.23.8";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const RATES: Record<string, number> = { ARS: 1, USD: 1545, EUR: 1.165 * 1545 };
const DARIO_CH = ["stripe_dario", "us_dario", "dario_transferencia", "dario_efectivo"];
const MARIA_CH = ["maria_transferencia", "maria_efectivo"];
const RUN_HDR = "X-Lovable-AIG-Run-ID";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": RUN_HDR,
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_HDR)) headers.set(RUN_HDR, runId);
    const r = await fetch(input, { ...init, headers });
    runId ??= r.headers.get(RUN_HDR)?.trim() || undefined;
    return r;
  };
}

const toArs = (amt: number, cur: string) => Number(amt || 0) * (RATES[cur] ?? 1);
const r2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

/** "2025-01" | "2025" | "2025-01-15" | "2025-01..2025-03" → [desde, hasta] (YYYY-MM-DD) */
function parsePeriod(p: string): [string, string] | null {
  const s = p.trim();
  if (s.includes("..")) {
    const [a, b] = s.split("..");
    const pa = parsePeriod(a), pb = parsePeriod(b);
    return pa && pb ? [pa[0], pb[1]] : null;
  }
  let m = s.match(/^(\d{4})$/);
  if (m) return [`${m[1]}-01-01`, `${m[1]}-12-31`];
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
    return [`${m[1]}-${m[2]}-01`, `${m[1]}-${m[2]}-${pad(last)}`];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return [s, s];
  return null;
}
const totalsByCur = (rows: { amount: number; currency: string }[]) => {
  const t: Record<string, number> = {};
  rows.forEach((r) => (t[r.currency] = r2((t[r.currency] ?? 0) + Number(r.amount || 0))));
  return t;
};
const arsTotal = (rows: { amount: number; currency: string }[]) => r2(rows.reduce((s, r) => s + toArs(r.amount, r.currency), 0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: u, error: uErr } = await db.auth.getUser(jwt);
  if (uErr || !u?.user) return json({ error: "unauthorized" }, 401);
  const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
  const roles = (roleRows ?? []).map((r: any) => r.role);
  const role = roles.includes("admin") ? "admin" : roles.includes("administracion") ? "administracion" : null;
  if (!role) return json({ denied: true, reply: "El asistente no está disponible para tu rol." });
  const isAdmin = role === "admin";

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1).max(30).safeParse(body?.messages);
  if (!parsed.success) return json({ error: "invalid_body" }, 400);
  const messages: ModelMessage[] = parsed.data.slice(-12).map((m) => ({ role: m.role, content: m.content }));

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Falta configurar la IA." }, 500);

  // Catálogos
  const [{ data: countries }, { data: cats }, { data: emps }] = await Promise.all([
    db.from("countries").select("id,name"),
    db.from("expense_categories").select("id,name"),
    db.from("employees").select("id,full_name,role,is_active,country_id,start_date,company_email"),
  ]);
  const countryName = new Map((countries ?? []).map((c: any) => [c.id, c.name]));
  const catName = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
  const empName = new Map((emps ?? []).map((e: any) => [e.id, e.full_name]));
  const findCountry = (q?: string) => q ? (countries ?? []).filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase())).map((c: any) => c.id) : null;
  const findCat = (q?: string) => q ? (cats ?? []).filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase())).map((c: any) => c.id) : null;
  const payer = (p: string | null) => (p === "dario" ? "Darío" : p === "maria" ? "Meri" : "—");
  const partnerOf = (ch: string | null) => ch && DARIO_CH.includes(ch) ? "dario" : ch && MARIA_CH.includes(ch) ? "maria" : null;

  let lastData: any = null;
  const setData = (d: any) => { lastData = d; return d; };

  async function fetchExpenses(desde?: string, hasta?: string, categoria?: string, quien?: string) {
    let q = db.from("expenses").select("date,description,category_id,amount,currency,paid_by").order("date").limit(2000);
    if (desde) q = q.gte("date", desde);
    if (hasta) q = q.lte("date", hasta);
    const catIds = findCat(categoria);
    if (catIds) { if (!catIds.length) return []; q = q.in("category_id", catIds); }
    if (quien) q = q.eq("paid_by", quien);
    const { data } = await q;
    return data ?? [];
  }
  async function fetchInvoices(desde: string, hasta: string) {
    const { data } = await db.from("monthly_invoices")
      .select("amount,amount_paid,currency,period_month,status,payment_channel,client_id,clients(company_name,country_id)")
      .is("voided_at", null).gte("period_month", desde).lte("period_month", hasta).limit(5000);
    return data ?? [];
  }

  const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const tools: Record<string, any> = {
    consultar_gastos: tool({
      description: "Lista gastos con filtros opcionales y totales por moneda.",
      inputSchema: z.object({
        desde: dateStr.optional(), hasta: dateStr.optional(),
        categoria: z.string().max(80).optional(), quien_pago: z.enum(["dario", "maria"]).optional(),
      }),
      execute: async ({ desde, hasta, categoria, quien_pago }) => {
        const rows = await fetchExpenses(desde, hasta, categoria, isAdmin ? quien_pago : undefined);
        const out = rows.map((e: any) => ({
          fecha: e.date, descripcion: e.description, categoria: catName.get(e.category_id) ?? "—",
          monto: Number(e.amount), moneda: e.currency, ...(isAdmin ? { quien_pago: payer(e.paid_by) } : {}),
        }));
        const cols = ["fecha", "descripcion", "categoria", "monto", "moneda", ...(isAdmin ? ["quien_pago"] : [])];
        setData({ type: "table", title: "Gastos", columns: cols, rows: out.slice(0, 200) });
        return { cantidad: out.length, totales_por_moneda: totalsByCur(rows as any), total_ars_convertido: arsTotal(rows as any), muestra: out.slice(0, 40) };
      },
    }),
    comparar_gastos: tool({
      description: 'Compara el total de gastos entre dos períodos. Períodos: "2025-01", "2025", "2025-01..2025-03".',
      inputSchema: z.object({ periodoA: z.string().max(30), periodoB: z.string().max(30), categoria: z.string().max(80).optional() }),
      execute: async ({ periodoA, periodoB, categoria }) => {
        const a = parsePeriod(periodoA), b = parsePeriod(periodoB);
        if (!a || !b) return { error: "Período inválido. Usá AAAA-MM, AAAA o AAAA-MM..AAAA-MM." };
        const [ra, rb] = await Promise.all([fetchExpenses(a[0], a[1], categoria), fetchExpenses(b[0], b[1], categoria)]);
        const ta = arsTotal(ra as any), tb = arsTotal(rb as any);
        const byCat = (rows: any[]) => { const m: Record<string, number> = {}; rows.forEach((e) => { const k = catName.get(e.category_id) ?? "—"; m[k] = (m[k] ?? 0) + toArs(e.amount, e.currency); }); return m; };
        const ca = byCat(ra), cb = byCat(rb);
        const keys = [...new Set([...Object.keys(ca), ...Object.keys(cb)])];
        setData({ type: "chart", title: `Gastos ${periodoA} vs ${periodoB} (ARS)`, chart: { kind: "bar", x: "categoria", series: [periodoA, periodoB] },
          rows: keys.map((k) => ({ categoria: k, [periodoA]: r2(ca[k] ?? 0), [periodoB]: r2(cb[k] ?? 0) })) });
        return { periodoA: { total_ars: ta, por_moneda: totalsByCur(ra as any) }, periodoB: { total_ars: tb, por_moneda: totalsByCur(rb as any) },
          diferencia_ars: r2(tb - ta), variacion_pct: ta ? r2(((tb - ta) / ta) * 100) : null, nota: "Convertido a ARS (USD 1545, EUR 1800,43)" };
      },
    }),
    deuda_clientes: tool({
      description: "Clientes con saldo pendiente (facturas no anuladas con saldo > 0).",
      inputSchema: z.object({ pais: z.string().max(60).optional(), cliente: z.string().max(120).optional() }),
      execute: async ({ pais, cliente }) => {
        const { data } = await db.from("monthly_invoices")
          .select("amount,amount_paid,currency,period_month,status,clients(company_name,country_id)").is("voided_at", null).limit(5000);
        const cIds = findCountry(pais);
        const rows = (data ?? []).map((r: any) => ({
          cliente: r.clients?.company_name ?? "—", country_id: r.clients?.country_id, pais: countryName.get(r.clients?.country_id) ?? "—",
          periodo: String(r.period_month).slice(0, 7), saldo: r2(Number(r.amount) - Number(r.amount_paid || 0)), moneda: r.currency, estado: r.status,
        })).filter((r) => r.saldo > 0 && (!cIds || cIds.includes(r.country_id)) && (!cliente || r.cliente.toLowerCase().includes(cliente.toLowerCase())))
          .map(({ country_id, ...r }) => r);
        setData({ type: "table", title: "Clientes con deuda", columns: ["cliente", "pais", "periodo", "saldo", "moneda", "estado"], rows: rows.slice(0, 200) });
        const tot = rows.map((r) => ({ amount: r.saldo, currency: r.moneda }));
        return { cantidad: rows.length, totales_por_moneda: totalsByCur(tot), total_ars_convertido: arsTotal(tot), detalle: rows.slice(0, 50) };
      },
    }),
    ingresos: tool({
      description: `Ingresos de un período (AAAA-MM, AAAA o rango). modo 'facturado' o 'cobrado'.${isAdmin ? " Incluye desglose por socio." : ""}`,
      inputSchema: z.object({ periodo: z.string().max(30), pais: z.string().max(60).optional(), modo: z.enum(["facturado", "cobrado"]).optional() }),
      execute: async ({ periodo, pais, modo = "facturado" }) => {
        const p = parsePeriod(periodo);
        if (!p) return { error: "Período inválido." };
        const cIds = findCountry(pais);
        const inv = (await fetchInvoices(p[0], p[1])).filter((r: any) => !cIds || cIds.includes(r.clients?.country_id));
        const val = (r: any) => modo === "cobrado" ? Number(r.amount_paid || 0) : Number(r.amount);
        const rows = inv.map((r: any) => ({ amount: val(r), currency: r.currency }));
        const byCountry: Record<string, number> = {};
        inv.forEach((r: any) => { const k = countryName.get(r.clients?.country_id) ?? "—"; byCountry[k] = r2((byCountry[k] ?? 0) + toArs(val(r), r.currency)); });
        setData({ type: "chart", title: `Ingresos ${modo} ${periodo} por país (ARS)`, chart: { kind: "bar", x: "pais", series: ["ARS"] },
          rows: Object.entries(byCountry).map(([pais, v]) => ({ pais, ARS: v })) });
        const res: any = { modo, facturas: inv.length, totales_por_moneda: totalsByCur(rows), total_ars_convertido: arsTotal(rows), por_pais_ars: byCountry };
        if (isAdmin) {
          const soc: Record<string, number> = { Darío: 0, Meri: 0, "Sin asignar": 0 };
          inv.forEach((r: any) => { const pp = partnerOf(r.payment_channel); const k = pp === "dario" ? "Darío" : pp === "maria" ? "Meri" : "Sin asignar"; soc[k] = r2(soc[k] + toArs(Number(r.amount_paid || 0), r.currency)); });
          res.cobrado_por_socio_ars = soc;
        }
        return res;
      },
    }),
    clientes: tool({
      description: "Lista clientes. estado: active|onboarding|paused|churned.",
      inputSchema: z.object({ estado: z.enum(["active", "onboarding", "paused", "churned"]).optional(), pais: z.string().max(60).optional(), ejecutivo: z.string().max(120).optional() }),
      execute: async ({ estado, pais, ejecutivo }) => {
        let q = db.from("clients").select("company_name,status,country_id,assigned_executive_id,monthly_fee,fee_currency,branches_count").order("company_name").limit(2000);
        if (estado) q = q.eq("status", estado);
        const cIds = findCountry(pais);
        if (cIds) { if (!cIds.length) return { cantidad: 0 }; q = q.in("country_id", cIds); }
        const { data } = await q;
        const rows = (data ?? []).map((c: any) => ({ cliente: c.company_name, estado: c.status, pais: countryName.get(c.country_id) ?? "—",
          ejecutivo: empName.get(c.assigned_executive_id) ?? "—", fee: Number(c.monthly_fee || 0), moneda: c.fee_currency, sucursales: c.branches_count }))
          .filter((c) => !ejecutivo || c.ejecutivo.toLowerCase().includes(ejecutivo.toLowerCase()));
        setData({ type: "table", title: "Clientes", columns: ["cliente", "estado", "pais", "ejecutivo", "fee", "moneda", "sucursales"], rows: rows.slice(0, 200) });
        return { cantidad: rows.length, detalle: rows.slice(0, 60) };
      },
    }),
    empleados: tool({
      description: "Lista empleados.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = (emps ?? []).map((e: any) => ({ nombre: e.full_name, rol: e.role, activo: e.is_active ? "Sí" : "No", pais: countryName.get(e.country_id) ?? "—", ingreso: e.start_date }));
        setData({ type: "table", title: "Empleados", columns: ["nombre", "rol", "activo", "pais", "ingreso"], rows });
        return { cantidad: rows.length, detalle: rows };
      },
    }),
  };

  if (isAdmin) {
    tools.cuenta_corriente_socios = tool({
      description: "Cuenta corriente entre socios Darío y Meri: cobros, gastos pagados, saldo a favor y dividendos (50/50). periodo opcional (AAAA-MM, AAAA, rango); sin periodo = histórico.",
      inputSchema: z.object({ periodo: z.string().max(30).optional() }),
      execute: async ({ periodo }) => {
        const p = periodo ? parsePeriod(periodo) : ["2000-01-01", new Date().toISOString().slice(0, 10)] as [string, string];
        if (!p) return { error: "Período inválido." };
        const [inv, exp, { data: adj }] = await Promise.all([
          fetchInvoices(p[0], p[1]), fetchExpenses(p[0], p[1]),
          db.from("cc_adjustments").select("adjustment_date,amount,in_favor_of,concepto").lte("adjustment_date", p[1]),
        ]);
        const cob = { dario: 0, maria: 0 }, gas = { dario: 0, maria: 0 };
        inv.forEach((r: any) => { const pp = partnerOf(r.payment_channel); if (pp) cob[pp] += toArs(Number(r.amount_paid || 0), r.currency); });
        exp.forEach((e: any) => { if (e.paid_by === "dario" || e.paid_by === "maria") gas[e.paid_by as "dario" | "maria"] += toArs(e.amount, e.currency); });
        const neto = cob.dario + cob.maria - gas.dario - gas.maria;
        const saldoD = neto / 2 - (cob.dario - gas.dario);
        const ajustes = (adj ?? []).reduce((s: number, a: any) => s + (a.in_favor_of === "dario" ? 1 : -1) * Number(a.amount), 0);
        const total = saldoD + ajustes;
        const rows = [
          { socio: "Darío", cobrado: r2(cob.dario), gastos_pagados: r2(gas.dario), posicion: r2(cob.dario - gas.dario), dividendo: r2(neto / 2) },
          { socio: "Meri", cobrado: r2(cob.maria), gastos_pagados: r2(gas.maria), posicion: r2(cob.maria - gas.maria), dividendo: r2(neto / 2) },
        ];
        setData({ type: "table", title: "Cuenta corriente socios (ARS)", columns: ["socio", "cobrado", "gastos_pagados", "posicion", "dividendo"], rows });
        return { rango: p, socios: rows, saldo_movimientos_a_favor_dario: r2(saldoD), ajustes_y_saldo_inicial: r2(ajustes), saldo_total_a_favor_dario: r2(total),
          interpretacion: "Positivo = Meri le debe a Darío; negativo = Darío le debe a Meri. Montos en ARS." };
      },
    });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const system = `Sos el asistente del ERP de Mevak. Respondé en español rioplatense, claro y conciso. Hoy es ${hoy}. Rol del usuario: ${role}.
SOLO podés usar las tools disponibles para obtener datos; nunca inventes cifras. Si falta un dato clave (por ejemplo el período), repreguntá.
Cuando sumes o compares monedas distintas, convertí a ARS (USD→ARS 1545, EUR→ARS 1800,43) y aclaralo; si es una sola moneda, mostrala en su moneda.
${isAdmin ? "" : "PROHIBIDO para este rol: cualquier dato de socios, cuenta corriente entre socios, dividendos, reparto entre socios o quién cobró/pagó (Darío vs Meri). Para esas preguntas respondé exactamente: \"No tenés acceso a esa información\"."}
Si la pregunta pide algo que no cubren las tools, respondé "No tenés acceso a esa información". El detalle en tabla o gráfico se muestra aparte, así que resumí los números clave sin repetir toda la tabla.`;

  try {
    const provider = createOpenAI({
      baseURL: GATEWAY, apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch(),
    });
    let streamErr: unknown = null;
    const result = streamText({
      model: provider.responses(MODEL),
      system, messages, tools, stopWhen: stepCountIs(6), abortSignal: req.signal,
      onError: ({ error }) => { streamErr = error; },
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
    });
    const text = await result.text;
    if (streamErr && !text) throw streamErr;
    return json({ reply: text || "No pude generar una respuesta.", ...(lastData ? { data: lastData } : {}) });
  } catch (e: any) {
    const status = e?.statusCode ?? e?.lastError?.statusCode ?? 500;
    console.error("asistente error", status, e?.message);
    const msg = status === 402 ? "Se agotaron los créditos de IA. Recargalos en Settings → Plans & credits."
      : status === 429 ? "Hay muchas consultas en este momento, probá en un rato." : "No pude responder ahora. Probá de nuevo.";
    return json({ error: msg }, status === 402 || status === 429 || status === 403 ? status : 500);
  }
});
