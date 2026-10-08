/** Canonical, channel-independent Intake V1. Never contains prices or CRM IDs. */
export const BUDGET_RANGES = ["menos_de_15k", "15k_20k", "20k_35k", "35k_50k", "50k_plus"] as const;
export const TEXT_FIELDS = ["name", "email", "whatsapp", "business_name", "what_sells", "customer_acquisition", "how_sells", "main_problem", "main_goal", "budget_range", "timing", "instagram", "facebook", "tiktok", "website", "google_business", "other_reference", "project_interest"] as const;
export const BOOLEAN_FIELDS = ["currently_selling", "no_digital_presence"] as const;
export type IntakeField = typeof TEXT_FIELDS[number] | typeof BOOLEAN_FIELDS[number];
export type IntakeData = Partial<Record<typeof TEXT_FIELDS[number], string>> & Partial<Record<typeof BOOLEAN_FIELDS[number], boolean>>;
export type Attribution = Partial<Record<"source" | "entry_channel" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "landing_path" | "referrer" | "fbclid" | "source_id" | "source_url" | "source_type" | "headline" | "body" | "ctwa_clid", string>>;

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function clean(value: unknown, max = 1200) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}
export function normalizePhone(value: unknown) {
  const phone = clean(value, 40).replace(/[\s()+.-]/g, "");
  return /^[1-9]\d{7,14}$/.test(phone) ? phone : "";
}
function normalizeReference(value: string, field: string) {
  if (["instagram", "facebook", "tiktok"].includes(field) && /^@?[A-Za-z0-9._-]{2,100}$/.test(value) && !value.includes(".com")) {
    const handle = value.replace(/^@/, "");
    return `https://www.${field}.com/${field === "tiktok" ? "@" : ""}${handle}/`;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) return "";
    return url.toString();
  } catch { return ""; }
}
export function normalizeIntakeData(value: unknown): IntakeData {
  const raw = record(value);
  const result: IntakeData = {};
  for (const key of TEXT_FIELDS) {
    let text = clean(raw[key]);
    if (key === "whatsapp") text = normalizePhone(text);
    if (key === "email") {
      text = text.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) text = "";
    }
    if (key === "budget_range" && !(BUDGET_RANGES as readonly string[]).includes(text)) text = "";
    if (["instagram", "facebook", "tiktok", "website", "google_business", "other_reference"].includes(key) && text) text = normalizeReference(text, key);
    if (text) result[key] = text;
  }
  for (const key of BOOLEAN_FIELDS) if (typeof raw[key] === "boolean") result[key] = raw[key];
  return result;
}
/** Existing CRM/confirmed values win. Empty answers cannot erase prior knowledge. */
export function mergeIntakeData(known: IntakeData, incoming: unknown): IntakeData {
  return { ...normalizeIntakeData(incoming), ...normalizeIntakeData(known) };
}
export function evaluateIntakeReadiness(input: IntakeData, hasUploadedReference = false) {
  const data = normalizeIntakeData(input);
  const requirements = {
    identity: Boolean(data.name && (data.whatsapp || data.email)),
    what_sells: Boolean(data.what_sells),
    customer_acquisition: Boolean(data.customer_acquisition || data.how_sells),
    how_sells: Boolean(data.how_sells),
    objective: Boolean(data.main_goal || data.main_problem),
    budget_range: Boolean(data.budget_range),
    timing: Boolean(data.timing),
    reference: Boolean(hasUploadedReference || data.no_digital_presence === true || [data.instagram, data.facebook, data.tiktok, data.website, data.google_business, data.other_reference].some(Boolean)),
  };
  const missing_fields = (Object.keys(requirements) as Array<keyof typeof requirements>).filter(key => !requirements[key]);
  return { known_fields: data, missing_fields, completion_percent: Math.round((8 - missing_fields.length) / 8 * 100), ready_for_quote: missing_fields.length === 0, intake_version: 1 as const };
}
export type IntakeReadiness = ReturnType<typeof evaluateIntakeReadiness>;
export function captureAttribution(value: unknown): Attribution {
  const raw = record(value);
  const out: Attribution = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "source_id", "source_type", "headline", "body", "ctwa_clid"] as const) {
    let text = clean(raw[key], key === "body" ? 1000 : 300);
    if (key === "utm_source" || key === "utm_medium") text = text.toLowerCase();
    if (text) out[key] = text;
  }
  for (const key of ["referrer", "source_url"] as const) {
    try {
      const url = new URL(clean(raw[key], 2000));
      if (["http:", "https:"].includes(url.protocol)) out[key] = url.origin + url.pathname; // no credentials/query secrets
    } catch { /* absent/invalid URL */ }
  }
  const path = clean(raw.landing_path, 500).split(/[?#]/)[0];
  if (path.startsWith("/") && !path.startsWith("//")) out.landing_path = path;
  if (["organic", "meta_ads", "referral", "direct", "whatsapp", "other"].includes(clean(raw.source))) out.source = clean(raw.source);
  if (["web", "whatsapp"].includes(clean(raw.entry_channel))) out.entry_channel = clean(raw.entry_channel);
  return out;
}
/** Freeze the whole first event, not each field across unrelated visits. */
export function mergeFirstTouch(first: Attribution, incoming: Attribution): Attribution {
  return Object.keys(first).length ? first : captureAttribution(incoming);
}
export function captureWhatsAppReferral(message: unknown): Attribution {
  const referral = record(record(message).referral);
  const data = captureAttribution(referral);
  return { ...data, source: data.source_type === "ad" || data.ctwa_clid ? "meta_ads" : "whatsapp", entry_channel: "whatsapp" };
}
export const READY_REPLY = "Perfecto, ya tengo lo necesario para que Eder revise tu proyecto. Él va a revisar lo que me compartiste y continuará contigo personalmente.";
export function nextIntakeQuestion(state: IntakeReadiness): string | null {
  const field = state.missing_fields[0];
  if (!field) return null;
  const questions = {
    identity: !state.known_fields.name ? "¿Cómo te llamas?" : "¿Qué correo o WhatsApp podemos usar para continuar contigo?",
    what_sells: "¿Qué vende o hace tu negocio?",
    customer_acquisition: "¿Cómo llegan actualmente tus clientes?",
    how_sells: "¿Qué pasa actualmente cuando alguien se interesa, desde el primer contacto hasta cerrar la venta?",
    objective: "¿Qué te gustaría mejorar principalmente en ese proceso?",
    budget_range: "¿Qué rango tienes contemplado invertir: menos de $15 mil, $15–20 mil, $20–35 mil, $35–50 mil o más de $50 mil?",
    timing: "¿Cuándo te gustaría iniciar el proyecto?",
    reference: "¿Puedes compartir una referencia de tu negocio, como una red, sitio o foto, o contarme si aún no tiene presencia digital?",
  };
  return questions[field];
}
