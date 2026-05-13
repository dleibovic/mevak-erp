import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  async function sendEmail(to: string, subject: string, html: string) {
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) return;
    try {
      await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "Mevak ERP <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
        }),
      });
    } catch (err) {
      console.error("email send failed", err);
    }
  }

  try {
    const { data: expired, error } = await supabase.rpc("expire_discounts");
    if (error) throw error;

    let notified = 0;
    let emailed = 0;

    // Pre-fetch admins
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (admins ?? []).map((a: any) => a.user_id);
    const { data: adminProfiles } = await supabase.from("profiles").select("id, email, full_name").in("id", adminIds);

    for (const row of expired ?? []) {
      const userIds = new Set<string>();
      if (row.billing_user_id) userIds.add(row.billing_user_id);
      adminIds.forEach((id) => userIds.add(id));

      const notifs = [...userIds].map((uid) => ({
        user_id: uid,
        title: `Descuento vencido — ${row.company_name}`,
        body: `El descuento del cliente ${row.company_name} venció. Nuevo monto a facturar: ${row.new_amount} ${row.currency} (anterior con descuento: ${row.previous_amount}).`,
        link: "/clientes",
      }));
      if (notifs.length) {
        await supabase.from("notifications").insert(notifs);
        notified += notifs.length;
      }

      // Email recipients: billing user + admins
      const recipientIds = [...userIds];
      const { data: profs } = await supabase.from("profiles").select("id, email, full_name").in("id", recipientIds);
      const recipients = (profs ?? []).filter((p: any) => p.email);
      const subject = `Descuento vencido — ${row.company_name}`;
      const html = `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a">
          <h2 style="margin:0 0 12px">Descuento vencido</h2>
          <p>El descuento del cliente <strong>${row.company_name}</strong> venció hoy.</p>
          <ul>
            <li>Monto anterior con descuento: <strong>${row.previous_amount} ${row.currency}</strong></li>
            <li>Nuevo monto a facturar: <strong>${row.new_amount} ${row.currency}</strong></li>
          </ul>
          <p>Las facturas pendientes del mes en curso fueron actualizadas automáticamente.</p>
        </div>`;
      for (const r of recipients) {
        await sendEmail(r.email, subject, html);
        emailed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, expired: expired?.length ?? 0, notified, emailed, email_enabled: !!RESEND_API_KEY }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
