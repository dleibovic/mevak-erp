// Presentation rules for the "nurturing_guia" mail sequence shown in Prospecting.
export type SequenceRow = {
  status: string;
  current_step: number;
  stop_reason?: string | null;
  next_send_at?: string | null;
  replied_at?: string | null;
};
export type SendRow = {
  status?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  bounced_at?: string | null;
  complained_at?: string | null;
};

export const STOP_REASON_LABEL: Record<string, string> = {
  agendo_llamada: "Agendó llamada",
  pidio_auditoria: "Pidió auditoría",
  respondio: "Respondió",
  avanzo_etapa: "Avanzó de etapa",
  antiguo: "Lead antiguo (+21 días)",
  rebote: "Rebotó",
  queja: "Marcó como spam",
  email_invalido: "Email inválido",
  baja: "Se dio de baja",
  manual: "Pausada manualmente",
};

/** Reasons that must never be resumed by hand (the person opted out or the address is unusable). */
const NON_RESUMABLE = new Set(["baja", "rebote", "queja", "email_invalido"]);

export const hasReplied = (seq?: SequenceRow | null) => !!seq && (!!seq.replied_at || seq.stop_reason === "respondio");

export function sequenceStatusLabel(seq: SequenceRow) {
  if (hasReplied(seq)) return "Respondió";
  if (seq.status === "active") return "Activa";
  if (seq.status === "completed") return "Completada";
  return `Frenada${seq.stop_reason ? " · " + (STOP_REASON_LABEL[seq.stop_reason] ?? seq.stop_reason) : ""}`;
}

export function canPause(seq: SequenceRow) {
  return seq.status === "active";
}

export function canResume(seq: SequenceRow, optIn: boolean) {
  return seq.status === "stopped" && optIn && seq.current_step < 3 && !NON_RESUMABLE.has(seq.stop_reason ?? "") && !hasReplied(seq);
}

export function sendBadges(s: SendRow): string[] {
  const out: string[] = [];
  if (s.bounced_at || s.status === "bounced") return ["Rebotó"];
  if (s.complained_at || s.status === "complained") return ["Spam"];
  if (s.delivered_at || ["delivered", "opened", "clicked"].includes(s.status ?? "")) out.push("Entregado");
  if (s.opened_at || ["opened", "clicked"].includes(s.status ?? "")) out.push("Abierto");
  if (s.clicked_at || s.status === "clicked") out.push("Clic");
  return out.length ? out : ["Enviado"];
}

/** Short label for the prospects list. */
export function sequencePill(seq?: SequenceRow | null): { label: string; tone: "replied" | "active" | "muted" | "danger" } | null {
  if (!seq) return null;
  if (hasReplied(seq)) return { label: "Respondió", tone: "replied" };
  if (seq.status === "active") return { label: `Mail ${Math.min(seq.current_step + 1, 3)}/3`, tone: "active" };
  if (seq.status === "completed") return { label: "Completada", tone: "muted" };
  const r = seq.stop_reason ?? "";
  return { label: STOP_REASON_LABEL[r] ?? "Frenada", tone: r === "rebote" || r === "queja" ? "danger" : "muted" };
}
