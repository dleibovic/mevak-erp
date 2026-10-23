import { createClient } from "npm:@supabase/supabase-js@2";
import { signProspect } from "../_shared/nurturing.ts";

const page = (msg: string, status = 200) => new Response(
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mevak</title></head><body style="margin:0;background:#F4F2EC;font-family:Arial,Helvetica,sans-serif;color:#2B2833;display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="background:#fff;border-radius:14px;padding:32px;max-width:420px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">${msg}</h1><p style="color:#6B6775;margin:0">Mevak</p></div></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// GET (link in the mail) and POST (List-Unsubscribe one-click) both unsubscribe.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("preview")) return page("Listo, no te escribimos más");
  const p = url.searchParams.get("p") ?? "";
  const s = url.searchParams.get("s") ?? "";
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET") ?? "";
  if (!secret || !/^[0-9a-f-]{36}$/i.test(p) || !safeEqual(s, await signProspect(p, secret))) return page("Link inválido", 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await sb.from("prospects").update({ marketing_opt_in: false, unsubscribed_at: new Date().toISOString() }).eq("id", p).is("unsubscribed_at", null);
  await sb.from("prospect_sequences").update({ status: "stopped", stop_reason: "baja", next_send_at: null }).eq("prospect_id", p).eq("status", "active");
  return page("Listo, no te escribimos más");
});
