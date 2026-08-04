import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

function buildCors(origin: string | null) {
  const allowed = !!origin && (origin === "https://mevak-erp.lovable.app" ||
    origin === "https://mevak-crm.lovable.app" || origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com"));
  const allowOrigin = allowed ? origin! : "https://mevak-erp.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400", "Vary": "Origin",
  };
}
function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const BodySchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().trim().email().max(255).optional(),
  password: z.string().min(8).max(72).optional(),
  full_name: z.string().trim().min(1).max(200).optional(),
  role: z.enum(["admin", "administracion", "executive"]).optional(),
  banned: z.boolean().optional(), // true = desactivar (bloquear login), false = reactivar
});

Deno.serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!jwt) return json({ error: "unauthorized" }, 401, cors);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: uData, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !uData?.user) return json({ error: "unauthorized" }, 401, cors);
  const { data: adminOk } = await admin.rpc("is_admin", { _user_id: uData.user.id });
  if (adminOk !== true) return json({ error: "forbidden" }, 403, cors);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten().fieldErrors }, 400, cors);
  const { user_id, email, password, full_name, role, banned } = parsed.data;

  // Proteger al último admin
  const { data: targetAdminRows } = await admin.from("user_roles").select("id").eq("user_id", user_id).eq("role", "admin");
  const targetIsAdmin = (targetAdminRows ?? []).length > 0;
  const { count: adminCount } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  const removesLastAdmin = targetIsAdmin && (adminCount ?? 0) <= 1 && ((role && role !== "admin") || banned === true);
  if (removesLastAdmin) return json({ error: "last_admin_protected", message: "No podés quitarle admin ni desactivar al único administrador." }, 409, cors);

  // Auth: email / password / ban
  const authPatch: Record<string, unknown> = {};
  if (email) authPatch.email = email;
  if (password) authPatch.password = password;
  if (banned !== undefined) authPatch.ban_duration = banned ? "876000h" : "none";
  if (Object.keys(authPatch).length) {
    const { error } = await admin.auth.admin.updateUserById(user_id, authPatch);
    if (error) return json({ error: "auth_update_failed", message: error.message }, 400, cors);
  }

  // Profile: nombre / email
  const profPatch: Record<string, unknown> = {};
  if (full_name) profPatch.full_name = full_name;
  if (email) profPatch.email = email;
  if (Object.keys(profPatch).length) await admin.from("profiles").update(profPatch).eq("id", user_id);

  // Rol: reemplazar
  if (role) {
    await admin.from("user_roles").delete().eq("user_id", user_id);
    const { error } = await admin.from("user_roles").insert({ user_id, role });
    if (error) return json({ error: "role_update_failed", message: error.message }, 500, cors);
  }

  return json({ ok: true }, 200, cors);
});
