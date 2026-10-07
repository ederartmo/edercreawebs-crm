// Web session contract: strict parser + POST /api/web/session endpoint. No network, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { load, copy } from "./test-helpers/proposal-fixture.mjs";

const d = load("src/lib/intake/domain.ts", {});
const tokens = load("src/lib/intake/tokens.ts", { "node:crypto": crypto });
const parse = load("src/lib/web/parse.ts", { "@/lib/intake/domain": d });
const uuid = () => crypto.randomUUID();
const event = (name, extra = {}) => ({ action: "event", event_name: name, event_id: uuid(), ...extra });

test("web identifiers are opaque, random and server-minted", () => {
  const id = tokens.createEventId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.notEqual(id, tokens.createEventId());
  assert.notEqual(tokens.createSessionToken(), tokens.createSessionToken());
  assert.match(tokens.createSessionToken(), /^[a-f0-9]{64}$/);
  // reference_code is no longer minted in Node: PostgreSQL fills the ECW- default on insert.
  assert.equal(tokens.createReferenceCode, undefined);
});

test("only create/event/heartbeat are accepted and foreign identifiers are rejected", () => {
  assert.equal(parse.parseWebSessionInput({ action: "create" }).action, "create");
  assert.equal(parse.parseWebSessionInput({ action: "event", event_name: "stage_viewed", event_id: uuid() }).action, "event");
  assert.equal(parse.parseWebSessionInput({ action: "heartbeat" }).action, "heartbeat");
  for (const input of [undefined, null, [], "create", {}, { action: "start" }, { action: 42 }, { action: ["create"] }]) {
    assert.throws(() => parse.parseWebSessionInput(input));
  }
  for (const payload of [
    { action: "create", lead_id: uuid() },
    { action: "create", owner_id: uuid() },
    { action: "create", token_hash: "a".repeat(64) },
    { action: "create", session_id: uuid() },
    { action: "event", ...event("stage_viewed"), session_id: uuid() },
    { action: "event", ...event("stage_viewed"), owner_id: uuid() },
    { action: "event", ...event("stage_viewed"), lead_id: uuid() },
    { action: "heartbeat", session_id: uuid() },
    { action: "heartbeat", event_name: "stage_viewed" },
  ]) assert.throws(() => parse.parseWebSessionInput(payload), /invalid_input/);
});

test("attribution reuses intake sanitization and keeps only web_sessions columns", () => {
  const input = parse.parseWebSessionInput({
    action: "create",
    attribution: {
      source: "meta_ads", entry_channel: "whatsapp",
      utm_source: " Facebook ", utm_medium: " PAID ", utm_campaign: "Oferta A", utm_content: "creative", utm_term: "term",
      landing_path: "/proyecto?secret=x", referrer: "https://example.org/origin?token=x#secret",
      fbclid: "click", source_id: "123", source_type: "ad", headline: "Hola", body: "Texto", ctwa_clid: "clid", unknown: "ignored",
    },
  });
  assert.deepEqual(copy(input.attribution), {
    source: "meta_ads", entry_channel: "whatsapp",
    utm_source: "facebook", utm_medium: "paid", utm_campaign: "Oferta A", utm_content: "creative", utm_term: "term",
    landing_path: "/proyecto", referrer: "https://example.org/origin",
  });
  assert.equal(parse.parseWebSessionInput({ action: "create", attribution: { source: "invented" } }).attribution.source, undefined);
  assert.equal(parse.parseWebSessionInput({ action: "create", attribution: { landing_path: "https://evil.test/x" } }).attribution.landing_path, undefined);
  assert.throws(() => parse.parseWebSessionInput({ action: "create", attribution: "facebook" }), /invalid_attribution/);
  assert.throws(() => parse.parseWebSessionInput({ action: "create", attribution: ["facebook"] }), /invalid_attribution/);
});

test("fbp/fbc are stored only with explicit marketing consent", () => {
  const granted = parse.parseWebSessionInput({ action: "create", consent: { analytics: true, marketing: true }, attribution: { fbp: "fb.1.1690000000", fbc: "fb.1.1690000000!BM.ABC123" } });
  assert.equal(granted.fbp, "fb.1.1690000000"); assert.equal(granted.fbc, "fb.1.1690000000!BM.ABC123");
  assert.equal(parse.parseWebSessionInput({ action: "create", consent: { analytics: true, marketing: false }, attribution: { fbp: "fb.1.1690000000" } }).fbp, undefined);
  assert.equal(parse.parseWebSessionInput({ action: "create", attribution: { fbp: "fb.1.1690000000" } }).fbp, undefined);
  assert.equal(parse.parseWebSessionInput({ action: "create", consent: { marketing: true }, attribution: { fbp: "has spaces", fbc: "fb.1.1690000000" } }).fbp, undefined);
  assert.equal(parse.parseWebSessionInput({ action: "create", consent: { marketing: true }, attribution: { fbc: "fb.1.1690000000" } }).fbc, "fb.1.1690000000");
});

test("consent accepts only explicit booleans and defaults to no consent", () => {
  assert.equal(parse.parseWebSessionInput({ action: "create" }).consent, undefined);
  assert.deepEqual(copy(parse.parseWebSessionInput({ action: "create", consent: { marketing: true } }).consent), { analytics: false, marketing: true });
  for (const consent of ["true", 1, { analytics: "true" }, { analytics: true, marketing: "yes" }, { necessary: true }, [true], null]) {
    assert.throws(() => parse.parseWebSessionInput({ action: "create", consent }), /invalid_consent/);
  }
  assert.throws(() => parse.parseWebSessionInput({ action: "heartbeat", consent: { analytics: "true" } }), /invalid_consent/);
});

test("event allowlist excludes server events and validates the idempotency key", () => {
  for (const name of parse.CLIENT_EVENTS) assert.equal(parse.parseWebSessionInput(event(name)).event_name, name);
  assert.throws(() => parse.parseWebSessionInput(event("lead_created")), /server_event_only/);
  assert.throws(() => parse.parseWebSessionInput(event("session_started")), /invalid_event_name/);
  assert.throws(() => parse.parseWebSessionInput(event("page_viewed")), /invalid_event_name/);
  assert.throws(() => parse.parseWebSessionInput({ action: "event", event_name: "stage_viewed" }), /invalid_event_id/);
  assert.throws(() => parse.parseWebSessionInput({ action: "event", event_name: "stage_viewed", event_id: "not-a-uuid" }), /invalid_event_id/);
  assert.throws(() => parse.parseWebSessionInput({ action: "event", event_name: "stage_viewed", event_id: `${uuid()}-extra` }), /invalid_event_id/);
  const upper = uuid().toUpperCase();
  assert.equal(parse.parseWebSessionInput({ action: "event", event_name: "stage_viewed", event_id: upper }).event_id, upper.toLowerCase());
});

test("event properties are schema-allowlisted, so free text and PII never persist", () => {
  const contact = event("contact_details_submitted");
  assert.deepEqual(copy(parse.parseWebSessionInput({ ...contact, properties: { has_name: true, has_whatsapp: false, has_email: true } }).properties),
    { has_name: true, has_whatsapp: false, has_email: true });
  for (const properties of [
    { name: "Ana" },
    { whatsapp: "525512345678" },
    { email: "ana@example.com" },
    { message: "Quiero una web" },
    { has_name: "yes" },
    { has_name: true, phone: "525512345678" },
    { constructor: "polluted" },
    "has_name",
    ["has_name"],
  ]) assert.throws(() => parse.parseWebSessionInput({ ...contact, properties }), /invalid_event_properties/);

  const stage = event("stage_viewed");
  assert.deepEqual(copy(parse.parseWebSessionInput({ ...stage, properties: { previous_stage: "diagnostico" } }).properties), { previous_stage: "diagnostico" });
  assert.deepEqual(copy(parse.parseWebSessionInput({ ...stage, properties: {} }).properties), {});
  assert.deepEqual(copy(parse.parseWebSessionInput(stage).properties), {});
  assert.throws(() => parse.parseWebSessionInput({ ...stage, properties: { previous_stage: "x".repeat(65) } }), /invalid_event_properties/);
  assert.throws(() => parse.parseWebSessionInput({ ...stage, properties: { previous_stage: 42 } }), /invalid_event_properties/);
  assert.throws(() => parse.parseWebSessionInput({ ...stage, properties: { email: "a@b.co" } }), /invalid_event_properties/);
  assert.throws(() => parse.parseWebSessionInput(event("audit_cta_clicked", { properties: { cta: "diagnostico" } })), /invalid_event_properties/);
  assert.throws(() => parse.parseWebSessionInput(event("session_ended", { properties: { reason: "idle" } })), /invalid_event_properties/);
});

test("paths and stages never leak query strings or absolute URLs", () => {
  const stage = parse.parseWebSessionInput(event("stage_viewed", { path: "/diagnostico?email=ana@example.com#top", stage: "  Diagnóstico  " }));
  assert.equal(stage.path, "/diagnostico");
  assert.equal(stage.stage, "Diagnóstico");
  assert.equal(parse.parseWebSessionInput(event("stage_viewed", { path: "https://evil.test/steal" })).path, undefined);
  assert.equal(parse.parseWebSessionInput(event("stage_viewed", { path: "//evil.test/steal" })).path, undefined);
  assert.equal(parse.parseWebSessionInput(event("stage_viewed", { path: 42 })).path, undefined);
  assert.equal(parse.parseWebSessionInput(event("stage_viewed", { stage: 42 })).stage, undefined);
  const heartbeat = parse.parseWebSessionInput({ action: "heartbeat", current_path: "/precios?utm=x", current_stage: "precios", consent: { analytics: true, marketing: false } });
  assert.equal(heartbeat.current_path, "/precios"); assert.equal(heartbeat.current_stage, "precios");
  assert.equal(heartbeat.consent.analytics, true);
});

function routeFor(service, env = {}) {
  const jar = new Map(), set = [];
  const route = load("src/app/api/web/session/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, headers: options.headers, cookies: { set: (name, value, opts) => { jar.set(name, value); set.push({ name, value, opts }); } } }) } },
    "next/headers": { cookies: async () => ({ get: name => (jar.has(name) ? { value: jar.get(name) } : undefined) }) },
    "@/lib/web/parse": parse,
    "@/lib/web/session": service,
  }, { INTAKE_WEB_ENABLED: "true", INTAKE_WEB_ORIGIN: "https://example.com", ...env });
  const post = (body, origin = "https://example.com") => route.POST(new Request("https://example.com/api/web/session", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
  }));
  return { route, jar, set, post, calls: service.calls };
}
function stub() {
  const calls = [];
  return {
    calls,
    async createWebSession(input) {
      calls.push(["create", input]);
      return { token: "a".repeat(64), reference_code: "ECW-A1B2C3D4E5", status: "active", created: !input.token,
        // Everything below must never reach the browser.
        id: "session-uuid", owner_id: "owner-uuid", token_hash: "b".repeat(64), lead_id: "lead-uuid", intake_session_id: "intake-uuid" };
    },
    async recordWebEvent(token, input) { calls.push(["event", token, input]); return { ok: true }; },
    async heartbeatWebSession(token, input) { calls.push(["heartbeat", token, input]); return { ok: true }; },
  };
}
const token = "c".repeat(64);

test("endpoint honors the feature flag, exact origin, content type and 12 KB limit", async () => {
  const disabled = routeFor(stub(), { INTAKE_WEB_ENABLED: undefined });
  assert.equal((await disabled.post({ action: "create" })).status, 503);
  assert.equal(disabled.calls.length, 0);

  const service = stub(), api = routeFor(service);
  assert.equal((await api.post({ action: "create" }, "https://evil.test")).status, 403);
  const noType = await api.route.POST(new Request("https://example.com/api/web/session", { method: "POST", headers: { origin: "https://example.com" }, body: JSON.stringify({ action: "create" }) }));
  assert.equal(noType.status, 415);
  assert.equal((await api.post("x".repeat(12001))).status, 413);
  assert.equal((await api.post({ action: "restart" })).status, 400);
  assert.equal((await api.post({ action: "event", event_name: "lead_created", event_id: uuid() })).status, 400);
  assert.equal(service.calls.length, 0);
});

test("create returns a non-sensitive receipt and sets a hardened 30-day cookie", async () => {
  const service = stub(), api = routeFor(service);
  const created = await api.post({ action: "create", attribution: { source: "meta_ads" }, current_path: "/precios", current_stage: "inicio" });
  assert.equal(created.status, 201);
  assert.deepEqual(copy(created.data), { ok: true, reference_code: "ECW-A1B2C3D4E5", status: "active" });
  const body = JSON.stringify(created.data);
  for (const secret of ["session-uuid", "owner-uuid", "lead-uuid", "intake-uuid", "b".repeat(64), "a".repeat(64)]) assert.ok(!body.includes(secret), secret);

  const cookie = api.set[0];
  assert.equal(cookie.name, "ecw_web_session");
  assert.match(cookie.value, /^[a-f0-9]{64}$/);
  assert.deepEqual(copy(cookie.opts), { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  assert.equal(service.calls[0][1].token, undefined);
  assert.equal(service.calls[0][1].current_path, "/precios");

  const production = routeFor(stub(), { NODE_ENV: "production" });
  await production.post({ action: "create" });
  assert.equal(production.set[0].opts.secure, true);
});

test("create reuses an existing cookie session instead of minting another row", async () => {
  const service = stub(), api = routeFor(service);
  await api.post({ action: "create" });
  const reused = await api.post({ action: "create", current_path: "/segunda" });
  assert.equal(reused.status, 200);
  assert.deepEqual(copy(reused.data), { ok: true, reference_code: "ECW-A1B2C3D4E5", status: "active" });
  assert.equal(service.calls.length, 2);
  assert.equal(service.calls[1][1].token, "a".repeat(64));
  assert.equal(service.calls[1][1].current_path, "/segunda");
  assert.equal(api.set.length, 2); // la cookie se refresca...
  assert.equal(api.set[1].value, api.set[0].value); // ...sin rotar el token
});

test("event and heartbeat require the cookie and are routed with it as the only identity", async () => {
  const service = stub(), api = routeFor(service);
  assert.equal((await api.post(event("stage_viewed"))).status, 400);
  assert.equal((await api.post({ action: "heartbeat" })).status, 400);
  assert.equal(service.calls.length, 0);

  api.jar.set("ecw_web_session", token);
  const clientEvent = await api.post(event("contact_details_submitted", { properties: { has_name: true } }));
  assert.equal(clientEvent.status, 200); assert.deepEqual(copy(clientEvent.data), { ok: true });
  assert.equal(service.calls[0][0], "event");
  assert.equal(service.calls[0][1], token);
  assert.equal(service.calls[0][2].event_name, "contact_details_submitted");
  assert.deepEqual(copy(service.calls[0][2].properties), { has_name: true });

  const beat = await api.post({ action: "heartbeat", current_path: "/precios" });
  assert.equal(beat.status, 200); assert.deepEqual(copy(beat.data), { ok: true });
  assert.equal(service.calls[1][0], "heartbeat");
  assert.equal(service.calls[1][1], token);
  assert.equal(service.calls[1][2].current_path, "/precios");
  assert.equal(service.calls[1][2].properties, undefined);

  api.jar.set("ecw_web_session", "not-64-hex");
  assert.equal((await api.post(event("stage_viewed"))).status, 400);
  assert.equal(service.calls.length, 2);
});
