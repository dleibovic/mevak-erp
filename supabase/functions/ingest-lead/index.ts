import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const headers = { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"] ?? ""}, x-ingest-token`, "Content-Type": "application/json" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });

const Body = z.object({
  external_id: z.union([z.string(), z.number()]).transform(String),
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(255).optional().nullable(),
  company: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(64).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  origin: z.string().trim().max(120).optional().nullable(),
  locations: z.string().trim().max(20).optional().nullable(),
  utm_source: z.string().trim().max(120).optional().nullable(),
  utm_campaign: z.string().trim().max(255).optional().nullable(),
  utm_content: z.string().trim().max(255).optional().nullable(),
  marketing: z.boolean().optional().default(false),
  created_at: z.string().optional().nullable(),
});

export function mapSource(utm?: string | null) {
  const u = (utm ?? "").trim().toLowerCase();
  if (!u) return "organico";
  if (u === "facebook") return "paid_meta";
  if (u === "instagram") return "dm_instagram";
  return "otro";
}

export function scoreLead(loc: string | null | undefined, optIn: boolean, source: string) {
  let s = 0;
  if (loc === "2-5") s += 30;
  if (loc === "6-20" || loc === "20+") s += 50;
  if (optIn) s += 20;
  if (source === "paid_meta") s += 10;
  return s;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("INGEST_LEAD_TOKEN") ?? "";
  const token = req.headers.get("x-ingest-token") ?? "";
  if (!expected || !safeEqual(token, expected)) return json({ error: "unauthorized" }, 401);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const source = mapSource(b.utm_source);
  const email = b.email.toLowerCase();

  // Dedupe
  let { data: existing } = await sb.from("prospects").select("*").eq("external_lead_id", b.external_id).maybeSingle();
  if (!existing) {
    const { data } = await sb.from("prospects").select("*").ilike("email", email.replace(/[%_\\]/g, "\\$&")).limit(1);
    existing = data?.[0] ?? null;
  }

  const candidate: Record<string, unknown> = {
    contact_name: b.name || null,
    phone: b.phone || null,
    source,
    utm_campaign: b.utm_campaign || null,
    utm_content: b.utm_content || null,
    guide_downloaded: b.origin || null,
    locations_range: b.locations || null,
    external_lead_id: b.external_id,
  };

  if (existing) {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(candidate)) {
      const cur = (existing as any)[k];
      if ((cur === null || cur === undefined || cur === "") && v !== null) patch[k] = v;
    }
    if (b.marketing && !existing.marketing_opt_in) patch.marketing_opt_in = true;
    if (Object.keys(patch).length) {
      const merged = { ...existing, ...patch } as any;
      patch.lead_score = Math.max(existing.lead_score ?? 0, scoreLead(merged.locations_range, !!merged.marketing_opt_in, merged.source ?? ""));
      const { error } = await sb.from("prospects").update(patch).eq("id", existing.id);
      if (error) return json({ error: error.message }, 500);
    }
    if ((b.origin ?? "").trim().toLowerCase() === "booking_call") {
      await sb.from("prospect_sequences").update({ status: "stopped", stop_reason: "agendo_llamada", next_send_at: null })
        .eq("prospect_id", existing.id).eq("status", "active");
    }
    return json({ status: "duplicate", prospect_id: existing.id });
  }

  const { data: stage } = await sb.from("funnel_stages").select("id").order("stage_order", { ascending: true }).limit(1).maybeSingle();
  if (!stage) return json({ error: "no_funnel_stage" }, 500);

  const { data: countries } = await sb.from("countries").select("id,name,iso2,currency_code");
  const cq = (b.country ?? "").trim().toLowerCase();
  const country = (cq && countries?.find((c: any) => c.name?.toLowerCase() === cq || c.iso2?.toLowerCase() === cq))
    || countries?.find((c: any) => c.iso2 === "AR") || countries?.[0];
  if (!country) return json({ error: "no_country" }, 500);

  const now = new Date().toISOString();
  const { data: created, error } = await sb.from("prospects").insert({
    ...candidate,
    business_name: b.company || b.name || email,
    email,
    country_id: country.id,
    currency: country.currency_code ?? "ARS",
    status: "active",
    current_stage_id: stage.id,
    stage_entered_at: now,
    first_contact_date: now.slice(0, 10),
    marketing_opt_in: b.marketing,
    lead_score: scoreLead(b.locations, b.marketing, source),
    last_interaction_at: now,
  }).select("id").single();
  if (error) {
    if ((error as any).code === "23505") return json({ status: "duplicate" });
    return json({ error: error.message }, 500);
  }

  await sb.from("prospect_interactions").insert({
    prospect_id: created.id,
    stage_at_interaction_id: stage.id,
    notes: `Lead ingresado desde Growth Engine — guía: ${b.origin ?? "—"}, origen: ${source}`,
  });

  if (b.marketing) {
    await sb.from("prospect_sequences").upsert(
      { prospect_id: created.id, sequence_key: "nurturing_guia", next_send_at: new Date(Date.now() + 86400000).toISOString() },
      { onConflict: "prospect_id,sequence_key", ignoreDuplicates: true },
    );
  }

  return json({ status: "created", prospect_id: created.id }, 201);
});
