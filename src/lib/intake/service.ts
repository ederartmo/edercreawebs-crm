import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureAttribution, evaluateIntakeReadiness, mergeIntakeData, normalizeIntakeData, record, type Attribution, type IntakeData } from "./domain";
import { createContinuationCode, createSessionToken, hashToken } from "./tokens";

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
export async function createIntakeSession(attribution: Attribution) {
  const { db, owner } = context();
  const token = createSessionToken();
  checked(await db.rpc("intake_create_session", { p_owner: owner, p_hash: hashToken(token), p_attribution: captureAttribution({ source: "direct", ...attribution, entry_channel: "web" }) }));
  return { token, ...evaluateIntakeReadiness({}) };
}
export async function getIntakeSession(token: string) {
  const { db, owner } = context();
  for (let attempt = 0; attempt < 4; attempt++) {
    const session = checked(await db.from("intake_sessions").select("answers,first_touch,updated_at,expires_at,lead_id,materialized_at").eq("owner_id", owner).eq("token_hash", hashToken(token)).single());
    if (!session || Date.parse(session.expires_at) <= Date.now()) throw Error("session_unavailable");
    // Return only a receipt, never CRM facts or internal IDs, after linking.
    if (session.lead_id) return session.materialized_at
      ? { linked: true as const, ready_for_quote: true, completion_percent: 100, missing_fields: [], intake_version: 1 }
      : { linked: true as const };
    const readiness = evaluateIntakeReadiness(normalizeIntakeData(session.answers));
    if (!readiness.ready_for_quote) return { linked: false as const, ...readiness, first_touch: session.first_touch, updated_at: session.updated_at };
    // Also reconciles a prior save whose response/finalization was interrupted.
    // SQL locks the session and compares this evaluated snapshot before any INSERT.
    checked(await db.rpc("intake_materialize_session", {
      p_owner: owner, p_hash: hashToken(token), p_expected_answers: session.answers,
      p_summary: JSON.stringify({ ...readiness, first_touch: session.first_touch }),
    }));
  }
  throw Error("intake_session_changed_retry");
}
export async function saveSessionAnswer(token: string, answers: IntakeData) {
  const { db, owner } = context();
  checked(await db.rpc("intake_save_session", { p_owner: owner, p_hash: hashToken(token), p_answers: normalizeIntakeData(answers) }));
  return getIntakeSession(token);
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
