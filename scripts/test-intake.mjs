import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { load, database, copy } from "./test-helpers/proposal-fixture.mjs";

const d = load("src/lib/intake/domain.ts", {});
const capi = load("src/lib/meta/capi.ts", { "server-only": {}, "node:crypto": crypto });
const tokens = load("src/lib/intake/tokens.ts", { "node:crypto": crypto });
const web = load("src/lib/intake/web.ts", { "./domain": d });
const complete = { name: "Ana", whatsapp: "525512345678", what_sells: "Muebles", customer_acquisition: "Instagram", how_sells: "Agenda visita y cobra anticipo", main_goal: "Filtrar solicitudes", budget_range: "20k_35k", timing: "Próximo mes", no_digital_presence: true };

test("merge fills gaps, preserves known values and explicit false", () => {
  const merged = d.mergeIntakeData({ name: "Ana", currently_selling: false }, { name: "Otro", currently_selling: true, main_goal: "Crecer", what_sells: " " });
  assert.deepEqual(copy(merged), { name: "Ana", currently_selling: false, main_goal: "Crecer" });
});
test("known fields never missing; completion counts eight requirements", () => {
  const state = d.evaluateIntakeReadiness({ what_sells: "Muebles" });
  assert.equal(state.completion_percent, 13);
  assert.ok(!state.missing_fields.includes("what_sells"));
  assert.equal(d.evaluateIntakeReadiness({}).completion_percent, 0);
  assert.equal(d.evaluateIntakeReadiness(complete).completion_percent, 100);
});
test("ready requires each minimum, not optional contact/business fields", () => {
  assert.equal(d.evaluateIntakeReadiness(complete).ready_for_quote, true);
  for (const field of ["name", "whatsapp", "what_sells", "how_sells", "main_goal", "budget_range", "timing", "no_digital_presence"]) {
    const partial = { ...complete }; delete partial[field];
    assert.equal(d.evaluateIntakeReadiness(partial).ready_for_quote, false, field);
  }
  const noNetwork = { ...complete }; delete noNetwork.no_digital_presence;
  assert.equal(d.evaluateIntakeReadiness(noNetwork, true).ready_for_quote, true);
  assert.equal(d.evaluateIntakeReadiness({ ...complete, no_digital_presence: false }).ready_for_quote, false);
});
test("budget is an enum range, never price; invalid amount is unknown", () => {
  assert.deepEqual(copy(d.normalizeIntakeData({ budget_range: "20k_35k", suggested_price: 25000 })), { budget_range: "20k_35k" });
  assert.equal(d.normalizeIntakeData({ budget_range: "25000" }).budget_range, undefined);
  for (const budget_range of d.BUDGET_RANGES) assert.equal(d.normalizeIntakeData({ budget_range }).budget_range, budget_range);
});
test("attribution normalizes UTMs and freezes whole first-touch", () => {
  const first = d.captureAttribution({ utm_source: " Facebook ", utm_medium: " PAID ", utm_campaign: "Oferta A", landing_path: "/inicio?secret=x", referrer: "https://example.com/page?token=x#secret", unknown: "ignored" });
  assert.deepEqual(copy(first), { utm_source: "facebook", utm_medium: "paid", utm_campaign: "Oferta A", landing_path: "/inicio", referrer: "https://example.com/page" });
  assert.deepEqual(d.mergeFirstTouch(first, { utm_source: "google", fbclid: "later" }), first);
});
test("CTWA captures allowlisted referral; absent referral remains valid", () => {
  const referral = d.captureWhatsAppReferral({ referral: { source_id: "123", source_type: "ad", source_url: "https://fb.me/ad", headline: "Hola", body: "Oferta", ctwa_clid: "click", image_url: "not retained", access_token: "not retained" } });
  assert.equal(referral.ctwa_clid, "click"); assert.equal(referral.source_id, "123"); assert.equal(referral.source, "meta_ads");
  assert.equal(referral.access_token, undefined); assert.equal(referral.image_url, undefined);
  assert.deepEqual(copy(d.captureWhatsAppReferral({ text: { body: "Hola" } })), { source: "whatsapp", entry_channel: "whatsapp" });
});
test("browser cannot supply lead/owner/status/price/confirmed fields", () => {
  for (const input of [{ action: "save", lead_id: crypto.randomUUID() }, { action: "save", answers: { owner_id: "other" } }, { action: "save", answers: { status: "calificado" } }, { action: "save", answers: { suggested_price: 15000 } }, { action: "save", answers: { confirmed: true } }, { action: "save", attribution: { source: "direct" } }]) assert.throws(() => web.parseWebIntakeInput(input));
  assert.throws(() => web.parseWebIntakeInput({ action: "save", answers: { name: "x".repeat(1201) } }));
  assert.equal(web.parseWebIntakeInput({ action: "finalize" }).action, "finalize");
  assert.throws(() => web.parseWebIntakeInput({ action: "finalize", answers: { timing: "October" } }));
  const edit = web.parseWebIntakeInput({ action: "save", mode: "edit", field: "what_sells", value: " Corregido " });
  assert.deepEqual(copy(edit), { action: "save", mode: "edit", field: "what_sells", value: "Corregido" });
  assert.throws(() => web.parseWebIntakeInput({ action: "save", mode: "edit", field: "budget_range", value: "25k_30k" }));
  assert.throws(() => web.parseWebIntakeInput({ action: "save", mode: "edit", field: "what_sells", value: 42 }));
});
test("session and continuation tokens are random, opaque, hashed and redacted", () => {
  const token = tokens.createSessionToken(), code = tokens.createContinuationCode();
  assert.match(token, /^[a-f0-9]{64}$/); assert.match(code, /^ECW-[A-F0-9]{24}$/);
  assert.notEqual(token, tokens.createSessionToken()); assert.notEqual(tokens.hashToken(token), token);
  assert.equal(tokens.extractContinuationCode(`Hola ${code.toLowerCase()}`), code);
  assert.ok(!tokens.redactContinuationCode(`Hola ${code}`).includes(code));
  assert.doesNotMatch(code, /[a-f0-9]{8}-[a-f0-9]{4}-/i);
});

function webSessionService() {
  const db = database();
  for (const table of ["intake_sessions", "contacts", "businesses", "leads", "tasks"]) db.tables[table] = [];
  db.failMaterialization = false;
  db.rpc = async (name, args) => {
    if (name === "intake_create_session") {
      db.tables.intake_sessions.push({ owner_id: args.p_owner, token_hash: args.p_hash, first_touch: args.p_attribution, answers: {}, lead_id: null, materialized_at: null, updated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() });
      return { data: null, error: null };
    }
    const session = db.tables.intake_sessions.find(row => row.owner_id === args.p_owner && row.token_hash === args.p_hash);
    if (!session) return { data: null, error: Error("session_unavailable") };
    if (name === "intake_save_session") {
      if (session.lead_id && session.materialized_at) return { data: null, error: null };
      if (session.lead_id) return { data: null, error: Error("session_unavailable") };
      session.answers = { ...args.p_answers, ...session.answers };
      session.updated_at = new Date().toISOString();
      return { data: null, error: null };
    }
    if (name === "intake_materialize_session") {
      if (db.failMaterialization) return { data: null, error: Error("task insert failed") };
      if (session.lead_id) return { data: session.lead_id, error: null };
      if (JSON.stringify(session.answers) !== JSON.stringify(args.p_expected_answers)) return { data: null, error: null };
      const leadId = `lead-${db.tables.leads.length + 1}`;
      const contactId = `contact-${db.tables.contacts.length + 1}`;
      db.tables.contacts.push({ id: contactId, owner_id: args.p_owner, full_name: session.answers.name, email: session.answers.email, phone: null });
      db.tables.leads.push({ id: leadId, owner_id: args.p_owner, contact_id: contactId, what_sells: session.answers.what_sells, intake: { ready_for_quote: true } });
      db.tables.tasks.push({ id: `task-${db.tables.tasks.length + 1}`, owner_id: args.p_owner, lead_id: leadId, title: "Revisar proyecto y preparar cotización", automation_key: "intake-v1-ready-for-quote" });
      session.lead_id = leadId;
      session.materialized_at = new Date().toISOString();
      session.answers = {};
      session.first_touch = {};
      session.updated_at = new Date().toISOString();
      return { data: leadId, error: null };
    }
    return { data: null, error: Error(`unexpected rpc ${name}`) };
  };
  const service = load("src/lib/intake/service.ts", { "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db }, "./domain": d, "./tokens": tokens, "@/lib/meta/capi": capi }, { CRM_OWNER_ID: "owner", NEXT_PUBLIC_SUPABASE_URL: "https://ycdosrsanutbhbgejwwg.supabase.co" });
  return { db, service };
}

test("web save and GET return complete readiness without materializing; finalize is explicit and idempotent", async () => {
  const { db, service } = webSessionService();
  const { token } = await service.createIntakeSession({ source: "direct", entry_channel: "web" });
  const saved = await service.saveSessionAnswer(token, complete);
  assert.equal(saved.ready_for_quote, true); assert.equal(saved.materialized, false); assert.equal(saved.status, "complete");
  assert.equal((await service.getIntakeSession(token)).ready_for_quote, true);
  assert.equal(db.tables.leads.length, 0); assert.equal(db.tables.tasks.length, 0);

  const finalized = await service.finalizeIntakeSession(token);
  const repeated = await service.finalizeIntakeSession(token);
  assert.equal(finalized.materialized, true); assert.equal(repeated.materialized, true);
  assert.equal(finalized.linked, true); assert.equal(db.tables.leads.length, 1); assert.equal(db.tables.tasks.length, 1);
  assert.equal(db.tables.tasks[0].title, "Revisar proyecto y preparar cotización");
});

test("explicit edit replaces one staged answer, recalculates readiness, and finalize materializes the correction", async () => {
  const { db, service } = webSessionService();
  const { token } = await service.createIntakeSession({ source: "direct", entry_channel: "web" });
  await service.saveSessionAnswer(token, complete);

  const ordinarySave = await service.saveSessionAnswer(token, { what_sells: "No debe sobrescribir" });
  assert.equal(ordinarySave.known_fields.what_sells, "Muebles");
  const edited = await service.editSessionAnswer(token, "what_sells", "Creo sistemas web para PyMEs");
  assert.equal(edited.known_fields.what_sells, "Creo sistemas web para PyMEs");
  assert.equal(edited.known_fields.main_goal, complete.main_goal);
  assert.equal(edited.known_fields.budget_range, complete.budget_range);

  await assert.rejects(service.editSessionAnswer(token, "budget_range", "25k_30k"), /invalid_intake_edit/);
  assert.equal((await service.getIntakeSession(token)).known_fields.what_sells, "Creo sistemas web para PyMEs");

  const incomplete = await service.editSessionAnswer(token, "what_sells", "");
  assert.equal(incomplete.ready_for_quote, false); assert.ok(incomplete.missing_fields.includes("what_sells"));
  const restored = await service.editSessionAnswer(token, "what_sells", "Creo sistemas web para PyMEs");
  assert.equal(restored.ready_for_quote, true);

  const materialized = await service.finalizeIntakeSession(token);
  const repeated = await service.finalizeIntakeSession(token);
  assert.equal(materialized.materialized, true); assert.equal(repeated.materialized, true);
  assert.equal(db.tables.leads[0].what_sells, "Creo sistemas web para PyMEs");
  assert.equal(db.tables.leads.length, 1); assert.equal(db.tables.tasks.length, 1);
  await assert.rejects(service.editSessionAnswer(token, "what_sells", "After finalize"), /intake_session_materialized/);
  assert.equal(db.tables.leads[0].what_sells, "Creo sistemas web para PyMEs");
  assert.equal(db.tables.tasks.length, 1);
});

test("finalize incomplete returns missing fields without materializing; post-finalize saves are no-op", async () => {
  const { db, service } = webSessionService();
  const { token } = await service.createIntakeSession({ source: "direct", entry_channel: "web" });
  const incomplete = { ...complete }; delete incomplete.timing;
  await service.saveSessionAnswer(token, incomplete);
  const rejected = await service.finalizeIntakeSession(token);
  assert.equal(rejected.ready_for_quote, false); assert.equal(rejected.materialized, false); assert.ok(rejected.missing_fields.includes("timing"));
  assert.equal(db.tables.leads.length, 0); assert.equal(db.tables.tasks.length, 0);

  await service.saveSessionAnswer(token, { timing: complete.timing });
  const finalized = await service.finalizeIntakeSession(token);
  await service.saveSessionAnswer(token, { timing: "changed" });
  assert.equal(finalized.materialized, true); assert.equal(db.tables.leads.length, 1); assert.equal(db.tables.tasks.length, 1);
  assert.equal(db.tables.intake_sessions[0].answers.timing, undefined);
});

test("a failed materialization leaves a ready session staged for a safe finalize retry", async () => {
  const { db, service } = webSessionService();
  const { token } = await service.createIntakeSession({ source: "direct", entry_channel: "web" });
  await service.saveSessionAnswer(token, complete);
  db.failMaterialization = true;
  await assert.rejects(service.finalizeIntakeSession(token), /intake_storage_failed/);
  assert.equal(db.tables.leads.length, 0); assert.equal(db.tables.tasks.length, 0);
  assert.equal((await service.getIntakeSession(token)).ready_for_quote, true);
  db.failMaterialization = false;
  assert.equal((await service.finalizeIntakeSession(token)).materialized, true);
  assert.equal(db.tables.leads.length, 1); assert.equal(db.tables.tasks.length, 1);
});

test("an already materialized legacy session returns its receipt without reinserting CRM rows", async () => {
  const { db, service } = webSessionService();
  const { token } = await service.createIntakeSession({ source: "direct", entry_channel: "web" });
  const session = db.tables.intake_sessions[0];
  session.lead_id = "legacy-lead";
  session.materialized_at = new Date().toISOString();
  db.tables.leads.push({ id: "legacy-lead", owner_id: "owner" });
  db.tables.tasks.push({ id: "legacy-task", owner_id: "owner", lead_id: "legacy-lead", automation_key: "intake-v1-ready-for-quote" });

  const read = await service.getIntakeSession(token);
  const finalized = await service.finalizeIntakeSession(token);
  assert.equal(read.materialized, true); assert.equal(finalized.materialized, true);
  assert.equal(db.tables.leads.length, 1); assert.equal(db.tables.tasks.length, 1);
});

test("canonical projection reuses CRM fields and real uploads, never generated references", async () => {
  const db = database();
  db.tables.contacts = [{ id: "contact", owner_id: "owner", full_name: "CRM name", phone: complete.whatsapp, email: "crm@example.com" }];
  db.tables.businesses = [{ id: "business", owner_id: "owner", name: "CRM business" }];
  db.tables.leads[0] = { ...db.tables.leads[0], contact_id: "contact", business_id: "business", main_goal: "Filtrar", intake: { answers: { name: "Untrusted duplicate", budget_range: "20k_35k", timing: "Octubre" } } };
  db.tables.assets = [{ owner_id: "owner", lead_id: "lead", category: "image", source: "visual_generator_v1", storage_path: "generated.png", mime_type: "image/png" }];
  const service = load("src/lib/intake/service.ts", { "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db }, "./domain": d, "./tokens": tokens, "@/lib/meta/capi": capi }, { CRM_OWNER_ID: "owner", NEXT_PUBLIC_SUPABASE_URL: "https://ycdosrsanutbhbgejwwg.supabase.co" });
  const first = await service.getLeadIntake("lead");
  assert.equal(first.known_fields.name, "CRM name"); assert.equal(first.known_fields.business_name, "CRM business");
  assert.equal(first.ready_for_quote, false); assert.ok(first.missing_fields.includes("reference"));
  db.tables.assets.push({ owner_id: "owner", lead_id: "lead", category: "image", source: "whatsapp_import", storage_path: "photo.jpg", mime_type: "image/jpeg" });
  assert.equal((await service.getLeadIntake("lead")).ready_for_quote, true);
  db.tables.intake_sessions = [{ owner_id: "owner", token_hash: tokens.hashToken("test"), lead_id: "lead", expires_at: "2099-01-01", answers: {} }];
  assert.deepEqual(copy(await service.getIntakeSession("test")), { linked: true, materialized: false, status: "linked", ready_for_quote: false, completion_percent: 0, missing_fields: [], intake_version: 1 });
});

function agent(initial, responses = []) {
  const db = database(), requests = [];
  let state = d.evaluateIntakeReadiness(initial);
  const api = load("src/lib/whatsapp/sales-agent.ts", {
    "@/lib/intake/domain": d,
    "@/lib/intake/service": {
      getLeadIntake: async () => state,
      saveIntakeAnswer: async (_lead, answer) => state = d.evaluateIntakeReadiness(d.mergeIntakeData(state.known_fields, answer)),
    },
    "next/server": { after() {} },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/whatsapp/asset-enrichment": {},
  }, { OPENAI_API_KEY: "local-test-placeholder" }, async (_url, opts) => {
    requests.push(JSON.parse(opts.body));
    return { ok: true, json: async () => responses.shift() ?? { output_text: "Gracias por compartirlo." } };
  });
  return { api, requests, run: () => api.runWhatsAppSalesAgent({ lead: { leadId: "lead" }, messages: [] }) };
}
test("web answers feed WhatsApp; known budget/name never asked; only one question", async () => {
  const answers = web.parseWebIntakeInput({ action: "save", answers: { name: "Ana", whatsapp: complete.whatsapp, budget_range: "20k_35k", what_sells: "Muebles", how_sells: "Agenda y cobra" } }).answers;
  const a = agent(answers, [{ output_text: "¿Cómo te llamas? ¿Cuál es tu presupuesto?" }]);
  const result = await a.run();
  assert.equal((result.reply.match(/\?/g) ?? []).length, 1);
  assert.ok(result.reply.includes("mejorar")); assert.ok(!result.reply.includes("llamas")); assert.ok(!result.reply.includes("presupuesto"));
  assert.ok(a.requests[0].input[0].content.includes('"budget_range":"20k_35k"'));
  assert.ok(a.requests[0].input[0].content.includes('"missing_fields"'));
});
test("FAQ answered then one missing field, explicit false persisted", async () => {
  const a = agent({ name: "Ana", whatsapp: complete.whatsapp }, [
    { output: [{ type: "function_call", call_id: "a", name: "save_intake_answer", arguments: JSON.stringify({ field: "currently_selling", value: "false" }) }] },
    { output_text: "Sí, Eder trabaja con sitios y formularios. El alcance lo revisará personalmente." },
  ]);
  const result = await a.run();
  assert.ok(result.reply.includes("sitios y formularios"));
  assert.equal((result.reply.match(/\?/g) ?? []).length, 1);
  assert.ok(a.requests[1].input.at(-1).content.includes('"currently_selling":false'));
});
test("ready stops all questioning before model call and after last answer", async () => {
  const ready = agent(complete); const result = await ready.run();
  assert.equal(ready.requests.length, 0); assert.equal(result.reply, d.READY_REPLY); assert.equal(result.handoffReason, "intake_v1_ready_for_quote");
  const missing = { ...complete }; delete missing.timing;
  const a = agent(missing, [{ output: [{ type: "function_call", call_id: "a", name: "save_intake_answer", arguments: JSON.stringify({ field: "timing", value: "Próximo mes" }) }] }]);
  const final = await a.run();
  assert.equal(final.handoffRequested, true); assert.equal(final.reply, d.READY_REPLY); assert.equal(a.requests.length, 1);
});
test("automatic Proposal Prep disabled by absent/false flags for completed enrichment", async () => {
  for (const enabled of [undefined, "false"]) {
    let calls = 0;
    const db = database();
    const enrichment = load("src/lib/whatsapp/asset-enrichment.ts", { "@/lib/supabase/admin": { createAdminClient: () => db }, "@/lib/whatsapp/proposal-prep": { tryPrepareVisualProposalDraft: async () => { calls++; } } }, { WHATSAPP_PROPOSAL_PREP_ENABLED: enabled });
    assert.equal((await enrichment.enrichBusinessReferenceAsset("source")).proposalPrep.status, "disabled"); assert.equal(calls, 0);
  }
});
test("Visual Generator remains opt-in and its files unchanged by Intake", () => {
  const code = fs.readFileSync("src/lib/whatsapp/visual-image-provider.ts", "utf8");
  assert.match(code, /WHATSAPP_VISUAL_GENERATION_ENABLED/);
  assert.match(code, /!== "true"/);
});
test("web endpoint enforces cookie capability, origin, payload limit and rejects arbitrary lead", async () => {
  let calls = 0;
  const route = load("src/app/api/intake/session/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, cookies: { set() {} } }) } },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/intake/web": web,
    "@/lib/intake/service": { saveSessionAnswer: async () => { calls++; } },
  }, { INTAKE_WEB_ENABLED: "true", INTAKE_WEB_ORIGIN: "https://example.com" });
  const req = (body, origin = "https://example.com") => new Request("https://example.com/api/intake/session", { method: "POST", headers: { origin, "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  assert.equal((await route.POST(req({ action: "save", answers: { name: "Ana" } }))).status, 400);
  assert.equal((await route.POST(req({ action: "save", lead_id: "arbitrary" }))).status, 400);
  assert.equal((await route.POST(req({ action: "save" }, "https://evil.test"))).status, 403);
  assert.equal((await route.POST(req("x".repeat(12001)))).status, 413); assert.equal(calls, 0);
});

test("web endpoint routes action finalize through the explicit service method", async () => {
  let calls = 0;
  const route = load("src/app/api/intake/session/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, cookies: { set() {} } }) } },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "a".repeat(64) }) }) },
    "@/lib/intake/web": web,
    "@/lib/intake/service": { finalizeIntakeSession: async () => { calls++; return { linked: true, materialized: true, ready_for_quote: true }; } },
  }, { INTAKE_WEB_ENABLED: "true", INTAKE_WEB_ORIGIN: "https://example.com" });
  const result = await route.POST(new Request("https://example.com/api/intake/session", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify({ action: "finalize" }) }));
  assert.equal(result.status, 200); assert.equal(result.data.materialized, true); assert.equal(calls, 1);
});

test("web endpoint routes explicit save edits without changing the normal save action", async () => {
  let editCall;
  const route = load("src/app/api/intake/session/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, cookies: { set() {} } }) } },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "a".repeat(64) }) }) },
    "@/lib/intake/web": web,
    "@/lib/intake/service": {
      editSessionAnswer: async (_token, field, value) => { editCall = { field, value }; return { ready_for_quote: true, known_fields: { [field]: value } }; },
      saveSessionAnswer: async (_token, answers) => ({ ready_for_quote: false, known_fields: answers }),
    },
  }, { INTAKE_WEB_ENABLED: "true", INTAKE_WEB_ORIGIN: "https://example.com" });
  const request = body => new Request("https://example.com/api/intake/session", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify(body) });
  const editResponse = await route.POST(request({ action: "save", mode: "edit", field: "what_sells", value: "  Corregido  " }));
  assert.equal(editResponse.status, 200); assert.deepEqual(editCall, { field: "what_sells", value: "Corregido" });
  const saveResponse = await route.POST(request({ action: "save", answers: { what_sells: "Normal" } }));
  assert.equal(saveResponse.status, 200); assert.equal(saveResponse.data.known_fields.what_sells, "Normal");
});

test("webhook captures CTWA, consumes/redacts continuation and preserves advanced status on legacy handoff", async () => {
  for (const status of ["propuesta_visual", "cotizacion_enviada", "en_desarrollo"]) {
    const db = database(), attribution = [], claims = [];
    db.tables.contacts = [{ id: "contact", owner_id: "owner", phone: "525512345678", full_name: "Ana" }];
    db.tables.leads[0] = { ...db.tables.leads[0], contact_id: "contact", status };
    db.tables.conversations = [{ id: "conversation", owner_id: "owner", lead_id: "lead", provider: "whatsapp", is_open: true, bot_paused: false, unread_count: 0 }];
    db.tables.messages = [];
    const route = load("src/app/api/whatsapp/webhook/route.ts", {
      "@/lib/intake/domain": d,
      "@/lib/intake/tokens": tokens,
      "@/lib/intake/service": { resolveIntakeContinuation: async (...args) => { claims.push(args); return "lead"; }, saveIntakeAnswer: async (...args) => attribution.push(args) },
      "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
      "@/lib/supabase/admin": { createAdminClient: () => db },
      "@/lib/whatsapp/admin-alert": { notifyAdminOfWhatsAppHandoff: async () => {} },
      "@/lib/whatsapp/audio": {},
      "@/lib/whatsapp/sales-agent": { runWhatsAppSalesAgent: async () => ({ reply: "Eder continuará personalmente.", handoffRequested: true, handoffSummary: "Resumen", handoffReason: "prospect_requested_human" }) },
      "@/lib/whatsapp/cloud": { verifyMetaWebhookSignature: () => true, isWhatsAppSendConfigured: () => true, sendWhatsAppText: async () => "outbound-id" },
    }, { CRM_OWNER_ID: "owner", META_APP_SECRET: "local-test-placeholder", WHATSAPP_PHONE_NUMBER_ID: "phone-id" });
    const code = tokens.createContinuationCode();
    const payload = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-id" }, messages: [{ id: "inbound-id", from: "525512345678", timestamp: "1791230400", type: "text", text: { body: `Continuar ${code}` }, referral: { source_id: "123", source_type: "ad", ctwa_clid: "click" } }] } }] }] };
    const result = await route.POST(new Request("https://example.com/api/whatsapp/webhook", { method: "POST", body: JSON.stringify(payload) }));
    assert.equal(result.status, 200); assert.equal(result.data.handoffs, 1);
    assert.equal(db.tables.leads[0].status, status); assert.equal(db.tables.leads[0].human_required, true);
    assert.equal(db.tables.conversations[0].bot_paused, true);
    assert.equal(attribution[0][2].ctwa_clid, "click"); assert.equal(claims[0][0], code);
    assert.ok(!JSON.stringify(db.tables).includes(code));
  }
});
