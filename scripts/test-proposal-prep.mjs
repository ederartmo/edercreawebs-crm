// Local-only contract/integration checks. No network, credentials or new framework.
// Run: node --test scripts/test-proposal-prep.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports, env = {}, fetch = async () => { throw Error("Network prohibited"); }) {
  const testModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: testModule, exports: testModule.exports, require: name => {
      if (!(name in imports)) throw Error(`Unexpected import ${name}`);
      return imports[name];
    },
    process: { env }, fetch, URL, AbortController, setTimeout, clearTimeout,
    console: { error() {} },
  });
  return testModule.exports;
}
const copy = value => JSON.parse(JSON.stringify(value));
const fixture = () => ({
  generator: "proposal_prep_v1", project_type: "informativa", business_summary: "Asesoría declarada por el prospecto",
  diagnosis: { current_sales_flow: "WhatsApp", main_friction: "Falta de filtro", main_goal: "Filtrar interesados" },
  solution: { concept: "Filtro de prospectos", why_it_fits: "Reduce consultas repetidas", primary_conversion: "Contacto", supporting_features: ["Formulario"] },
  visual_direction: { style: "Claro y legible", brand_colors: [], brand_assets_available: [], image_direction: ["Elementos abstractos"], mobile_first: true },
  sections: ["Inicio", "Proceso", "Filtro", "Confirmación"].map((title, index) => ({
    position: index + 1, section_type: title.toLowerCase(), title, objective: "Orientar al interesado",
    content: ["Información confirmada"], visual_notes: ["CTA táctil"], primary_cta: "Continuar",
  })),
  missing_information: ["Logo"], assumptions_to_avoid: ["No inventar fotografías"], confidence: 0.8, ready_for_visual_generation: true,
});

function database() {
  const tables = {
    leads: [{ id: "lead", owner_id: "owner", project_type: "por_definir", what_sells: "Asesoría", how_sells: "WhatsApp", status: "activos_recibidos" }],
    assets: [{ id: "source", lead_id: "lead", owner_id: "owner", category: "business_reference", external_url: "https://example.com", metadata: { enrichment_status: "complete", enrichment_profile: { summary: "Asesoría", brand_colors: ["#112233"] } } },
      { id: "pending", lead_id: "lead", owner_id: "owner", category: "business_reference", external_url: "https://example.org", metadata: { enrichment_status: "pending", enrichment_profile: { summary: "UNVERIFIED_SENTINEL", brand_colors: ["red"] } } }],
    messages: [{ id: "m2", lead_id: "lead", owner_id: "owner", direction: "outbound", body: "Gracias", created_at: "2026-01-02" },
      { id: "m1", lead_id: "lead", owner_id: "owner", direction: "inbound", transcription: "Vendo asesoría", created_at: "2026-01-01" }],
    visual_proposals: [], visual_proposal_sections: [], automation_runs: [],
  };
  let sequence = 0;
  const db = { tables, failSections: false, events: [], beforeQuery: async () => {}, afterQuery: async () => {}, from(table) {
    let operation = "read", payload, conflict, shape, sort = [], limit = Infinity;
    const filters = [];
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      is(key, value) { filters.push(row => (row[key] ?? null) === value); return query; },
      not(key, operator, value) {
        assert.equal(operator, "is");
        filters.push(row => (row[key] ?? null) !== value); return query;
      },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      or() { return query; },
      order(key, options = {}) { sort.push([key, options.ascending !== false]); return query; },
      limit(value) { limit = value; return query; },
      single() { shape = "single"; return query; },
      maybeSingle() { shape = "single"; return query; },
      insert(value) { operation = "insert"; payload = value; return query; },
      update(value) { operation = "update"; payload = value; return query; },
      upsert(value, options) { operation = "upsert"; payload = value; conflict = options.onConflict; return query; },
      then(resolve, reject) {
        const event = { table, operation, payload: payload === undefined ? null : copy(payload) };
        return Promise.resolve().then(() => db.beforeQuery(event)).then(() => {
          let rows = tables[table].filter(row => filters.every(filter => filter(row)));
          if (operation === "insert") {
            if (table === "visual_proposals" && tables[table].some(row => row.lead_id === payload.lead_id && row.version === payload.version)) {
              return { data: null, error: { code: "23505" } };
            }
            const row = { ...copy(payload), id: `id${++sequence}` };
            tables[table].push(row); rows = [row];
          } else if (operation === "update") {
            rows.forEach(row => Object.assign(row, copy(payload)));
          } else if (operation === "upsert") {
            assert.equal(conflict, "proposal_id,position");
            if (db.failSections) return { data: null, error: { code: "TEST_FAILURE" } };
            for (const value of payload) {
              const row = tables[table].find(row => row.proposal_id === value.proposal_id && row.position === value.position);
              if (row) Object.assign(row, copy(value));
              else tables[table].push({ ...copy(value), id: `id${++sequence}` });
            }
            rows = payload;
          }
          rows.sort((a, b) => {
            for (const [key, ascending] of sort) {
              if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
          rows = rows.slice(0, limit);
          return { data: copy(shape ? rows[0] ?? null : rows), error: null };
        }).then(async result => {
          event.result = copy(result);
          db.events.push(event);
          await db.afterQuery(event);
          return result;
        }).then(resolve, reject);
      },
    };
    return query;
  } };
  return db;
}

function engine(db = database(), responder = () => fixture()) {
  const requests = [];
  const api = load("src/lib/whatsapp/proposal-prep.ts", { "@/lib/supabase/admin": { createAdminClient: () => db } }, {
    NEXT_PUBLIC_SUPABASE_URL: "https://ycdosrsanutbhbgejwwg.supabase.co", OPENAI_API_KEY: "local-test-placeholder",
  }, async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return { ok: true, json: async () => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(responder()) }] }] }) };
  });
  return { api, db, requests };
}
const args = { leadId: "lead", sourceAssetId: "source" };

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
    }, { OPENAI_API_KEY: "local-test-placeholder" }, async () => ({ ok: true, json: async () => ({ output_text: ++calls === 1 ? "Verified notes" : '{"summary":"Asesoría","brand_colors":[]}' }) }));
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
