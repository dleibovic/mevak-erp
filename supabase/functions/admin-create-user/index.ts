import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

function buildCors(origin: string | null) {
  const allowed =
    !!origin &&
    (origin === "https://mevak-erp.lovable.app" ||
      origin === "https://mevak-crm.lovable.app" ||
      origin.endsWith(".lovable.app") ||
      origin.endsWith(".lovableproject.com"));
  const allowOrigin = allowed ? origin! : "https://mevak-erp.lovable.app";
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

  // Identificar al llamador y verificar que es admin
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401, cors);
  const { data: adminOk } = await admin.rpc("is_admin", { _user_id: userData.user.id });
  if (adminOk !== true) return json({ error: "forbidden" }, 403, cors);

  // Validar body
  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten().fieldErrors }, 400, cors);
  const { email, password, full_name, role } = parsed.data;

  // Crear el usuario. El trigger handle_new_user YA crea el profile y asigna un rol
  // por defecto (executive). Por eso NO insertamos profile de nuevo.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name },
  });
  if (createErr || !created?.user) return json({ error: "create_user_failed", message: createErr?.message ?? "unknown" }, 400, cors);
  const newUserId = created.user.id;

  // Reemplazar el rol por defecto del trigger por el rol elegido (evita roles duplicados)
  const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", newUserId);
  if (delErr) { await admin.auth.admin.deleteUser(newUserId); return json({ error: "role_setup_failed", message: delErr.message }, 500, cors); }
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newUserId, role });
  if (roleErr) { await admin.auth.admin.deleteUser(newUserId); return json({ error: "role_insert_failed", message: roleErr.message }, 500, cors); }

  // Sincronizar el nombre en profiles (best-effort; el trigger ya lo creó)
  await admin.from("profiles").update({ full_name, email }).eq("id", newUserId);

  return json({ user_id: newUserId }, 200, cors);
});
