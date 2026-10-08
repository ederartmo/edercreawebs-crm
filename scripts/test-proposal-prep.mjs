import { test } from "node:test";
import assert from "node:assert/strict";
import { load, copy, fixture, database, engine } from "./test-helpers/proposal-fixture.mjs";

const args = { leadId: "lead", sourceAssetId: "source" };

test("Prep preserves every protected section and notes; pending without asset remains editable", async () => {
  for (const status of ["generation_reserved", "review_pending", "approved", "generation_unknown", "generation_failed"]) {
    const db = database();
    await engine(db).api.prepareVisualProposalDraft(args);
    const row = db.tables.visual_proposal_sections[0];
    row.status = status; row.asset_id = status === "approved" || status === "review_pending" ? "existing" : null;
    const before = copy(row), notes = db.tables.visual_proposals[0].direction_notes;
    const next = engine(db, () => ({ ...fixture(), business_summary: "Nuevo brief" }));
    const result = await next.api.prepareVisualProposalDraft(args);
    assert.equal(result.status,"protected_sections");
    assert.deepEqual(row,before);
    assert.equal(db.tables.visual_proposals[0].direction_notes,notes);
  }
  const db = database();
  await engine(db).api.prepareVisualProposalDraft(args);
  const next = engine(db, () => ({ ...fixture(), business_summary: "Nuevo brief" }));
  await next.api.prepareVisualProposalDraft(args);
  assert.equal(JSON.parse(db.tables.visual_proposal_sections[0].brief).business_summary,"Nuevo brief");
});

test("regression: reservation after Prep checks cannot be erased by section write", async () => {
  const { api, db } = engine();
  await api.prepareVisualProposalDraft(args);
  let injected = false;
  db.beforeQuery = async event => {
    if (!injected && event.table === "visual_proposal_sections" && event.operation === "update") {
      injected = true;
      db.tables.visual_proposal_sections[0].status = "approved";
      db.tables.visual_proposal_sections[0].asset_id = "concurrent-anchor";
    }
  };
  await assert.rejects(api.prepareVisualProposalDraft(args),/persist_sections/);
  assert.equal(injected,true);
  assert.equal(db.tables.visual_proposal_sections[0].status,"approved");
  assert.equal(db.tables.visual_proposal_sections[0].asset_id,"concurrent-anchor");
});

test("strict schema and runtime reject wrong count, positions, enums, extra pricing keys and amounts", () => {
  const { api } = engine();
  assert.equal(api.PROPOSAL_BRIEF_SCHEMA.properties.sections.minItems, 4);
  assert.equal(api.PROPOSAL_BRIEF_SCHEMA.properties.sections.maxItems, 4);
  assert.deepEqual(copy(api.parseProposalBrief(fixture())), fixture());
  for (const mutate of [
    brief => brief.sections.pop(), brief => brief.sections.push(brief.sections[0]),
    brief => { brief.sections[1].position = 1; }, brief => { brief.sections[0].position = 4; },
    brief => { brief.project_type = "inventado"; }, brief => { brief.price = 100; },
    brief => { brief.solution.concept = "Costo: 1000"; }, brief => { brief.sections[0].content = ["$1,000"]; },
    brief => { brief.visual_direction.mobile_first = false; }, brief => { brief.confidence = 2; },
    brief => { brief.visual_direction.brand_colors = ["red"]; },
  ]) {
    const brief = fixture(); mutate(brief); assert.throws(() => api.parseProposalBrief(brief));
  }
  const colored = fixture(); colored.visual_direction.brand_colors = ["#112233"];
  assert.equal(api.parseProposalBrief(colored, ["#112233"]).visual_direction.brand_colors.length, 1);
});

test("only complete profiles enter model input; messages chronological; no model tools; lead stage unchanged", async () => {
  const { api, db, requests } = engine();
  await api.prepareVisualProposalDraft(args);
  const request = requests[0];
  assert.equal(request.model, "gpt-5.6-sol"); assert.equal(request.text.format.strict, true);
  assert.equal(request.store, false); assert.equal(request.tools, undefined);
  const context = JSON.parse(request.input[0].content);
  assert.deepEqual(context.messages.map(row => row.direction), ["inbound", "outbound"]);
  assert.equal(context.references[1].enrichment_profile, null);
  assert.ok(!request.input[0].content.includes("UNVERIFIED_SENTINEL"));
  for (const status of ["pending", "processing", "failed"]) {
    assert.equal(api.verifiedReference({ id: "a", metadata: { enrichment_status: status, enrichment_profile: { summary: "False" } } }).enrichment_profile, null);
  }
  assert.equal(db.tables.leads[0].status, "activos_recibidos");
  assert.deepEqual(db.tables.automation_runs.map(row => row.status), ["completed"]);
  assert.ok(!JSON.stringify(db.tables.automation_runs).includes("Vendo asesoría"));
});

test("retries reuse generated draft; four sections upsert; persisted JSON parses", async () => {
  const { api, db } = engine();
  const first = await api.prepareVisualProposalDraft(args);
  const second = await api.prepareVisualProposalDraft(args);
  assert.equal(first.proposal_id, second.proposal_id); assert.equal(second.reused, true);
  assert.equal(db.tables.visual_proposals.length, 1); assert.equal(db.tables.visual_proposal_sections.length, 4);
  assert.deepEqual(db.tables.visual_proposal_sections.map(row => row.position), [1, 2, 3, 4]);
  assert.deepEqual(JSON.parse(db.tables.visual_proposals[0].direction_notes), fixture());
  db.tables.visual_proposal_sections.forEach(row => {
    const brief = JSON.parse(row.brief);
    assert.equal(brief.section.position, row.position); assert.equal(brief.generator, "proposal_prep_v1");
    const expected = fixture();
    assert.deepEqual(brief.section, expected.sections[row.position - 1]);
    for (const key of ["project_type", "business_summary", "diagnosis", "solution", "visual_direction", "missing_information", "assumptions_to_avoid", "confidence", "ready_for_visual_generation"]) {
      assert.deepEqual(brief[key], expected[key], `Standalone section must retain ${key}`);
    }
    assert.equal(brief.messages, undefined); assert.equal(brief.conversation, undefined);
    assert.ok(!row.brief.includes("Vendo asesoría"));
    assert.equal(row.status, "pending"); assert.equal(row.asset_id, null);
  });
});

test("approved/sent/foreign proposals get a new version; latest approved is not bypassed by an old draft", async () => {
  for (const variant of [ { status: "approved" }, { status: "sent" }, { approved_at: "today" }, { sent_at: "today" }, { direction_notes: "Manual notes" }, { direction_notes: '{"generator":"another"}' } ]) {
    const { api, db } = engine();
    db.tables.visual_proposals.push({ id: "old", lead_id: "lead", owner_id: "owner", version: 3, status: "draft", direction_notes: JSON.stringify(fixture()), ...variant });
    const old = copy(db.tables.visual_proposals[0]);
    const result = await api.prepareVisualProposalDraft(args);
    assert.equal(result.version, 4); assert.equal(result.reused, false);
    assert.deepEqual(db.tables.visual_proposals[0], old);
  }
  const { api } = engine();
  assert.equal(api.selectProposalTarget([
    { id: "older", version: 1, status: "draft", direction_notes: JSON.stringify(fixture()) },
    { id: "newer", version: 2, status: "approved" },
  ]).version, 3);
});

test("unique-version insert race rereads and reuses winning draft", async () => {
  const db = database();
  const runA = engine(db);
  const runB = engine(db, () => ({ ...fixture(), business_summary: "Segundo brief del mismo negocio" }));
  let releaseInserts, winnerCompleted;
  const bothReady = new Promise(resolve => { releaseInserts = resolve; });
  const winnerFinished = new Promise(resolve => { winnerCompleted = resolve; });
  let insertAttempts = 0;
  db.beforeQuery = async event => {
    if (event.table !== "visual_proposals" || event.operation !== "insert") return;
    // Both runs read an empty table and select version 1 before either INSERT.
    assert.equal(event.payload.version, 1);
    if (++insertAttempts === 2) releaseInserts();
    await bothReady;
  };
  db.afterQuery = async event => {
    if (event.table === "automation_runs" && event.payload?.status === "completed") winnerCompleted();
    // Deliver the losing INSERT response after the winner's sections are saved.
    // This isolates version allocation from the separately documented CAS race.
    if (event.result.error?.code === "23505") await winnerFinished;
  };
  const results = await Promise.all([
    runA.api.prepareVisualProposalDraft(args), runB.api.prepareVisualProposalDraft(args),
  ]);
  assert.equal(insertAttempts, 2);
  const events = db.events.filter(event => event.table === "visual_proposals");
  assert.deepEqual(events.filter(event => event.operation === "read").slice(0, 2).map(event => event.result.data), [[], []]);
  const conflictIndex = events.findIndex(event => event.result.error?.code === "23505");
  assert.ok(conflictIndex >= 0);
  assert.ok(events.slice(conflictIndex + 1).some(event => event.operation === "read"
    && Array.isArray(event.result.data) && event.result.data[0]?.version === 1));
  assert.ok(events.some(event => event.operation === "update" && event.result.data?.version === 1));
  assert.equal(results[0].proposal_id, results[1].proposal_id);
  assert.deepEqual(results.map(result => result.version), [1, 1]);
  assert.deepEqual(results.map(result => result.reused).sort(), [false, true]);
  assert.deepEqual(db.tables.automation_runs.map(run => run.status), ["completed", "completed"]);
  assert.equal(db.tables.visual_proposals.length, 1); assert.equal(db.tables.visual_proposal_sections.length, 4);
});

test("partial section failure records safe failure and retry repairs same draft", async () => {
  const { api, db } = engine(); db.failSections = true;
  await assert.rejects(api.prepareVisualProposalDraft(args), /persist_sections/);
  assert.equal(db.tables.automation_runs[0].status, "failed");
  assert.equal(db.tables.automation_runs[0].error, "proposal_prep_failed:persist_sections");
  db.failSections = false;
  const result = await api.prepareVisualProposalDraft(args);
  assert.equal(result.reused, true); assert.equal(db.tables.visual_proposals.length, 1);
  assert.equal(db.tables.visual_proposal_sections.length, 4);
});

test("incomplete enrichment/context cannot prepare a draft", async () => {
  for (const mutate of [
    db => { db.tables.assets[0].metadata.enrichment_status = "pending"; },
    db => { db.tables.leads[0].how_sells = ""; },
    db => { db.tables.messages = []; },
  ]) {
    const { api, db, requests } = engine(); mutate(db);
    await assert.rejects(api.prepareVisualProposalDraft(args));
    assert.equal(requests.length, 0); assert.equal(db.tables.visual_proposals.length, 0);
    assert.equal(db.tables.automation_runs[0].status, "failed");
  }
});

test("fresh and already-complete enrichment keep complete when proposal generation fails", async () => {
  for (const initial of ["pending", "complete"]) {
    const { api, db } = engine(database(), () => { throw Error("Sensitive provider detail"); });
    db.tables.assets[0].metadata.enrichment_status = initial;
    let calls = 0;
    const enrichment = load("src/lib/whatsapp/asset-enrichment.ts", {
      "@/lib/supabase/admin": { createAdminClient: () => db },
      "@/lib/whatsapp/proposal-prep": api,
    }, { OPENAI_API_KEY: "local-test-placeholder", WHATSAPP_PROPOSAL_PREP_ENABLED: "true" }, async () => ({ ok: true, json: async () => ({ output_text: ++calls === 1 ? "Verified notes" : '{"summary":"Asesoría","brand_colors":[]}' }) }));
    const result = await enrichment.enrichBusinessReferenceAsset("source");
    assert.equal(result.ok, true); assert.equal(result.proposalPrep.status, "failed");
    assert.equal(result.proposalPrep.retryable, true);
    assert.equal(db.tables.assets[0].metadata.enrichment_status, "complete");
    assert.equal(db.tables.automation_runs[0].status, "failed");
    assert.ok(!JSON.stringify(db.tables.automation_runs).includes("Sensitive provider detail"));
    const prepStart = db.events.findIndex(event => event.table === "automation_runs" && event.payload?.status === "started");
    assert.ok(prepStart >= 0);
    if (initial === "pending") {
      const completeSave = db.events.findIndex(event => event.table === "assets"
        && event.operation === "update" && event.payload.metadata?.enrichment_status === "complete");
      assert.ok(completeSave >= 0 && completeSave < prepStart);
    }
    assert.ok(!db.events.some(event => event.table === "assets" && event.payload?.metadata?.enrichment_status === "failed"));
    assert.equal(calls, initial === "pending" ? 2 : 0);
  }
});

test("saved Instagram remains in next-turn context while pending/processing; only its profile is hidden", async () => {
  for (const status of ["pending", "processing"]) {
    const db = database(); db.tables.assets = [];
    const scheduled = [], requests = [];
    const agent = load("src/lib/whatsapp/sales-agent.ts", {
      "@/lib/intake/domain": load("src/lib/intake/domain.ts", {}),
      "@/lib/intake/service": { getLeadIntake: async () => load("src/lib/intake/domain.ts", {}).evaluateIntakeReadiness({ what_sells: "Asesor?a", how_sells: "WhatsApp" }, db.tables.assets.length > 0) },
      "next/server": { after: callback => scheduled.push(callback) },
      "@/lib/supabase/admin": { createAdminClient: () => db },
      "@/lib/whatsapp/asset-enrichment": { enrichBusinessReferenceAsset: async () => { throw Error("Background must not run in this test"); } },
    }, { OPENAI_API_KEY: "local-test-placeholder" }, async (_url, options) => {
      const request = JSON.parse(options.body); requests.push(request);
      return { ok: true, json: async () => requests.length === 1 ? {
        output: [{ type: "function_call", call_id: "save-instagram", name: "save_asset_reference",
          arguments: JSON.stringify({ reference: "@negocio_prueba", asset_type: "instagram" }) }],
      } : { output_text: "Gracias por la información." } };
    });
    const lead = { leadId: "lead", whatSells: "Asesoría", howSells: "WhatsApp" };
    await agent.runWhatsAppSalesAgent({ lead, messages: [{ role: "user", content: "Mi Instagram es @negocio_prueba" }] });
    assert.equal(db.tables.assets.length, 1); assert.equal(scheduled.length, 1);
    assert.equal(db.tables.assets[0].metadata.enrichment_status, "pending");
    const toolResult = requests[1].input.find(item => item.type === "function_call_output");
    assert.equal(JSON.parse(toolResult.output).ok, true);
    db.tables.assets[0].metadata.enrichment_status = status;
    db.tables.assets[0].metadata.enrichment_profile = { summary: "UNVERIFIED_SENTINEL" };
    // No reference in this turn's supplied messages: persistence must supply it.
    await agent.runWhatsAppSalesAgent({ lead, messages: [{ role: "user", content: "También quiero filtrar las consultas." }] });
    const next = requests[2];
    const context = next.input.find(item => item.role === "developer").content;
    assert.ok(context.includes("instagram: https://www.instagram.com/negocio_prueba/"));
    assert.ok(context.includes(`enrichment=${status}`));
    assert.ok(context.includes("no vuelvas a pedir la misma referencia"));
    assert.ok(next.instructions.includes("NO vuelvas a pedirla"));
    assert.ok(!context.includes("Referencias/activos ya guardados: Ninguno"));
    assert.ok(!context.includes("UNVERIFIED_SENTINEL"));
    assert.ok(!context.includes("profile={"));
  }
});
