// compute-create-user
// Creates an auth user + profiles row using the service role.
// Authentication: shared secret via `x-shared-secret` header (constant-time compare).
// Scope: ERP-only. Does NOT touch CRM tables (roles / employees / mevak_*).

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const ALLOWED_ORIGINS = new Set([
  "https://mevak-crm.lovable.app",
  "https://mevak-erp.lovable.app",
]);

function buildCors(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://mevak-crm.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shared-secret",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(200),
});

Deno.serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const expectedSecret = Deno.env.get("COMPUTE_CREATE_USER_SECRET");
  if (!expectedSecret) {
    console.error("COMPUTE_CREATE_USER_SECRET not configured");
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-shared-secret") ?? "";
  if (!timingSafeEqual(provided, expectedSecret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "invalid_body", details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const { email, password, full_name } = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createErr || !created?.user) {
    console.error("auth.admin.createUser failed", createErr);
    return new Response(
      JSON.stringify({ error: "create_user_failed", message: createErr?.message ?? "unknown" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const newUserId = created.user.id;

  const { error: profileErr } = await supabase
    .from("profiles")
    .insert({ id: newUserId, full_name, email });

  if (profileErr) {
    console.error("profiles insert failed, rolling back auth user", profileErr);
    const { error: delErr } = await supabase.auth.admin.deleteUser(newUserId);
    if (delErr) console.error("rollback deleteUser failed", delErr);
    return new Response(
      JSON.stringify({
        error: "profile_insert_failed",
        message: profileErr.message,
        rolled_back: !delErr,
      }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ user_id: newUserId }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
