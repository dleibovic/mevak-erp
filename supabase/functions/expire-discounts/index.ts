import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: expired, error } = await supabase.rpc("expire_discounts");
    if (error) throw error;

    let notified = 0;
    for (const row of expired ?? []) {
      // notify billing user + admins
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const userIds = new Set<string>();
      if (row.billing_user_id) userIds.add(row.billing_user_id);
      (admins ?? []).forEach((a: any) => userIds.add(a.user_id));

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
    }

    return new Response(
      JSON.stringify({ ok: true, expired: expired?.length ?? 0, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
