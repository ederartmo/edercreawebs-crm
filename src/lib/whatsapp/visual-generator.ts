import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseProposalBrief, proposalSectionRows } from "./proposal-prep";
import { buildVisualSpec, buildVisualPrompt, parseVisualEnvelope, record, verifiedColors, verifiedImageReference,
  STORAGE_BUCKET, VISUAL_GENERATOR, type VisualAsset, type VisualEnvelope } from "./visual-direction";
import { generateScreenImage, assertImageProviderConfigured, assertMobilePng, ImageProviderFailure,
  IMAGE_MODEL, type ImageInput, type ImageResult } from "./visual-image-provider";

type DB = ReturnType<typeof createAdminClient>;
type Proposal = { id: string; owner_id: string; lead_id: string; status: string; direction_notes: string; approved_at: string | null; sent_at: string | null };
type Section = { id: string; proposal_id: string; position: number; status: string; asset_id: string | null; brief: string };
type Attempt = { id: string; run_id: string; reserved_at: string; model: string; spec_hash: string;
  previous_asset_id: string | null; input_asset_ids: string[]; reason: string | null };
type Result = { proposal_id: string; position: number; status: string; asset_id: string | null; new_paid_generation: boolean };
type Dependencies = { db: DB; ownerId: string; preflight: () => void;
  generate: (args: { prompt: string; inputs: ImageInput[] }) => Promise<ImageResult> };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const result = (s: Section, paid = false): Result => ({ proposal_id: s.proposal_id, position: s.position,
  status: s.status, asset_id: s.asset_id, new_paid_generation: paid });
const assetPath = (p: Proposal, position: number, id: string) => `${p.owner_id}/${p.lead_id}/visual/${p.id}/${position}/${id}.png`;
function reasonText(reason: string) {
  if (typeof reason !== "string" || !reason.trim() || reason.length > 500) throw new Error("visual_reason_required");
  return reason.trim();
}

// Internal server API only. No webhook/tool route exposes paid generation or approval.
// The production wrapper scopes all access to CRM_OWNER_ID; future routes must authenticate Eder.
export function createVisualGenerator(deps: Dependencies) {
  const db = deps.db;
  async function proposal(id: string): Promise<Proposal> {
    const row = await db.from("visual_proposals").select("*").eq("id", id).eq("owner_id", deps.ownerId).single();
    if (row.error || !row.data) throw new Error("visual_proposal_unavailable");
    if (row.data.sent_at || row.data.approved_at || ["sent", "approved"].includes(row.data.status)) throw new Error("visual_proposal_finalized");
    return row.data as Proposal;
  }
  async function sections(id: string): Promise<Section[]> {
    const rows = await db.from("visual_proposal_sections").select("*").eq("proposal_id", id).order("position");
    if (rows.error || JSON.stringify(rows.data?.map(r => r.position)) !== "[1,2,3,4]") throw new Error("visual_four_sections_required");
    return rows.data as Section[];
  }
  async function assets(p: Proposal): Promise<VisualAsset[]> {
    const rows = await db.from("assets").select("*").eq("owner_id", p.owner_id).eq("lead_id", p.lead_id);
    if (rows.error) throw new Error("visual_assets_unavailable");
    return rows.data as VisualAsset[];
  }
  async function logStart(p: Proposal, action: string, input: Record<string, unknown>) {
    const run = await db.from("automation_runs").insert({ owner_id: p.owner_id, lead_id: p.lead_id,
      workflow_name: "visual-generator-v1", status: "started", input: { proposal_id: p.id, action, ...input } }).select("id").single();
    if (run.error || !run.data) throw new Error("visual_audit_unavailable");
    return run.data.id as string;
  }
  async function logEnd(id: string, output: Record<string, unknown>, failed = false) {
    const saved = await db.from("automation_runs").update({ status: failed ? "failed" : "completed", output,
      error: failed ? "visual_generation_incomplete" : null, finished_at: new Date().toISOString() }).eq("id", id);
    if (saved.error) console.error("Visual automation completion could not be recorded");
  }
  async function freeze(p: Proposal): Promise<{ p: Proposal; envelope: VisualEnvelope }> {
    if (p.status === "visual_in_progress") {
      const envelope = parseVisualEnvelope(p.direction_notes);
      if (envelope.visual_spec.proposal_id !== p.id) throw new Error("visual_spec_identity_mismatch");
      return { p, envelope };
    }
    if (p.status !== "draft") throw new Error("visual_proposal_busy");
    const available = await assets(p);
    const brief = parseProposalBrief(JSON.parse(p.direction_notes), verifiedColors(available));
    if (!brief.ready_for_visual_generation) throw new Error("visual_brief_not_ready");
    const rows = await sections(p.id), expected = proposalSectionRows(p.id, brief);
    if (rows.some((s, i) => s.status !== "pending" || s.asset_id || s.brief !== expected[i].brief)) throw new Error("visual_prep_inconsistent");
    const spec = buildVisualSpec(p.id, brief, available);
    const envelope: VisualEnvelope = { generator: VISUAL_GENERATOR, schema_version: 1, proposal_brief: brief, visual_spec: spec };
    // Same row and status predicate used by Prep's preparing reservation.
    const saved = await db.from("visual_proposals").update({ status: "visual_in_progress", direction_notes: JSON.stringify(envelope) })
      .eq("id", p.id).eq("owner_id", p.owner_id).eq("status", "draft").eq("direction_notes", p.direction_notes)
      .is("approved_at", null).is("sent_at", null).select("*").maybeSingle();
    if (saved.error) throw new Error("visual_freeze_failed");
    if (!saved.data) {
      const latest = await proposal(p.id);
      if (latest.status !== "visual_in_progress") throw new Error("visual_proposal_busy");
      return freeze(latest);
    }
    return { p: saved.data as Proposal, envelope };
  }
  async function storedBytes(asset: VisualAsset) {
    if (asset.storage_bucket !== STORAGE_BUCKET || !asset.storage_path?.startsWith(`${asset.owner_id}/${asset.lead_id}/`)
      || asset.storage_path.split("/").some(p => [".", "..", ""].includes(p))) throw new Error("visual_storage_identity");
    const file = await db.storage.from(STORAGE_BUCKET).download(asset.storage_path);
    if (file.error || !file.data || file.data.size > 20 * 1024 * 1024) throw new Error("visual_file_unavailable");
    return new Uint8Array(await file.data.arrayBuffer());
  }
  async function generatedAsset(p: Proposal, s: Section, envelope: VisualEnvelope) {
    if (!s.asset_id) throw new Error("visual_asset_required");
    const row = await db.from("assets").select("*").eq("id", s.asset_id).eq("owner_id", p.owner_id).eq("lead_id", p.lead_id).single();
    const asset = row.data as VisualAsset | null, meta = record(asset?.metadata);
    if (row.error || !asset || asset.source !== VISUAL_GENERATOR || asset.mime_type !== "image/png"
      || meta.generation_status !== "complete" || meta.proposal_id !== p.id || meta.position !== s.position
      || meta.spec_hash !== hash(envelope.visual_spec)) throw new Error("visual_asset_invalid");
    const bytes = await storedBytes(asset); assertMobilePng(bytes);
    return { asset, bytes };
  }
  function conditional(s: Section, payload: Record<string, unknown>) {
    const query = db.from("visual_proposal_sections").update(payload).eq("id", s.id)
      .eq("status", s.status).eq("brief", s.brief);
    return (s.asset_id ? query.eq("asset_id", s.asset_id) : query.is("asset_id", null)).select("*").maybeSingle();
  }
  async function inputsFor(p: Proposal, s: Section, envelope: VisualEnvelope): Promise<ImageInput[]> {
    const inputs: ImageInput[] = [];
    if (s.position > 1) {
      const anchor = (await sections(p.id))[0];
      if (anchor.status !== "approved") throw new Error("visual_anchor_approval_required");
      const file = await generatedAsset(p, anchor, envelope);
      inputs.push({ asset_id: file.asset.id, role: "approved_anchor_style_reference", mime_type: "image/png", bytes: file.bytes });
    }
    const available = await assets(p);
    for (const ref of envelope.visual_spec.imagery.asset_references.filter(r => r.positions.includes(s.position)).slice(0, 4)) {
      const asset = available.find(a => a.id === ref.asset_id), verified = asset && verifiedImageReference(asset);
      if (!asset || !verified || verified.role !== ref.role || !verified.positions.includes(s.position)) throw new Error("visual_input_verification_changed");
      const bytes = await storedBytes(asset);
      const b = Buffer.from(bytes), signature = b.subarray(0, 12);
      const valid = asset.mime_type === "image/png" ? signature.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
        : asset.mime_type === "image/jpeg" ? b[0] === 255 && b[1] === 216 && b[2] === 255
          : signature.subarray(0, 4).toString() === "RIFF" && signature.subarray(8, 12).toString() === "WEBP";
      if (!valid || bytes.length > 10 * 1024 * 1024) throw new Error("visual_input_invalid");
      inputs.push({ asset_id: asset.id, role: `verified_${ref.role}`, bytes, mime_type: asset.mime_type! });
    }
    return inputs;
  }
  async function insertGeneratedAsset(p: Proposal, s: Section, attempt: Attempt, bytes: Uint8Array, requestId: string | null) {
    const path = assetPath(p, s.position, attempt.id);
    const inserted = await db.from("assets").insert({ id: attempt.id, owner_id: p.owner_id, lead_id: p.lead_id,
      category: "image", source: VISUAL_GENERATOR, mime_type: "image/png", size_bytes: bytes.length,
      original_filename: `mobile-screen-${s.position}.png`, storage_bucket: STORAGE_BUCKET, storage_path: path,
      is_client_facing: false, metadata: { generator: VISUAL_GENERATOR, generation_status: "complete", proposal_id: p.id,
        position: s.position, attempt_id: attempt.id, spec_hash: attempt.spec_hash, model: attempt.model,
        provider: "openai", request_id: requestId, input_asset_ids: attempt.input_asset_ids, imagery_origin: "generated_composition",
        previous_asset_id: attempt.previous_asset_id } }).select("id").single();
    if (inserted.error || !inserted.data) throw new Error("visual_asset_insert_failed");
    return inserted.data.id as string;
  }
  async function persistAsset(p: Proposal, s: Section, attempt: Attempt, bytes: Uint8Array, requestId: string | null) {
    assertMobilePng(bytes);
    const path = assetPath(p, s.position, attempt.id);
    const uploaded = await db.storage.from(STORAGE_BUCKET).upload(path, bytes, { contentType: "image/png", upsert: false });
    if (uploaded.error) throw new Error("visual_upload_failed");
    return insertGeneratedAsset(p, s, attempt, bytes, requestId);
  }

  async function generate(args: { proposalId: string; position: number; reason?: string; explicit?: boolean }): Promise<Result> {
    if (![1, 2, 3, 4].includes(args.position)) throw new Error("visual_position_invalid");
    const initial = await proposal(args.proposalId);
    if (initial.status === "preparing") return { proposal_id: initial.id, position: args.position, status: "busy", asset_id: null, new_paid_generation: false };
    // Require approval before freezing direction or reserving a downstream screen.
    if (args.position > 1 && (await sections(initial.id))[0].status !== "approved") throw new Error("visual_anchor_approval_required");
    const { p, envelope } = await freeze(initial);
    const s = (await sections(p.id))[args.position - 1];
    if (!args.explicit && s.status !== "pending") {
      if (["review_pending", "approved", "generated"].includes(s.status)) await generatedAsset(p, s, envelope);
      return result(s);
    }
    if (args.explicit && !["review_pending", "generation_failed", "generation_unknown"].includes(s.status)) throw new Error("visual_regeneration_state_blocked");
    if (!args.explicit && s.asset_id) throw new Error("visual_pending_asset_conflict");
    // Approved anchors are immutable in V1, so approval cannot race regeneration
    // while screens 2–4 inherit it. A different approved direction needs a new proposal.
    if (s.status === "approved") throw new Error("visual_approved_immutable");
    const reason = args.explicit ? reasonText(args.reason ?? "") : null;
    deps.preflight(); // Missing config never reserves a paid job.
    const data = JSON.parse(s.brief);
    if (JSON.stringify(data.section) !== JSON.stringify(envelope.proposal_brief.sections[s.position - 1])) throw new Error("visual_section_brief_mismatch");
    const inputs = await inputsFor(p, s, envelope);
    const prompt = buildVisualPrompt(envelope.visual_spec, data.section, inputs.map(i => ({ asset_id: i.asset_id, role: i.role })));
    if (prompt.length > 32000) throw new Error("visual_prompt_limit");
    const runId = await logStart(p, args.explicit ? "explicit_regeneration" : "generate", { position: s.position,
      model: IMAGE_MODEL, provider: "openai", input_asset_ids: inputs.map(i => i.asset_id), new_paid_generation_requested: true,
      reason_present: !!reason, reason_hash: reason ? hash(reason) : null });
    // Raw feedback can contain secrets: retain its digest, not arbitrary user text.
    const attempt: Attempt = { id: randomUUID(), run_id: runId, reserved_at: new Date().toISOString(), model: IMAGE_MODEL,
      spec_hash: hash(envelope.visual_spec), previous_asset_id: s.asset_id, input_asset_ids: inputs.map(i => i.asset_id), reason: reason ? hash(reason) : null };
    const reservedBrief = JSON.stringify({ ...data, visual_attempt: attempt });
    const reserved = await conditional(s, { status: "generation_reserved", brief: reservedBrief });
    if (reserved.error || !reserved.data) {
      await logEnd(runId, { status: "reservation_not_acquired", position: s.position, new_paid_generation: false }, !!reserved.error);
      if (reserved.error) throw new Error("visual_reservation_failed");
      return result((await sections(p.id))[s.position - 1]);
    }
    const owned = reserved.data as Section;
    let invoked = false, requestId: string | null = null;
    try {
      const started = await db.from("automation_runs").update({ output: { status: "request_starting", position: s.position,
        attempt_id: attempt.id, model: IMAGE_MODEL, provider: "openai" } }).eq("id", runId);
      if (started.error) throw new Error("visual_audit_failed_before_request");
      invoked = true;
      const image = await deps.generate({ prompt, inputs }); requestId = image.request_id;
      const assetId = await persistAsset(p, owned, attempt, image.bytes, requestId);
      const attached = await conditional(owned, { asset_id: assetId, status: "review_pending" });
      if (attached.error || !attached.data) throw new Error("visual_attachment_failed");
      await logEnd(runId, { ...result(attached.data as Section, true), attempt_id: attempt.id, provider: "openai", model: IMAGE_MODEL, request_id: requestId });
      return result(attached.data as Section, true);
    } catch (error) {
      const known = !invoked || error instanceof ImageProviderFailure && error.outcome === "known_failure";
      if (error instanceof ImageProviderFailure) requestId = error.requestId;
      const state = known ? "generation_failed" : "generation_unknown";
      // Match reservation INCLUDING its attempt token; a recovered/stale worker cannot attach or overwrite.
      const failed = await conditional(owned, { status: state });
      await logEnd(runId, { position: s.position, status: state, attempt_id: attempt.id, model: IMAGE_MODEL, provider: "openai",
        request_id: requestId, new_paid_generation: invoked, state_persisted: !failed.error && !!failed.data }, true);
      // If DB is unreachable, generation_reserved remains deliberately blocked.
      if (failed.error) throw new Error("visual_outcome_requires_recovery");
      return result(failed.data as Section ?? (await sections(p.id))[s.position - 1], invoked);
    }
  }

  async function approveVisualAnchor(args: { proposalId: string }) {
    const p = await proposal(args.proposalId), envelope = parseVisualEnvelope(p.direction_notes), s = (await sections(p.id))[0];
    if (!["review_pending", "approved"].includes(s.status)) throw new Error("visual_anchor_not_reviewable");
    await generatedAsset(p, s, envelope);
    if (s.status === "approved") return result(s);
    const run = await logStart(p, "approve_anchor", { asset_id: s.asset_id });
    const saved = await conditional(s, { status: "approved" });
    if (saved.error || !saved.data) {
      const latest = (await sections(p.id))[0];
      if (!saved.error && latest.status === "approved" && latest.asset_id === s.asset_id && latest.brief === s.brief) {
        await logEnd(run, { status: "approved", asset_id: s.asset_id, reused: true });
        return result(latest);
      }
      await logEnd(run, { status: "approval_conflict" }, true); throw new Error("visual_approval_conflict");
    }
    await logEnd(run, { status: "approved", asset_id: s.asset_id });
    return result(saved.data as Section);
  }

  async function markVisualGenerationUnknown(args: { proposalId: string; position: number; expectedAttemptId: string; reason: string }) {
    reasonText(args.reason);
    const p = await proposal(args.proposalId), s = (await sections(p.id)).find(s => s.position === args.position);
    if (!s || !["generation_reserved", "generation_unknown"].includes(s.status)) throw new Error("visual_recovery_state_blocked");
    const data = JSON.parse(s.brief);
    if (data.visual_attempt?.id !== args.expectedAttemptId) throw new Error("visual_recovery_attempt_mismatch");
    const run = await logStart(p, "mark_unknown", { position: s.position, attempt_id: args.expectedAttemptId, reason_hash: hash(args.reason) });
    const saved = await conditional(s, { status: "generation_unknown", brief: JSON.stringify({ ...data, recovery_fence: randomUUID() }) });
    await logEnd(run, { status: saved.data ? "generation_unknown" : "recovery_conflict" }, !!saved.error || !saved.data);
    if (saved.error || !saved.data) throw new Error("visual_recovery_conflict");
    return result(saved.data as Section);
  }

  async function recoverStoredVisualScreen(args: { proposalId: string; position: number; expectedAttemptId: string }) {
    const p = await proposal(args.proposalId), envelope = parseVisualEnvelope(p.direction_notes), s = (await sections(p.id)).find(s => s.position === args.position);
    if (!s || s.status !== "generation_unknown") throw new Error("visual_recovery_state_blocked");
    const attempt = JSON.parse(s.brief).visual_attempt as Attempt;
    if (attempt?.id !== args.expectedAttemptId || attempt.spec_hash !== hash(envelope.visual_spec)) throw new Error("visual_recovery_attempt_mismatch");
    if (!/^[0-9a-f-]{36}$/i.test(attempt.id)) throw new Error("visual_recovery_attempt_invalid");
    // Recovery is free, including a crash between byte upload and asset INSERT.
    // A provider-only result cannot be recovered through the direct Images API.
    const existing = await db.from("assets").select("id").eq("id", attempt.id)
      .eq("owner_id", p.owner_id).eq("lead_id", p.lead_id).maybeSingle();
    if (existing.error) throw new Error("visual_recovery_asset_lookup_failed");
    if (!existing.data) {
      const file = await db.storage.from(STORAGE_BUCKET).download(assetPath(p, s.position, attempt.id));
      if (file.error || !file.data || file.data.size > 20 * 1024 * 1024) throw new Error("visual_recovery_no_stored_result");
      const bytes = new Uint8Array(await file.data.arrayBuffer()); assertMobilePng(bytes);
      await insertGeneratedAsset(p, s, attempt, bytes, null);
    }
    await generatedAsset(p, { ...s, asset_id: attempt.id }, envelope);
    const run = await logStart(p, "recover_stored_asset", { position: s.position, attempt_id: attempt.id });
    const saved = await conditional(s, { asset_id: attempt.id, status: "review_pending" });
    await logEnd(run, { status: saved.data ? "review_pending" : "recovery_conflict", asset_id: attempt.id }, !!saved.error || !saved.data);
    if (saved.error || !saved.data) throw new Error("visual_recovery_conflict");
    return result(saved.data as Section);
  }

  return {
    generateVisualAnchor: (args: { proposalId: string }) => generate({ ...args, position: 1 }),
    regenerateVisualAnchor: (args: { proposalId: string; reason: string }) => generate({ ...args, position: 1, explicit: true }),
    regenerateVisualScreen: (args: { proposalId: string; position: number; reason: string }) => generate({ ...args, explicit: true }),
    approveVisualAnchor, markVisualGenerationUnknown, recoverStoredVisualScreen,
    async generateRemainingVisualScreens(args: { proposalId: string; retryFailedReason?: string }) {
      const p = await proposal(args.proposalId);
      if ((await sections(p.id))[0].status !== "approved") throw new Error("visual_anchor_approval_required");
      const results: Result[] = [];
      for (const position of [2, 3, 4]) {
        const failedRetry = args.retryFailedReason !== undefined && (await sections(p.id))[position - 1].status === "generation_failed";
        const screen = await generate({ proposalId: args.proposalId, position,
          explicit: failedRetry, reason: failedRetry ? args.retryFailedReason : undefined }); results.push(screen);
        if (!["review_pending", "approved"].includes(screen.status)) break;
      }
      return results;
    },
  };
}

function productionGenerator() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") !== "https://ycdosrsanutbhbgejwwg.supabase.co") throw new Error("visual_infrastructure_mismatch");
  const ownerId = process.env.CRM_OWNER_ID?.trim();
  if (!ownerId) throw new Error("visual_owner_required");
  return createVisualGenerator({ db: createAdminClient(), ownerId, preflight: assertImageProviderConfigured, generate: generateScreenImage });
}
export const generateVisualAnchor = (args: { proposalId: string }) => productionGenerator().generateVisualAnchor(args);
export const regenerateVisualAnchor = (args: { proposalId: string; reason: string }) => productionGenerator().regenerateVisualAnchor(args);
export const approveVisualAnchor = (args: { proposalId: string }) => productionGenerator().approveVisualAnchor(args);
export const generateRemainingVisualScreens = (args: { proposalId: string; retryFailedReason?: string }) => productionGenerator().generateRemainingVisualScreens(args);
export const regenerateVisualScreen = (args: { proposalId: string; position: number; reason: string }) => productionGenerator().regenerateVisualScreen(args);
export const markVisualGenerationUnknown = (args: { proposalId: string; position: number; expectedAttemptId: string; reason: string }) => productionGenerator().markVisualGenerationUnknown(args);
export const recoverStoredVisualScreen = (args: { proposalId: string; position: number; expectedAttemptId: string }) => productionGenerator().recoverStoredVisualScreen(args);
