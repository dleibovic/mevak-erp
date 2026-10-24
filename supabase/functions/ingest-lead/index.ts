import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { enrollmentFor, isAuditOrigin, LATE_OPT_IN_NOTE } from "../_shared/nurturing.ts";
import { escapeIlike, loadStages, moveStageIfIn, stopActiveSequences } from "../_shared/prospects.ts";

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
  food_category: z.string().trim().max(120).optional().nullable(),
  lang: z.string().trim().max(10).optional().nullable(),
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

const COUNTRY_ALIASES: Record<string, string> = {
  "estados unidos": "US", "united states": "US", "usa": "US", "eeuu": "US", "ee.uu.": "US",
  "canada": "CA", "canadá": "CA", "united kingdom": "GB", "reino unido": "GB", "uk": "GB",
  "españa": "ES", "spain": "ES", "argentina": "AR",
};

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
  const audit = isAuditOrigin(b.origin);
  const auditNote = `Pidió auditoría desde el sitio (${(b.origin ?? "").trim()})`;
  const now = new Date().toISOString();

  // Dedupe: external id first, then email.
  let { data: existing } = await sb.from("prospects").select("*").eq("external_lead_id", b.external_id).maybeSingle();
  if (!existing) {
    const { data } = await sb.from("prospects").select("*").ilike("email", escapeIlike(email)).limit(1);
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
    food_category: b.food_category || null,
    lang: b.lang ? b.lang.toLowerCase() : null,
    external_lead_id: b.external_id,
  };

  if (existing) {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(candidate)) {
      const cur = (existing as any)[k];
      if ((cur === null || cur === undefined || cur === "") && v !== null) patch[k] = v;
    }
    if (b.marketing && !existing.marketing_opt_in && !existing.unsubscribed_at) patch.marketing_opt_in = true;
    if (audit && !existing.audit_requested_at) patch.audit_requested_at = now;
    if (audit) patch.last_interaction_at = now;
    if (Object.keys(patch).length) {
      const merged = { ...existing, ...patch } as any;
      patch.lead_score = Math.max(existing.lead_score ?? 0, scoreLead(merged.locations_range, !!merged.marketing_opt_in, merged.source ?? ""));
      const { error } = await sb.from("prospects").update(patch).eq("id", existing.id);
      if (error) return json({ error: error.message }, 500);
    }
    if (audit) {
      await stopActiveSequences(sb, existing.id, "pidio_auditoria");
      await sb.from("prospect_interactions").insert({ prospect_id: existing.id, stage_at_interaction_id: existing.current_stage_id, notes: auditNote });
      await moveStageIfIn(sb, await loadStages(sb), existing as any, ["Nuevo Contacto", "Contactado"], "Interesado", "Etapa → Interesado (pidió auditoría)");
    }
    // Late opt-in: enroll only if the person never had a nurturing_guia row (any status).
    if (b.marketing && !existing.marketing_opt_in && !existing.unsubscribed_at) {
      const { data: seqRows } = await sb.from("prospect_sequences").select("id")
        .eq("prospect_id", existing.id).eq("sequence_key", "nurturing_guia").limit(1);
      const enroll = enrollmentFor({ isNew: false, marketing: true, audit, wasOptedIn: false, unsubscribed: false, hasSequenceRow: (seqRows?.length ?? 0) > 0 });
      if (enroll) {
        const { data: ins } = await sb.from("prospect_sequences").upsert(
          { prospect_id: existing.id, sequence_key: "nurturing_guia", ...enroll },
          { onConflict: "prospect_id,sequence_key", ignoreDuplicates: true },
        ).select("id");
        if (enroll.status === "active" && ins?.length) {
          await sb.from("prospect_interactions").insert({ prospect_id: existing.id, stage_at_interaction_id: existing.current_stage_id, notes: LATE_OPT_IN_NOTE });
        }
      }
    }
    return json({ status: "duplicate", prospect_id: existing.id });
  }

  const stages = await loadStages(sb);
  const first = stages[0];
  if (!first) return json({ error: "no_funnel_stage" }, 500);
  const stage = (audit && stages.find((s) => s.name === "Interesado")) || first;

  const { data: countries } = await sb.from("countries").select("id,name,iso2,currency_code");
  const cq = (b.country ?? "").trim().toLowerCase();
  const iso = COUNTRY_ALIASES[cq] ?? (cq.length === 2 ? cq.toUpperCase() : null);
  const country = (cq && countries?.find((c: any) => c.name?.toLowerCase() === cq || (iso && c.iso2 === iso)))
    || countries?.find((c: any) => c.iso2 === "AR") || countries?.[0];
  if (!country) return json({ error: "no_country" }, 500);

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
    audit_requested_at: audit ? now : null,
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
    notes: audit ? auditNote : `Lead ingresado desde Growth Engine — guía: ${b.origin ?? "—"}, origen: ${source}`,
  });

  const enroll = enrollmentFor({ isNew: true, marketing: b.marketing, audit });
  if (enroll) {
    await sb.from("prospect_sequences").upsert(
      { prospect_id: created.id, sequence_key: "nurturing_guia", ...enroll },
      { onConflict: "prospect_id,sequence_key", ignoreDuplicates: true },
    );
  }

  return json({ status: "created", prospect_id: created.id }, 201);
});
