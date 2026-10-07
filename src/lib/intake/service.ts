import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureAttribution, evaluateIntakeReadiness, mergeIntakeData, normalizeIntakeData, record, type Attribution, type IntakeData, type IntakeField } from "./domain";
import { createContinuationCode, createEventId, createSessionToken, hashToken } from "./tokens";

function context() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") !== "https://ycdosrsanutbhbgejwwg.supabase.co") throw Error("intake_project_mismatch");
  const owner = process.env.CRM_OWNER_ID?.trim();
  if (!owner) throw Error("intake_owner_missing");
  return { db: createAdminClient(), owner };
}
function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw Error("intake_storage_failed");
  return result.data;
}
export async function getLeadIntake(leadId: string) {
  const { db, owner } = context();
  const lead = checked(await db.from("leads").select("*").eq("id", leadId).eq("owner_id", owner).single());
  const contact = checked(await db.from("contacts").select("full_name,email,phone,business_id").eq("id", lead.contact_id).eq("owner_id", owner).single());
  if (!contact) throw Error("intake_contact_missing");
  const businessId = lead.business_id ?? contact.business_id;
  const business = businessId ? checked(await db.from("businesses").select("*").eq("id", businessId).eq("owner_id", owner).single()) : {};
  const assets = checked(await db.from("assets").select("category,source,external_url,storage_path,mime_type,metadata").eq("lead_id", leadId).eq("owner_id", owner));
  const intake = record(lead.intake);
  const canonical = normalizeIntakeData({
    name: contact.full_name, email: contact.email, whatsapp: contact.phone, business_name: business.name,
    what_sells: lead.what_sells, how_sells: lead.how_sells, currently_selling: lead.currently_selling,
    main_problem: lead.main_problem, main_goal: lead.main_goal,
    timing: lead.likely_start_date, instagram: business.instagram_url, facebook: business.facebook_url,
    tiktok: business.tiktok_url, website: business.website, google_business: business.google_business_url,
  });
  const references = (assets ?? []).filter(asset => asset.category === "business_reference" || (asset.storage_path && asset.mime_type?.startsWith("image/") && !String(asset.source).includes("visual") && !record(asset.metadata).generator));
  const hasReference = references.some(asset => asset.external_url || asset.storage_path);
  const data = mergeIntakeData(canonical, intake.answers);
  const readiness = evaluateIntakeReadiness(data, hasReference);
  return { ...readiness, first_touch: captureAttribution(intake.first_touch), last_referral: captureAttribution(intake.last_referral), updated_at: lead.updated_at, reference_known: hasReference };
}
export async function saveIntakeAnswer(leadId: string, answers: unknown, attribution: Attribution = {}) {
  const { db, owner } = context();
  checked(await db.rpc("intake_apply_lead", { p_owner: owner, p_lead: leadId, p_answers: normalizeIntakeData(answers), p_attribution: captureAttribution(attribution) }));
  return getLeadIntake(leadId);
}
export async function createIntakeSession(attribution: Attribution, webToken?: string) {
  const { db, owner } = context();
  const token = createSessionToken();
  checked(await db.rpc("intake_create_session", { p_owner: owner, p_hash: hashToken(token), p_attribution: captureAttribution({ source: "direct", ...attribution, entry_channel: "web" }) }));
  if (webToken) await linkWebSessionToIntake(webToken, token);
  return { token, ...evaluateIntakeReadiness({}), linked: false as const, materialized: false as const, status: "incomplete" as const };
}

/** Tracking is best-effort: a failed link/convert must never fail or roll back intake itself. */
async function linkWebSessionToIntake(webToken: string, intakeToken: string) {
  try {
    const { db, owner } = context();
    const intake = checked(await db.from("intake_sessions").select("id").eq("owner_id", owner).eq("token_hash", hashToken(intakeToken)).maybeSingle()) as { id: string } | null;
    if (!intake) return;
    const linked = await db.from("web_sessions")
      .update({ intake_session_id: intake.id, updated_at: new Date().toISOString() })
      .eq("owner_id", owner)
      .eq("token_hash", hashToken(webToken));
    if (linked.error) throw Error("intake_storage_failed");
  } catch { /* web tracking stays optional */ }
}

/** Idempotent conversion: one lead_created per session is guaranteed by the database. */
async function markWebSessionConverted(webToken: string, leadId: string) {
  try {
    const { db, owner } = context();
    const hash = hashToken(webToken);
    const web = checked(await db.from("web_sessions").select("id").eq("owner_id", owner).eq("token_hash", hash).maybeSingle()) as { id: string } | null;
    if (!web) return;
    const linked = await db.from("web_sessions")
      .update({ lead_id: leadId, status: "converted", converted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("owner_id", owner)
      .eq("token_hash", hash);
    if (linked.error) return;
    await db.from("web_events").insert({
      owner_id: owner,
      session_id: web.id,
      event_id: createEventId(),
      event_name: "lead_created",
      source: "server",
      properties: {},
      occurred_at: new Date().toISOString(),
    });
  } catch { /* the lead is already materialized; tracking can be repaired by a retry */ }
}
type WebIntakeSessionRow = {
  answers: unknown;
  first_touch: Attribution;
  updated_at: string;
  expires_at: string;
  lead_id: string | null;
  materialized_at: string | null;
};

async function loadWebIntakeSession(db: ReturnType<typeof createAdminClient>, owner: string, token: string) {
  const session = checked(await db.from("intake_sessions").select("answers,first_touch,updated_at,expires_at,lead_id,materialized_at").eq("owner_id", owner).eq("token_hash", hashToken(token)).single()) as WebIntakeSessionRow | null;
  if (!session || Date.parse(session.expires_at) <= Date.now()) throw Error("session_unavailable");
  return session;
}

function materializedSessionReceipt() {
  return { linked: true as const, materialized: true as const, status: "materialized" as const, ready_for_quote: true, completion_percent: 100, missing_fields: [], intake_version: 1 as const };
}

function linkedSessionState() {
  return { linked: true as const, materialized: false as const, status: "linked" as const, ready_for_quote: false, completion_percent: 0, missing_fields: [] as string[], intake_version: 1 as const };
}

function stateFromWebSession(session: WebIntakeSessionRow) {
  if (session.lead_id) return session.materialized_at ? materializedSessionReceipt() : linkedSessionState();
  const readiness = evaluateIntakeReadiness(normalizeIntakeData(session.answers));
  return {
    ...readiness,
    linked: false as const,
    materialized: false as const,
    status: readiness.ready_for_quote ? "complete" as const : "incomplete" as const,
    first_touch: session.first_touch,
    updated_at: session.updated_at,
  };
}

export async function getIntakeSession(token: string) {
  const { db, owner } = context();
  const session = await loadWebIntakeSession(db, owner, token);
  return stateFromWebSession(session);
}

export async function finalizeIntakeSession(token: string, webToken?: string) {
  const { db, owner } = context();
  // Re-links on every finalize: covers sessions created before this feature and missed creates.
  if (webToken) await linkWebSessionToIntake(webToken, token);
  for (let attempt = 0; attempt < 4; attempt++) {
    const session = await loadWebIntakeSession(db, owner, token);
    if (session.lead_id) {
      // Repair path: retries can still record a conversion whose tracking write failed earlier.
      if (webToken) await markWebSessionConverted(webToken, session.lead_id);
      return session.materialized_at ? materializedSessionReceipt() : linkedSessionState();
    }

    const readiness = evaluateIntakeReadiness(normalizeIntakeData(session.answers));
    if (!readiness.ready_for_quote) {
      return {
        ...readiness,
        linked: false as const,
        materialized: false as const,
        status: "incomplete" as const,
        first_touch: session.first_touch,
        updated_at: session.updated_at,
      };
    }

    const leadId = checked(await db.rpc("intake_materialize_session", {
      p_owner: owner,
      p_hash: hashToken(token),
      p_expected_answers: session.answers,
      p_summary: JSON.stringify({ ...readiness, first_touch: session.first_touch }),
    })) as string | null;
    if (!leadId) continue;
    if (webToken) await markWebSessionConverted(webToken, leadId);

    const result = await getIntakeSession(token);
    if (result.materialized) return result;
    if (result.linked) return result;
  }
  throw Error("intake_session_changed_retry");
}
export async function saveSessionAnswer(token: string, answers: IntakeData) {
  const { db, owner } = context();
  checked(await db.rpc("intake_save_session", { p_owner: owner, p_hash: hashToken(token), p_answers: normalizeIntakeData(answers) }));
  return getIntakeSession(token);
}
export async function editSessionAnswer(token: string, field: IntakeField, value: string | boolean) {
  const normalized = normalizeIntakeData({ [field]: value });
  const clear = typeof value === "string" && value.trim() === "";
  if (!clear && !(field in normalized)) throw Error("invalid_intake_edit");

  const { db, owner } = context();
  for (let attempt = 0; attempt < 4; attempt++) {
    const session = await loadWebIntakeSession(db, owner, token);
    if (session.lead_id || session.materialized_at) throw Error("intake_session_materialized");

    const nextAnswers = { ...record(session.answers) };
    if (clear) delete nextAnswers[field];
    else nextAnswers[field] = normalized[field] as string | boolean;

    // Compare-and-swap on the full staging snapshot. A concurrent save/finalize
    // either wins first (causing a retry) or observes this complete field edit.
    const updated = checked(await db.from("intake_sessions")
      .update({ answers: nextAnswers, updated_at: new Date().toISOString() })
      .eq("owner_id", owner)
      .eq("token_hash", hashToken(token))
      .is("lead_id", null)
      .is("materialized_at", null)
      .filter("answers", "eq", JSON.stringify(session.answers))
      .select("id")
      .maybeSingle());
    if (updated) return getIntakeSession(token);
  }
  throw Error("intake_session_changed_retry");
}
export async function issueContinuation(token: string) {
  await getIntakeSession(token);
  const { db, owner } = context();
  const code = createContinuationCode();
  checked(await db.rpc("intake_issue_continuation", { p_owner: owner, p_hash: hashToken(token), p_code_hash: hashToken(code) }));
  return { message: `Hola, quiero continuar mi proyecto. ${code}`, expires_in: 86400 };
}
export async function resolveIntakeContinuation(code: string, verifiedPhone: string): Promise<string | null> {
  const { db, owner } = context();
  return checked(await db.rpc("intake_resolve_continuation", { p_owner: owner, p_hash: hashToken(code), p_phone: verifiedPhone }));
}
export async function claimIntakeSession(code: string, leadId: string, verifiedPhone: string) {
  const { db, owner } = context();
  return checked(await db.rpc("intake_claim_session", { p_owner: owner, p_hash: hashToken(code), p_lead: leadId, p_phone: verifiedPhone }));
}
export async function handoffReadyIntake(leadId: string, conversationId: string) {
  const state = await getLeadIntake(leadId);
  if (!state.ready_for_quote) throw Error("intake_not_ready");
  const { db, owner } = context();
  checked(await db.rpc("intake_handoff", { p_owner: owner, p_lead: leadId, p_conversation: conversationId, p_summary: JSON.stringify(state) }));
}
