// Funnel helpers shared by ingest-lead, process-sequences and resend-webhook (service role client).
type Stage = { id: string; name: string; stage_order: number };

export async function loadStages(sb: any): Promise<Stage[]> {
  const { data } = await sb.from("funnel_stages").select("id,name,stage_order").order("stage_order");
  return data ?? [];
}

/** Moves the prospect to `toName` only when its current stage name is in `fromNames`. Returns true if moved. */
export async function moveStageIfIn(sb: any, stages: Stage[], prospect: { id: string; current_stage_id: string }, fromNames: string[], toName: string, note: string) {
  const cur = stages.find((s) => s.id === prospect.current_stage_id);
  const to = stages.find((s) => s.name === toName);
  if (!cur || !to || !fromNames.includes(cur.name)) return false;
  const now = new Date().toISOString();
  const { error } = await sb.from("prospects").update({ current_stage_id: to.id, stage_entered_at: now }).eq("id", prospect.id).eq("current_stage_id", cur.id);
  if (error) throw new Error(error.message);
  await sb.from("prospect_stage_history").update({ exited_at: now }).eq("prospect_id", prospect.id).is("exited_at", null);
  await sb.from("prospect_stage_history").insert({ prospect_id: prospect.id, stage_id: to.id, entered_at: now });
  await sb.from("prospect_interactions").insert({ prospect_id: prospect.id, stage_at_interaction_id: to.id, notes: note });
  prospect.current_stage_id = to.id;
  return true;
}

export async function stopActiveSequences(sb: any, prospectId: string, reason: string, extra: Record<string, unknown> = {}) {
  await sb.from("prospect_sequences").update({ status: "stopped", stop_reason: reason, next_send_at: null, ...extra })
    .eq("prospect_id", prospectId).eq("status", "active");
}

export const escapeIlike = (s: string) => s.replace(/[%_\\]/g, "\\$&");
