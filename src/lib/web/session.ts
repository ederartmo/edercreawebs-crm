import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEventId, createSessionToken, hashToken } from "@/lib/intake/tokens";
import type { WebSessionInput } from "@/lib/web/parse";

type CreateInput = Extract<WebSessionInput, { action: "create" }>;
type EventInput = Extract<WebSessionInput, { action: "event" }>;
type HeartbeatInput = Extract<WebSessionInput, { action: "heartbeat" }>;
type SessionRow = { id: string; reference_code: string; status: string; last_seen_at: string; ended_at: string | null };
const SESSION_COLUMNS = "id,reference_code,status,last_seen_at,ended_at";
/** One row = one visit: a session is only reused while it is not ended and has been seen in the last 30 minutes. */
const REUSE_WINDOW_MS = 30 * 60_000;
/** Server-side only: the browser never picks the owner, the session id or the token hash. */
function context() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") !== "https://ycdosrsanutbhbgejwwg.supabase.co") throw Error("web_project_mismatch");
  const owner = process.env.CRM_OWNER_ID?.trim();
  if (!owner) throw Error("web_owner_missing");
  return { db: createAdminClient(), owner };
}
function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw Error("web_session_storage_failed");
  return result.data;
}
async function loadSession(db: ReturnType<typeof createAdminClient>, owner: string, hash: string) {
  return checked(await db.from("web_sessions").select(SESSION_COLUMNS).eq("owner_id", owner).eq("token_hash", hash).maybeSingle()) as SessionRow | null;
}
function consentPatch(consentValue: CreateInput["consent"] | HeartbeatInput["consent"]) {
  if (!consentValue) return {};
  return { consent_analytics: consentValue.analytics, consent_marketing: consentValue.marketing };
}

/** The current visit: not ended and idle for less than the reuse window. */
function reusable(row: SessionRow, now: number) {
  if (row.status === "ended") return false;
  const lastSeen = new Date(row.last_seen_at).getTime();
  return Number.isFinite(lastSeen) && now - lastSeen < REUSE_WINDOW_MS;
}

/**
 * Historical close of a row that will not be reused, taken right before opening a new visit.
 * Best-effort on purpose: a failed close never blocks the new session, and lead_id/converted_at
 * are never touched, so the previous visit keeps its history.
 */
async function closeAbandonedSession(db: ReturnType<typeof createAdminClient>, owner: string, hash: string, row: SessionRow) {
  if (row.status === "ended") return;
  try {
    const lastSeen = new Date(row.last_seen_at).getTime();
    checked(await db.from("web_sessions").update({
      status: "ended",
      ended_at: row.ended_at ?? new Date(Number.isFinite(lastSeen) ? lastSeen : Date.now()).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("owner_id", owner).eq("token_hash", hash));
  } catch { /* a failed historical close must not prevent the new visit */ }
}

/**
 * Whether this visit already recorded its server-side start. A reused session must never try to
 * insert it again: that second insert is exactly what the partial unique index rejects with a 409.
 * The index therefore stays as the secondary defense (races only), not the primary mechanism.
 */
async function sessionStartedRecorded(db: ReturnType<typeof createAdminClient>, owner: string, sessionId: string) {
  try {
    const result = await db.from("web_events").select("event_id").eq("owner_id", owner).eq("session_id", sessionId).eq("event_name", "session_started").limit(1);
    if (result.error) return false;
    return Array.isArray(result.data) && result.data.length > 0;
  } catch { return false; }
}

/**
 * Best-effort and idempotent: the partial unique index makes every retry safe (23505 = already
 * recorded). Any other failure is swallowed so the session identity just created or reused keeps
 * working; the next create with the same cookie retries it. No error detail ever reaches the browser.
 */
async function ensureSessionStarted(db: ReturnType<typeof createAdminClient>, owner: string, sessionId: string, occurredAt: string) {
  try {
    const result = await db.from("web_events").insert({
      owner_id: owner,
      session_id: sessionId,
      event_id: createEventId(),
      event_name: "session_started",
      source: "server",
      properties: {},
      occurred_at: occurredAt,
    });
    return !result.error || (result.error as { code?: string }).code === "23505";
  } catch { return false; }
}

export async function createWebSession(input: CreateInput & { token?: string }) {
  const { db, owner } = context();
  const now = Date.now();
  const stamp = new Date(now).toISOString();

  if (input.token) {
    const hash = hashToken(input.token);
    const existing = await loadSession(db, owner, hash);
    // Same visit: reuse the row without touching its status (ended/converted are never resurrected).
    if (existing && reusable(existing, now)) {
      const patch: Record<string, unknown> = { last_seen_at: stamp, updated_at: stamp, ...consentPatch(input.consent) };
      if (input.current_path) patch.current_path = input.current_path;
      if (input.current_stage) patch.current_stage = input.current_stage;
      if (input.fbp) patch.fbp = input.fbp;
      if (input.fbc) patch.fbc = input.fbc;
      checked(await db.from("web_sessions").update(patch).eq("owner_id", owner).eq("token_hash", hash));
      // Same visit again (F5): session_started is only written when it is genuinely missing, so a
      // reload never attempts the duplicate insert; it also repairs one lost earlier.
      if (!(await sessionStartedRecorded(db, owner, existing.id))) await ensureSessionStarted(db, owner, existing.id, stamp);
      return { token: input.token, reference_code: existing.reference_code, status: existing.status, created: false };
    }
    // Ended or idle >= 30 min: keep the row historical and start a brand new visit below.
    if (existing) await closeAbandonedSession(db, owner, hash, existing);
  }

  const token = createSessionToken();
  const attribution = { source: "direct", ...input.attribution, entry_channel: "web" };
  const session = checked(await db.from("web_sessions").insert({
    owner_id: owner,
    token_hash: hashToken(token),
    // reference_code is never written by the application: PostgreSQL fills its ECW- default.
    source: attribution.source,
    entry_channel: attribution.entry_channel,
    landing_path: attribution.landing_path,
    referrer: attribution.referrer,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    fbp: input.fbp,
    fbc: input.fbc,
    consent_analytics: input.consent?.analytics ?? false,
    consent_marketing: input.consent?.marketing ?? false,
    status: "active",
    current_path: input.current_path,
    current_stage: input.current_stage,
    event_count: 0,
    started_at: stamp,
    last_seen_at: stamp,
    created_at: stamp,
    updated_at: stamp,
  }).select(SESSION_COLUMNS).maybeSingle()) as SessionRow | null;
  if (!session) throw Error("web_session_storage_failed");

  await ensureSessionStarted(db, owner, session.id, stamp);
  return { token, reference_code: session.reference_code, status: session.status, created: true };
}

export async function recordWebEvent(token: string, input: EventInput) {
  const { db, owner } = context();
  const session = await loadSession(db, owner, hashToken(token));
  if (!session) throw Error("web_session_unavailable");
  const result = await db.from("web_events").insert({
    owner_id: owner,
    session_id: session.id,
    event_id: input.event_id,
    event_name: input.event_name,
    stage: input.stage,
    path: input.path,
    properties: input.properties,
    source: "client",
    occurred_at: new Date().toISOString(),
  });
  // 23505 means a retried event_id is already recorded: idempotent success, not failure.
  if (result.error && (result.error as { code?: string }).code !== "23505") throw Error("web_session_storage_failed");
  return { ok: true as const };
}

export async function heartbeatWebSession(token: string, input: HeartbeatInput) {
  const { db, owner } = context();
  const hash = hashToken(token), now = Date.now();
  const session = checked(await db.from("web_sessions").select("id,last_seen_at").eq("owner_id", owner).eq("token_hash", hash).maybeSingle()) as { last_seen_at: string } | null;
  if (!session) throw Error("web_session_unavailable");
  const lastSeen = Date.parse(session.last_seen_at);
  // Cheap server-side throttle: liveness already fresh (an event refreshes it too), so write nothing.
  if (Number.isFinite(lastSeen) && lastSeen > now - 10_000) return { ok: true as const };
  checked(await db.from("web_sessions").update({
    last_seen_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    ...(input.current_path ? { current_path: input.current_path } : {}),
    ...(input.current_stage ? { current_stage: input.current_stage } : {}),
    ...consentPatch(input.consent),
  }).eq("owner_id", owner).eq("token_hash", hash));
  return { ok: true as const };
}
