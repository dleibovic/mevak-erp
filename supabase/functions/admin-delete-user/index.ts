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

const BodySchema = z.object({ user_id: z.string().uuid() });

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
  const callerId = uData.user.id;
  const { data: adminOk } = await admin.rpc("is_admin", { _user_id: callerId });
  if (adminOk !== true) return json({ error: "forbidden" }, 403, cors);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body" }, 400, cors);
  const { user_id } = parsed.data;

  if (user_id === callerId) return json({ error: "cannot_delete_self", message: "No podés eliminar tu propio usuario." }, 409, cors);

  const { data: targetAdminRows } = await admin.from("user_roles").select("id").eq("user_id", user_id).eq("role", "admin");
  const targetIsAdmin = (targetAdminRows ?? []).length > 0;
  const { count: adminCount } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if (targetIsAdmin && (adminCount ?? 0) <= 1) return json({ error: "last_admin_protected", message: "No podés eliminar al único administrador." }, 409, cors);

  // profiles y user_roles se borran por cascade. Si el usuario creó registros
  // (created_by), el borrado falla -> sugerir desactivar.
  const { error } = await admin.auth.admin.deleteUser(user_id);
  if (error) return json({
    error: "delete_failed", message: error.message,
    hint: "Si el usuario ya generó registros no se puede borrar del todo; desactivalo en su lugar.",
  }, 400, cors);

  return json({ ok: true }, 200, cors);
});
