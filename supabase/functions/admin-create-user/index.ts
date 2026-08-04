// admin-create-user
// Crea un usuario de auth + fila en profiles + asigna un rol de ERP.
// Auth: JWT del llamador (verify_jwt=true). Solo admins del ERP pueden llamarla.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const ALLOWED_ORIGINS = new Set([
  "https://mevak-erp.lovable.app",
  "https://mevak-crm.lovable.app",
]);
function buildCors(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://mevak-erp.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(200),
  role: z.enum(["admin", "administracion", "executive"]),
});

Deno.serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!jwt) return json({ error: "unauthorized" }, 401, cors);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1) Identificar al llamador por su JWT
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401, cors);
  const callerId = userData.user.id;

  // 2) Autorizar: el llamador debe ser admin del ERP
  const { data: adminOk } = await admin.rpc("is_admin", { _user_id: callerId });
  if (adminOk !== true) return json({ error: "forbidden" }, 403, cors);

  // 3) Validar body
  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten().fieldErrors }, 400, cors);
  const { email, password, full_name, role } = parsed.data;

  // 4) Crear el usuario de auth
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name },
  });
  if (createErr || !created?.user) return json({ error: "create_user_failed", message: createErr?.message ?? "unknown" }, 400, cors);
  const newUserId = created.user.id;

  // 5) Profile + rol (rollback del auth user si algo falla)
  const { error: profileErr } = await admin.from("profiles").insert({ id: newUserId, full_name, email });
  if (profileErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return json({ error: "profile_insert_failed", message: profileErr.message }, 500, cors);
  }
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newUserId, role });
  if (roleErr) {
    await admin.from("profiles").delete().eq("id", newUserId);
    await admin.auth.admin.deleteUser(newUserId);
    return json({ error: "role_insert_failed", message: roleErr.message }, 500, cors);
  }

  return json({ user_id: newUserId }, 200, cors);
});
