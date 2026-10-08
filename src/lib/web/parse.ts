import { captureAttribution, record, type Attribution } from "@/lib/intake/domain";

/** Events a browser may declare. Everything else (session_started, lead_created) is server-owned. */
export const CLIENT_EVENTS = ["audit_cta_clicked", "diagnosis_started", "stage_viewed", "contact_details_submitted", "session_ended"] as const;
export type ClientEvent = typeof CLIENT_EVENTS[number];
export type Consent = { analytics: boolean; marketing: boolean };
export type WebSessionInput =
  | { action: "create"; attribution: Attribution; fbp?: string; fbc?: string; consent?: Consent; current_path?: string; current_stage?: string }
  | { action: "event"; event_name: ClientEvent; event_id: string; stage?: string; path?: string; properties: Record<string, boolean | string> }
  | { action: "heartbeat"; current_path?: string; current_stage?: string; consent?: Consent };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIXEL_ID_PATTERN = /^[A-Za-z0-9._!:-]{1,300}$/;
/** The only attribution values web_sessions stores; fbclid/CTWA extras belong to intake alone. */
const ATTRIBUTION_FIELDS = ["source", "entry_channel", "landing_path", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const ALLOWED_KEYS: Record<string, string[]> = {
  create: ["action", "attribution", "consent", "current_path", "current_stage"],
  event: ["action", "event_name", "event_id", "stage", "path", "properties"],
  heartbeat: ["action", "current_path", "current_stage", "consent"],
};
/** Per-event property schema. A key outside this map is never persisted, so PII cannot enter. */
const EVENT_PROPERTIES: Record<ClientEvent, Record<string, "boolean" | "string">> = {
  audit_cta_clicked: {},
  diagnosis_started: {},
  stage_viewed: { previous_stage: "string" },
  contact_details_submitted: { has_name: "boolean", has_whatsapp: "boolean", has_email: "boolean" },
  session_ended: {},
};

function text(value: unknown, max: number) {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return clean || undefined;
}
/** Internal paths only: query strings, fragments and absolute URLs are never stored. */
function path(value: unknown) {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().split(/[?#]/)[0].slice(0, 500);
  if (!clean.startsWith("/") || clean.startsWith("//")) return undefined;
  return clean;
}
function consent(value: unknown): Consent | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_consent");
  const raw = record(value);
  if (Object.keys(raw).some(key => !["analytics", "marketing"].includes(key))) throw Error("invalid_consent");
  for (const key of ["analytics", "marketing"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") throw Error("invalid_consent");
  }
  return { analytics: raw.analytics === true, marketing: raw.marketing === true };
}
function attribution(value: unknown) {
  if (value !== undefined && (value === null || typeof value !== "object" || Array.isArray(value))) throw Error("invalid_attribution");
  const sanitized = captureAttribution(value);
  const out: Attribution = {};
  for (const field of ATTRIBUTION_FIELDS) if (sanitized[field]) out[field] = sanitized[field];
  return out;
}
/** Meta pixel identifiers are marketing data: kept only when marketing consent is explicit. */
function pixels(value: unknown, consentValue: Consent | undefined) {
  const raw = record(value);
  if (consentValue?.marketing !== true) return {} as { fbp?: string; fbc?: string };
  const fbp = typeof raw.fbp === "string" && PIXEL_ID_PATTERN.test(raw.fbp) ? raw.fbp : undefined;
  const fbc = typeof raw.fbc === "string" && PIXEL_ID_PATTERN.test(raw.fbc) ? raw.fbc : undefined;
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
}
function properties(event: ClientEvent, value: unknown): Record<string, boolean | string> {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_event_properties");
  const raw = record(value), schema = EVENT_PROPERTIES[event], out: Record<string, boolean | string> = {};
  for (const key of Object.keys(raw)) {
    // Own-property check: inherited names such as "constructor" are not schema keys.
    if (!Object.prototype.hasOwnProperty.call(schema, key)) throw Error("invalid_event_properties");
    if (schema[key] === "boolean") {
      if (typeof raw[key] !== "boolean") throw Error("invalid_event_properties");
      out[key] = raw[key];
    } else {
      if (typeof raw[key] !== "string" || raw[key].length > 64) throw Error("invalid_event_properties");
      const clean = text(raw[key], 64);
      if (!clean) throw Error("invalid_event_properties");
      out[key] = clean;
    }
  }
  if (JSON.stringify(out).length > 500) throw Error("invalid_event_properties");
  return out;
}

export function parseWebSessionInput(value: unknown): WebSessionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_input");
  const input = record(value);
  const action = input.action;
  if (action !== "create" && action !== "event" && action !== "heartbeat") throw Error("invalid_action");
  if (Object.keys(input).some(key => !ALLOWED_KEYS[action].includes(key))) throw Error("invalid_input");

  if (action === "create") {
    const consentValue = consent(input.consent);
    return {
      action,
      attribution: attribution(input.attribution),
      ...pixels(input.attribution, consentValue),
      consent: consentValue,
      current_path: path(input.current_path),
      current_stage: text(input.current_stage, 64),
    };
  }

  if (action === "event") {
    const name = input.event_name;
    if (typeof name !== "string") throw Error("invalid_event_name");
    if (name === "lead_created") throw Error("server_event_only");
    if (!(CLIENT_EVENTS as readonly string[]).includes(name)) throw Error("invalid_event_name");
    const eventId = input.event_id;
    if (typeof eventId !== "string" || !UUID_PATTERN.test(eventId)) throw Error("invalid_event_id");
    return {
      action,
      event_name: name as ClientEvent,
      event_id: eventId.toLowerCase(),
      stage: text(input.stage, 64),
      path: path(input.path),
      properties: properties(name as ClientEvent, input.properties),
    };
  }

  return {
    action,
    current_path: path(input.current_path),
    current_stage: text(input.current_stage, 64),
    consent: consent(input.consent),
  };
}
