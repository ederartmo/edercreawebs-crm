// Web session backend + intake linkage against local PostgreSQL (no network/provider).
// $env:ECW_PGLITE_MODULE = '<temporary install>/node_modules/@electric-sql/pglite/dist/index.js'
// node --test scripts/test-web-session-sql.mjs
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { load, copy } from "./test-helpers/proposal-fixture.mjs";

const d = load("src/lib/intake/domain.ts", {});
const tokens = load("src/lib/intake/tokens.ts", { "node:crypto": crypto });
const parse = load("src/lib/web/parse.ts", { "@/lib/intake/domain": d });
const intakeWeb = load("src/lib/intake/web.ts", { "./domain": d });
const WEB_MIGRATION = "supabase/migrations/20261007000100_web_sessions_v1.sql";
const enabled = Boolean(process.env.ECW_PGLITE_MODULE);
let pg;
before(async () => {
  if (!enabled) return;
  const { PGlite } = await import(pathToFileURL(process.env.ECW_PGLITE_MODULE).href);
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';`);
  for (const name of ["20260705000100_baseline_current_public_schema", "20260927000100_whatsapp_handoff_task", "20260927000200_whatsapp_agent_v2_handoff_task", "20261005210820_intake_v1", "20261007000100_web_sessions_v1"]) {
    await pg.exec(fs.readFileSync(`supabase/migrations/${name}.sql`, "utf8"));
  }
});
after(async () => { if (pg) await pg.close(); });
const sqlTest = (name, fn) => test(name, { skip: !enabled }, fn);

// Minimal PostgREST-shaped transport to real SQL, not an in-memory business mock.
function sqlClient() {
  const identifier = value => { assert.match(value, /^[a-z_]+$/); return `"${value}"`; };
  return {
    async rpc(name, args) {
      try {
        const entries = Object.entries(args);
        const result = await pg.query(`select public.${identifier(name)}(${entries.map(([k], i) => `${identifier(k)} => $${i + 1}`).join(",")}) as result`, entries.map(([, v]) => v));
        return { data: result.rows[0].result, error: null };
      } catch (error) { return { data: null, error }; }
    },
    from(table) {
      let operation = "select", payload, single = false, required = false, limit;
      const filters = [], orders = [];
      const query = {
        select() { return query; },
        eq(k, v) { filters.push([k, "=", v]); return query; },
        is(k, v) { assert.equal(v, null); filters.push([k, "is null"]); return query; },
        filter(k, operator, value) { assert.equal(operator, "eq"); filters.push([k, "json_eq", JSON.parse(value)]); return query; },
        not(k, op, v) { assert.equal(op, "is"); assert.equal(v, null); filters.push([k, "is not null"]); return query; },
        in(k, v) { filters.push([k, "in", v]); return query; },
        order(k, options = {}) { orders.push(`${identifier(k)} ${options.ascending === false ? "desc" : "asc"}`); return query; },
        limit(n) { limit = Number(n); return query; },
        single() { single = true; required = true; return query; },
        maybeSingle() { single = true; return query; },
        insert(v) { operation = "insert"; payload = v; return query; },
        update(v) { operation = "update"; payload = v; return query; },
        then(resolve, reject) {
          return (async () => {
            try {
              const values = [], bind = v => { values.push(v); return `$${values.length}`; };
              const entries = () => Object.entries(payload).filter(([, v]) => v !== undefined);
              let sql = `select * from ${identifier(table)}`;
              if (operation === "insert") sql = `insert into ${identifier(table)}(${entries().map(([k]) => identifier(k)).join(",")}) values(${entries().map(([, v]) => bind(v)).join(",")})`;
              else if (operation === "update") sql = `update ${identifier(table)} set ${entries().map(([k, v]) => `${identifier(k)}=${bind(v)}`).join(",")}`;
              if (filters.length) sql += " where " + filters.map(([k, op, v]) => op === "json_eq"
                ? `${identifier(k)}=${bind(JSON.stringify(v))}::jsonb`
                : `${identifier(k)} ${op} ${op === "in" ? `(${v.map(bind).join(",")})` : op === "=" ? bind(v) : ""}`).join(" and ");
              if (orders.length) sql += ` order by ${orders.join(",")}`;
              if (limit !== undefined) sql += ` limit ${limit}`;
              if (operation !== "select") sql += " returning *";
              const result = await pg.query(sql, values);
              if (required && result.rows.length !== 1) throw Error("single_row_required");
              return { data: single ? result.rows[0] ?? null : result.rows, error: null };
            } catch (error) { return { data: null, error }; }
          })().then(resolve, reject);
        },
      };
      return query;
    },
  };
}
const complete = {
  name: "Ana Web", whatsapp: "525512345678", email: "ana@example.com", business_name: "Negocio web",
  what_sells: "Muebles", customer_acquisition: "Instagram", how_sells: "Agenda y cobra anticipo", main_goal: "Filtrar",
  budget_range: "20k_35k", timing: "Octubre", website: "https://example.com/",
};

async function setup() {
  const owner = crypto.randomUUID(), db = sqlClient();
  await pg.query("insert into auth.users values($1)", [owner]);
  const env = { CRM_OWNER_ID: owner, NEXT_PUBLIC_SUPABASE_URL: "https://ycdosrsanutbhbgejwwg.supabase.co", INTAKE_WEB_ENABLED: "true", INTAKE_WEB_ORIGIN: "https://example.com" };
  const intake = load("src/lib/intake/service.ts", { "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db }, "./domain": d, "./tokens": tokens }, env);
  const web = load("src/lib/web/session.ts", { "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db }, "@/lib/intake/tokens": tokens }, env);
  const jar = new Map(), set = [];
  const json = (data, options = {}) => ({ data, status: options.status ?? 200, headers: options.headers, cookies: { set: (name, value, opts) => { jar.set(name, value); set.push({ name, value, opts }); } } });
  const headers = { cookies: async () => ({ get: name => (jar.has(name) ? { value: jar.get(name) } : undefined) }) };
  const webRoute = load("src/app/api/web/session/route.ts", { "next/server": { NextResponse: { json } }, "next/headers": headers, "@/lib/web/parse": parse, "@/lib/web/session": web }, env);
  const intakeRoute = load("src/app/api/intake/session/route.ts", { "next/server": { NextResponse: { json } }, "next/headers": headers, "@/lib/intake/service": intake, "@/lib/intake/web": intakeWeb }, env);
  const rows = table => pg.query(`select * from ${table} where owner_id=$1`, [owner]).then(r => r.rows);
  const post = (route, body, path = "/api/web/session") => route.POST(new Request(`https://example.com${path}`, {
    method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { owner, db, env, jar, set, intake, web, webRoute, intakeRoute, rows, post };
}
/** Full browser flow: web session first, then its intake session. Returns the intake receipt. */
async function start(ctx) {
  const created = await ctx.post(ctx.webRoute, { action: "create", attribution: { source: "meta_ads", utm_source: "facebook", landing_path: "/proyecto?x=1" }, current_path: "/proyecto", current_stage: "inicio" });
  assert.equal(created.status, 201);
  const intakeCreated = await ctx.post(ctx.intakeRoute, { action: "create" }, "/api/intake/session");
  assert.equal(intakeCreated.status, 201);
  return intakeCreated;
}
/** Web + intake flow driven all the way to a materialized lead. Returns the converted web session. */
async function convert(ctx) {
  await start(ctx);
  await ctx.intake.saveSessionAnswer(ctx.jar.get("ecw_intake"), complete);
  const finalized = await ctx.post(ctx.intakeRoute, { action: "finalize" }, "/api/intake/session");
  assert.equal(finalized.status, 200);
  const session = (await ctx.rows("web_sessions"))[0];
  assert.equal(session.status, "converted");
  assert.ok(session.lead_id);
  return session;
}
const startedCount = async ctx => (await ctx.rows("web_events")).filter(e => e.event_name === "session_started").length;

sqlTest("migration is re-runnable and encodes the real schema, RLS, grants, indexes and realtime", async () => {
  await pg.exec(fs.readFileSync(WEB_MIGRATION, "utf8")); // second run over live objects
  const columns = table => pg.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [table]).then(r => r.rows.map(r => r.column_name));
  const sessionColumns = await columns("web_sessions");
  for (const expected of ["id", "owner_id", "token_hash", "reference_code", "intake_session_id", "lead_id", "conversation_id", "source", "entry_channel", "landing_path", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbp", "fbc", "consent_analytics", "consent_marketing", "status", "current_path", "current_stage", "last_event_name", "event_count", "started_at", "last_seen_at", "ended_at", "converted_at", "created_at", "updated_at"]) {
    assert.ok(sessionColumns.includes(expected), `web_sessions.${expected}`);
  }
  const eventColumns = await columns("web_events");
  for (const expected of ["id", "owner_id", "session_id", "event_id", "event_name", "stage", "path", "properties", "source", "occurred_at", "created_at"]) {
    assert.ok(eventColumns.includes(expected), `web_events.${expected}`);
  }
  for (const table of ["web_sessions", "web_events"]) {
    assert.equal((await pg.query(`select relrowsecurity from pg_class where oid='public.${table}'::regclass`)).rows[0].relrowsecurity, true);
    assert.equal((await pg.query("select count(*)::int as n from pg_policies where schemaname='public' and tablename=$1 and policyname='owner_all'", [table])).rows[0].n, 1);
    assert.equal((await pg.query("select has_table_privilege('anon',$1,'SELECT') as allowed", [`public.${table}`])).rows[0].allowed, false);
    assert.equal((await pg.query("select has_table_privilege('authenticated',$1,'SELECT') as allowed", [`public.${table}`])).rows[0].allowed, true);
    assert.equal((await pg.query("select has_table_privilege('service_role',$1,'INSERT') as allowed", [`public.${table}`])).rows[0].allowed, true);
  }
  const indexdef = Object.fromEntries((await pg.query("select indexname,indexdef from pg_indexes where schemaname='public'")).rows.map(r => [r.indexname, r.indexdef.toLowerCase()]));
  // Real index catalogue: exact names, ordering and partial uniqueness.
  for (const name of ["web_sessions_owner_last_seen_idx", "web_sessions_owner_started_idx", "web_sessions_intake_session_idx", "web_sessions_lead_idx", "web_sessions_conversation_idx", "web_events_session_occurred_idx", "web_events_owner_occurred_idx", "web_events_name_occurred_idx", "web_events_one_session_started_per_session_idx", "web_events_one_lead_created_per_session_idx"]) {
    assert.ok(indexdef[name], `index ${name}`);
  }
  assert.match(indexdef.web_events_one_session_started_per_session_idx, /unique.*\(session_id\).*session_started/);
  assert.match(indexdef.web_events_one_lead_created_per_session_idx, /unique.*\(session_id\).*lead_created/);
  assert.match(indexdef.web_events_event_id_key, /unique.*\(event_id\)/);
  assert.match(indexdef.web_sessions_reference_code_key, /unique.*\(reference_code\)/);
  assert.match(indexdef.web_sessions_owner_last_seen_idx, /owner_id, last_seen_at desc/);
  assert.match(indexdef.web_events_name_occurred_idx, /event_name, occurred_at desc/);
  assert.ok(!indexdef.web_sessions_owner_created, "only the real indexes are represented");

  assert.ok((await pg.query("select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='web_sessions'")).rows.length, "web_sessions realtime");
  assert.ok((await pg.query("select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='web_events'")).rows.length, "web_events realtime");
  const triggers = (await pg.query("select tgname from pg_trigger where tgrelid='public.web_events'::regclass and not tgisinternal")).rows.map(r => r.tgname);
  assert.deepEqual(triggers, ["trg_sync_web_session_from_event"]);
  const sessionTriggers = (await pg.query("select tgname from pg_trigger where tgrelid='public.web_sessions'::regclass and not tgisinternal")).rows.map(r => r.tgname);
  assert.deepEqual(sessionTriggers, ["web_sessions_updated_at"]);

  // Foreign keys and delete actions exactly as the real schema declares them.
  const fks = table => pg.query(`select conname, confdeltype from pg_constraint where conrelid = 'public.${table}'::regclass and contype = 'f'`)
    .then(r => Object.fromEntries(r.rows.map(row => [row.conname, row.confdeltype])));
  assert.deepEqual(await fks("web_sessions"), {
    web_sessions_owner_id_fkey: "c",
    web_sessions_intake_session_id_fkey: "n",
    web_sessions_lead_id_fkey: "n",
    web_sessions_conversation_id_fkey: "n",
  }, "owner cascades; intake/lead/conversation set null");
  assert.deepEqual(await fks("web_events"), {
    web_events_owner_id_fkey: "c",
    web_events_session_id_owner_id_fkey: "c",
  }, "composite (session_id, owner_id) cascade");
  const uniques = table => pg.query(`select conname from pg_constraint where conrelid = 'public.${table}'::regclass and contype = 'u'`)
    .then(r => r.rows.map(row => row.conname).sort());
  assert.deepEqual(await uniques("web_sessions"), ["web_sessions_id_owner_id_key", "web_sessions_reference_code_key", "web_sessions_token_hash_key"]);
  assert.deepEqual(await uniques("web_events"), ["web_events_event_id_key"]);

  // Column-level guarantees the application must never re-implement in code.
  const checks = table => pg.query("select conname from pg_constraint where conrelid = ($1)::regclass and contype = 'c'", [`public.${table}`]).then(r => r.rows.map(r => r.conname));
  for (const name of ["web_sessions_token_hash_check", "web_sessions_status_check", "web_sessions_event_count_check"]) {
    assert.ok((await checks("web_sessions")).includes(name), name);
  }
  for (const name of ["web_events_event_name_check", "web_events_properties_check", "web_events_source_check"]) {
    assert.ok((await checks("web_events")).includes(name), name);
  }

  // reference_code: NOT NULL, unique, and minted exclusively by the PostgreSQL default.
  const reference = (await pg.query("select column_default, is_nullable from information_schema.columns where table_schema='public' and table_name='web_sessions' and column_name='reference_code'")).rows[0];
  assert.equal(reference.is_nullable, "NO");
  assert.match(String(reference.column_default), /ECW-/);
  assert.match(String(reference.column_default), /gen_random_uuid/);
  const probeOwner = crypto.randomUUID();
  await pg.query("insert into auth.users values($1)", [probeOwner]);
  const probe = await pg.query("insert into web_sessions(owner_id, token_hash) values($1, $2) returning reference_code", [probeOwner, "e".repeat(64)]);
  assert.match(probe.rows[0].reference_code, /^ECW-[A-F0-9]{10}$/, "the default produces ECW- + 10 upper hex");
  await pg.query("delete from web_sessions where owner_id = $1", [probeOwner]);
  await pg.query("delete from auth.users where id = $1", [probeOwner]);
});

sqlTest("(lifecycle 1) create without a session mints one row, a PostgreSQL ECW- reference and session_started", async () => {
  const ctx = await setup();
  const response = await ctx.post(ctx.webRoute, {
    action: "create",
    attribution: { source: "meta_ads", entry_channel: "whatsapp", utm_source: " Facebook ", landing_path: "/proyecto?secret=x", referrer: "https://example.org/o?token=x", fbclid: "nope", fbp: "fb.1.169", fbc: "fb.1.169!BM.x" },
    consent: { analytics: true, marketing: true },
    current_path: "/proyecto", current_stage: "inicio",
  });
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.data).sort(), ["ok", "reference_code", "status"]);
  assert.equal(response.data.ok, true); assert.equal(response.data.status, "active");
  // Only PostgreSQL mints it: the application never sends reference_code on insert.
  assert.match(response.data.reference_code, /^ECW-[A-F0-9]{10}$/);

  const token = ctx.jar.get("ecw_web_session");
  assert.match(token, /^[a-f0-9]{64}$/);
  const cookie = ctx.set.find(c => c.name === "ecw_web_session");
  assert.deepEqual(copy(cookie.opts), { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  assert.equal(cookie.value, token);

  const sessions = await ctx.rows("web_sessions");
  assert.equal(sessions.length, 1);
  const session = sessions[0];
  const body = JSON.stringify(response.data);
  // reference_code is the only identifier meant for the browser; ids and the hash never travel.
  for (const secret of [session.id, session.owner_id, session.token_hash]) assert.ok(!body.includes(secret), "receipt leaks an internal id");
  assert.equal(session.token_hash, tokens.hashToken(token));
  assert.ok(!JSON.stringify(session).includes(token), "raw token persisted");
  assert.equal(session.reference_code, response.data.reference_code, "the receipt carries the value PostgreSQL generated");
  assert.equal(session.status, "active"); assert.equal(session.event_count, 1);
  assert.equal(session.consent_analytics, true); assert.equal(session.consent_marketing, true);
  assert.equal(session.fbp, "fb.1.169"); assert.equal(session.fbc, "fb.1.169!BM.x");
  assert.equal(session.source, "meta_ads"); assert.equal(session.entry_channel, "web");
  assert.equal(session.landing_path, "/proyecto"); assert.equal(session.referrer, "https://example.org/o");
  assert.equal(session.utm_source, "facebook");
  assert.equal(session.current_path, "/proyecto"); assert.equal(session.current_stage, "inicio");
  assert.equal(session.lead_id, null); assert.equal(session.intake_session_id, null); assert.equal(session.converted_at, null);

  const events = await ctx.rows("web_events");
  assert.equal(events.length, 1);
  assert.equal(events[0].event_name, "session_started"); assert.equal(events[0].source, "server");
  assert.equal(session.last_event_name, "session_started"); assert.ok(events[0].occurred_at);
});

sqlTest("(lifecycle 2) create with a recent cookie reuses the same row and never duplicates session_started", async () => {
  const ctx = await setup();
  const first = await ctx.post(ctx.webRoute, { action: "create" });
  const token = ctx.jar.get("ecw_web_session");
  const second = await ctx.post(ctx.webRoute, { action: "create", current_path: "/segunda", consent: { analytics: true, marketing: false } });
  assert.equal(second.status, 200);
  assert.equal(second.data.reference_code, first.data.reference_code);
  assert.equal(ctx.jar.get("ecw_web_session"), token, "cookie must not rotate");

  const sessions = await ctx.rows("web_sessions");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].current_path, "/segunda");
  assert.equal(sessions[0].consent_analytics, true); assert.equal(sessions[0].consent_marketing, false);
  assert.equal(sessions[0].event_count, 1);
  const started = (await ctx.rows("web_events")).filter(e => e.event_name === "session_started");
  assert.equal(started.length, 1);

  ctx.jar.delete("ecw_web_session");
  const fresh = await ctx.post(ctx.webRoute, { action: "create" });
  assert.equal(fresh.status, 201);
  assert.equal((await ctx.rows("web_sessions")).length, 2);
  assert.equal((await ctx.rows("web_events")).filter(e => e.event_name === "session_started").length, 2);
});

sqlTest("client events are allowlisted, deduped by event_id and folded onto the session by the trigger", async () => {
  const ctx = await setup(); await start(ctx);
  const eventId = crypto.randomUUID();
  const first = await ctx.post(ctx.webRoute, { action: "event", event_name: "stage_viewed", event_id: eventId, stage: "diagnostico", path: "/diagnostico?email=ana@example.com", properties: { previous_stage: "inicio" } });
  assert.equal(first.status, 200); assert.deepEqual(copy(first.data), { ok: true });
  const retry = await ctx.post(ctx.webRoute, { action: "event", event_name: "stage_viewed", event_id: eventId, stage: "diagnostico" });
  assert.equal(retry.status, 200); // idempotent replay

  const stageEvents = (await ctx.rows("web_events")).filter(e => e.event_name === "stage_viewed");
  assert.equal(stageEvents.length, 1, "event_id is unique per session");
  assert.equal(stageEvents[0].source, "client");
  assert.equal(stageEvents[0].path, "/diagnostico");
  assert.deepEqual(copy(stageEvents[0].properties), { previous_stage: "inicio" });
  assert.ok(!JSON.stringify(stageEvents[0]).includes("ana@example.com"));

  const session = (await ctx.rows("web_sessions"))[0];
  assert.equal(session.current_stage, "diagnostico");
  assert.equal(session.current_path, "/diagnostico");
  assert.equal(session.last_event_name, "stage_viewed");
  assert.equal(session.event_count, 2); // session_started + one deduped stage_viewed

  assert.equal((await ctx.post(ctx.webRoute, { action: "event", event_name: "lead_created", event_id: crypto.randomUUID() })).status, 400);
  assert.equal((await ctx.post(ctx.webRoute, { action: "event", event_name: "session_started", event_id: crypto.randomUUID() })).status, 400);
  assert.equal((await ctx.post(ctx.webRoute, { action: "event", event_name: "page_viewed", event_id: crypto.randomUUID() })).status, 400);
  assert.equal((await ctx.post(ctx.webRoute, { action: "event", event_name: "stage_viewed", event_id: "nope" })).status, 400);
  assert.equal((await ctx.post(ctx.webRoute, { action: "event", event_name: "contact_details_submitted", event_id: crypto.randomUUID(), properties: { name: "Ana" } })).status, 400);
  assert.equal((await ctx.rows("web_events")).filter(e => e.event_name !== "session_started").length, 1);

  const flags = await ctx.post(ctx.webRoute, { action: "event", event_name: "contact_details_submitted", event_id: crypto.randomUUID(), properties: { has_name: true, has_whatsapp: true, has_email: false } });
  assert.equal(flags.status, 200);
  const stored = (await ctx.rows("web_events")).find(e => e.event_name === "contact_details_submitted");
  assert.deepEqual(copy(stored.properties), { has_name: true, has_whatsapp: true, has_email: false });
  assert.equal(stored.source, "client");
  assert.equal((await ctx.rows("web_sessions"))[0].event_count, 3);

  const ended = await ctx.post(ctx.webRoute, { action: "event", event_name: "session_ended", event_id: crypto.randomUUID() });
  assert.equal(ended.status, 200);
  const finalSession = (await ctx.rows("web_sessions"))[0];
  assert.equal(finalSession.status, "ended"); assert.ok(finalSession.ended_at);
});

sqlTest("heartbeat updates liveness and consent without ever creating an event, and throttles repeats", async () => {
  const ctx = await setup(); await start(ctx);
  assert.equal((await ctx.rows("web_events")).length, 1);

  const throttled = await ctx.post(ctx.webRoute, { action: "heartbeat", current_path: "/throttled", consent: { analytics: true, marketing: true } });
  assert.equal(throttled.status, 200); assert.deepEqual(copy(throttled.data), { ok: true });
  let session = (await ctx.rows("web_sessions"))[0];
  assert.equal(session.current_path, "/proyecto", "a throttled heartbeat writes nothing");
  assert.equal(session.consent_analytics, false);

  await pg.query("update web_sessions set last_seen_at = now() - interval '1 minute' where owner_id = $1", [ctx.owner]);
  const beat = await ctx.post(ctx.webRoute, { action: "heartbeat", current_path: "/diagnostico", current_stage: "diagnostico", consent: { analytics: true, marketing: false } });
  assert.equal(beat.status, 200);
  session = (await ctx.rows("web_sessions"))[0];
  assert.equal(session.current_path, "/diagnostico");
  assert.equal(session.current_stage, "diagnostico");
  assert.equal(session.consent_analytics, true); assert.equal(session.consent_marketing, false);
  assert.equal((await ctx.rows("web_events")).length, 1, "heartbeat never records an event");
  assert.equal(session.event_count, 1);
  assert.ok(Date.parse(session.last_seen_at) > Date.now() - 60_000);

  // An unknown/foreign cookie can never touch a session.
  ctx.jar.set("ecw_web_session", "f".repeat(64));
  assert.equal((await ctx.post(ctx.webRoute, { action: "heartbeat", current_path: "/stolen" })).status, 400);
  assert.equal((await ctx.post(ctx.webRoute, { action: "event", event_name: "stage_viewed", event_id: crypto.randomUUID() })).status, 400);
  assert.equal((await ctx.rows("web_sessions"))[0].current_path, "/diagnostico");
});

sqlTest("intake create links both cookies and never exposes intake_session_id to the browser", async () => {
  const ctx = await setup();
  const created = await start(ctx);

  const intake = (await ctx.rows("intake_sessions"))[0];
  const session = (await ctx.rows("web_sessions"))[0];
  assert.ok(intake, "intake session created");
  assert.equal(session.intake_session_id, intake.id, "web session points at the real intake session");
  assert.equal(session.lead_id, null);

  const body = JSON.stringify(created.data);
  assert.ok(!body.includes(intake.id), "intake session id leaked");
  assert.ok(!("intake_session_id" in created.data));
  assert.ok(!("id" in created.data));

  // A repeated create with the same intake cookie reuses the session and keeps the link untouched.
  const again = await ctx.post(ctx.intakeRoute, { action: "create" }, "/api/intake/session");
  assert.equal(again.status, 200);
  assert.equal((await ctx.rows("intake_sessions")).length, 1);
  assert.equal((await ctx.rows("web_sessions"))[0].intake_session_id, intake.id);

  // Without the web cookie intake keeps working; the link simply stays where it was.
  ctx.jar.delete("ecw_web_session");
  ctx.jar.delete("ecw_intake");
  const isolated = await ctx.post(ctx.intakeRoute, { action: "create" }, "/api/intake/session");
  assert.equal(isolated.status, 201);
  assert.equal((await ctx.rows("intake_sessions")).length, 2);
  assert.equal((await ctx.rows("web_sessions"))[0].intake_session_id, intake.id);
});

sqlTest("finalize materializes the lead, converts the web session and records lead_created once", async () => {
  const ctx = await setup(); await start(ctx);
  await ctx.intake.saveSessionAnswer(ctx.jar.get("ecw_intake"), complete);
  const finalized = await ctx.post(ctx.intakeRoute, { action: "finalize" }, "/api/intake/session");
  assert.equal(finalized.status, 200);
  assert.equal(finalized.data.materialized, true);

  const lead = (await ctx.rows("leads"))[0];
  const session = (await ctx.rows("web_sessions"))[0];
  assert.equal(session.lead_id, lead.id);
  assert.equal(session.status, "converted");
  assert.ok(session.converted_at);
  assert.equal(session.intake_session_id, (await ctx.rows("intake_sessions"))[0].id);

  const leadCreated = (await ctx.rows("web_events")).filter(e => e.event_name === "lead_created");
  assert.equal(leadCreated.length, 1);
  assert.equal(leadCreated[0].source, "server");
  assert.equal(leadCreated[0].session_id, session.id);
  assert.equal(leadCreated[0].event_id.length, 36);
  assert.equal((await ctx.rows("web_events")).filter(e => e.event_name === "session_started").length, 1);
  assert.equal((await ctx.rows("web_sessions")).length, 1);
  assert.equal((await ctx.rows("leads")).length, 1);

  assert.ok(!JSON.stringify(finalized.data).includes(lead.id), "receipt leaks the lead id");
  assert.ok(!("lead_id" in finalized.data));

  // Repeated finalize is idempotent for both CRM and tracking.
  const repeated = await ctx.post(ctx.intakeRoute, { action: "finalize" }, "/api/intake/session");
  assert.equal(repeated.data.materialized, true);
  assert.equal((await ctx.rows("web_events")).filter(e => e.event_name === "lead_created").length, 1);
  assert.equal((await ctx.rows("leads")).length, 1);
});

sqlTest("a failing lead_created insert never breaks finalize and a retry repairs the tracking", async () => {
  const ctx = await setup(); await start(ctx);
  await ctx.intake.saveSessionAnswer(ctx.jar.get("ecw_intake"), complete);
  await pg.exec(`create function public.test_fail_web_event() returns trigger language plpgsql as $$
    begin raise exception 'test_tracking_failure'; end; $$;
    create trigger test_fail_web_event before insert on web_events for each row execute function public.test_fail_web_event();`);
  try {
    const broken = await ctx.post(ctx.intakeRoute, { action: "finalize" }, "/api/intake/session");
    assert.equal(broken.status, 200, "tracking failure must not fail the intake response");
    assert.equal(broken.data.materialized, true);
    const lead = (await ctx.rows("leads"))[0];
    const session = (await ctx.rows("web_sessions"))[0];
    assert.equal(session.lead_id, lead.id, "the link itself still lands");
    assert.equal(session.status, "converted", "the row conversion is written before the event");
    assert.ok(session.converted_at);
    assert.equal((await ctx.rows("web_events")).filter(e => e.event_name === "lead_created").length, 0);
    assert.equal((await ctx.rows("tasks")).length, 1);
  } finally {
    await pg.exec("drop trigger test_fail_web_event on web_events; drop function public.test_fail_web_event();");
  }

  const repaired = await ctx.post(ctx.intakeRoute, { action: "finalize" }, "/api/intake/session");
  assert.equal(repaired.status, 200);
  assert.equal(repaired.data.materialized, true);
  const events = (await ctx.rows("web_events")).filter(e => e.event_name === "lead_created");
  assert.equal(events.length, 1, "retry with an existing lead_id repairs the missing event");
  const session = (await ctx.rows("web_sessions"))[0];
  assert.equal(session.status, "converted"); assert.ok(session.converted_at);
  assert.equal((await ctx.rows("leads")).length, 1);
  assert.equal((await ctx.rows("tasks")).length, 1);
});

sqlTest("a failing web_session update also leaves finalize intact and repairable", async () => {
  const ctx = await setup(); await start(ctx);
  await ctx.intake.saveSessionAnswer(ctx.jar.get("ecw_intake"), complete);
  const linkedIntake = (await ctx.rows("web_sessions"))[0].intake_session_id;
  await pg.exec(`create function public.test_fail_web_session() returns trigger language plpgsql as $$
    begin raise exception 'test_session_update_failure'; end; $$;
    create trigger test_fail_web_session before update on web_sessions for each row execute function public.test_fail_web_session();`);
  try {
    const broken = await ctx.post(ctx.intakeRoute, { action: "finalize" }, "/api/intake/session");
    assert.equal(broken.status, 200, "tracking failure must not fail the intake response");
    assert.equal(broken.data.materialized, true);
    const session = (await ctx.rows("web_sessions"))[0];
    assert.equal(session.lead_id, null, "conversion write failed and was swallowed");
    assert.equal((await ctx.rows("web_events")).filter(e => e.event_name === "lead_created").length, 0);
    assert.equal(session.intake_session_id, linkedIntake, "the earlier link is preserved");
    assert.equal((await ctx.rows("leads")).length, 1);
  } finally {
    await pg.exec("drop trigger test_fail_web_session on web_sessions; drop function public.test_fail_web_session();");
  }

  const repaired = await ctx.post(ctx.intakeRoute, { action: "finalize" }, "/api/intake/session");
  assert.equal(repaired.status, 200);
  assert.equal(repaired.data.materialized, true);
  const lead = (await ctx.rows("leads"))[0];
  const session = (await ctx.rows("web_sessions"))[0];
  assert.equal(session.lead_id, lead.id);
  assert.equal(session.status, "converted");
  assert.equal((await ctx.rows("web_events")).filter(e => e.event_name === "lead_created").length, 1);
  assert.equal((await ctx.rows("tasks")).length, 1);
});

sqlTest("(lifecycle 3) after session_ended a create opens a new row, token, reference and session_started", async () => {
  const ctx = await setup();
  const first = await ctx.post(ctx.webRoute, { action: "create" });
  assert.equal(first.status, 201);
  const firstToken = ctx.jar.get("ecw_web_session");
  assert.equal((await ctx.post(ctx.webRoute, { action: "event", event_name: "session_ended", event_id: crypto.randomUUID() })).status, 200);
  assert.equal((await ctx.rows("web_sessions"))[0].status, "ended");

  const second = await ctx.post(ctx.webRoute, { action: "create" });
  assert.equal(second.status, 201, "an ended session is never reactivated");
  const secondToken = ctx.jar.get("ecw_web_session");
  assert.notEqual(secondToken, firstToken, "a new session token");
  assert.notEqual(second.data.reference_code, first.data.reference_code, "a new reference_code");

  const sessions = await ctx.rows("web_sessions");
  assert.equal(sessions.length, 2);
  const closed = sessions.find(s => s.reference_code === first.data.reference_code);
  const fresh = sessions.find(s => s.reference_code === second.data.reference_code);
  assert.notEqual(fresh.id, closed.id);
  assert.equal(closed.status, "ended"); assert.ok(closed.ended_at);
  assert.equal(closed.token_hash, tokens.hashToken(firstToken), "the historical row keeps its identity");
  assert.equal(fresh.status, "active"); assert.equal(fresh.ended_at, null);
  assert.equal(fresh.token_hash, tokens.hashToken(secondToken));
  assert.equal(await startedCount(ctx), 2, "one session_started per visit");
});

sqlTest("(lifecycle 4) a session idle for 30 minutes or more is closed best-effort and replaced", async () => {
  const ctx = await setup();
  const first = await ctx.post(ctx.webRoute, { action: "create" });
  assert.equal(first.status, 201);
  const firstToken = ctx.jar.get("ecw_web_session");
  await pg.query("update web_sessions set last_seen_at = now() - interval '31 minutes' where owner_id = $1", [ctx.owner]);

  const second = await ctx.post(ctx.webRoute, { action: "create" });
  assert.equal(second.status, 201, "an idle session is not reused");
  assert.notEqual(ctx.jar.get("ecw_web_session"), firstToken, "a new session token");
  assert.notEqual(second.data.reference_code, first.data.reference_code, "a new reference_code");

  const sessions = await ctx.rows("web_sessions");
  assert.equal(sessions.length, 2);
  const stale = sessions.find(s => s.reference_code === first.data.reference_code);
  const fresh = sessions.find(s => s.reference_code === second.data.reference_code);
  assert.equal(stale.status, "ended", "a stale-but-open row is closed before the new visit");
  assert.equal(new Date(stale.ended_at).getTime(), new Date(stale.last_seen_at).getTime(), "ended_at = coalesce(ended_at, last_seen_at)");
  assert.equal(stale.lead_id, null);
  assert.equal(fresh.status, "active");
  assert.equal(await startedCount(ctx), 2);
});

sqlTest("(lifecycle 5) a freshly converted session is reused and never downgraded", async () => {
  const ctx = await setup();
  const converted = await convert(ctx);
  const token = ctx.jar.get("ecw_web_session");

  const again = await ctx.post(ctx.webRoute, { action: "create", current_path: "/precios" });
  assert.equal(again.status, 200, "converted + recent last_seen_at = the same visit");
  assert.equal(again.data.reference_code, converted.reference_code);
  assert.equal(again.data.status, "converted");
  assert.equal(ctx.jar.get("ecw_web_session"), token, "the cookie is not rotated");

  const sessions = await ctx.rows("web_sessions");
  assert.equal(sessions.length, 1, "no second row while the visit is fresh");
  assert.equal(sessions[0].status, "converted");
  assert.equal(sessions[0].lead_id, converted.lead_id);
  assert.ok(sessions[0].converted_at);
  assert.equal(sessions[0].current_path, "/precios");
  assert.equal(await startedCount(ctx), 1, "session_started is not duplicated");
});

sqlTest("(lifecycle 6) a stale converted session stays historical while a new visit starts", async () => {
  const ctx = await setup();
  const old = await convert(ctx);
  const oldToken = ctx.jar.get("ecw_web_session");
  await pg.query("update web_sessions set last_seen_at = now() - interval '45 minutes' where owner_id = $1", [ctx.owner]);

  const next = await ctx.post(ctx.webRoute, { action: "create" });
  assert.equal(next.status, 201, "converted + stale last_seen_at = a new visit");
  assert.notEqual(ctx.jar.get("ecw_web_session"), oldToken, "a new session token");
  assert.notEqual(next.data.reference_code, old.reference_code, "a new reference_code");

  const sessions = await ctx.rows("web_sessions");
  assert.equal(sessions.length, 2);
  const historical = sessions.find(s => s.reference_code === old.reference_code);
  const fresh = sessions.find(s => s.reference_code === next.data.reference_code);
  assert.notEqual(fresh.id, historical.id);
  assert.equal(historical.lead_id, old.lead_id, "the historical visit keeps its lead");
  assert.ok(historical.converted_at, "the historical visit keeps its conversion timestamp");
  assert.equal(historical.status, "ended", "the stale visit is closed, never reactivated");
  assert.ok(historical.ended_at);
  assert.equal(fresh.status, "active");
  assert.equal(fresh.lead_id, null); assert.equal(fresh.converted_at, null);
  assert.equal(fresh.intake_session_id, null, "the new visit starts unlinked");
  assert.equal(await startedCount(ctx), 2);
});

sqlTest("(lifecycle 7) ensureSessionStarted is idempotent across repeated creates", async () => {
  const ctx = await setup();
  assert.equal((await ctx.post(ctx.webRoute, { action: "create" })).status, 201);
  for (let i = 0; i < 3; i++) {
    assert.equal((await ctx.post(ctx.webRoute, { action: "create" })).status, 200, "the same visit keeps being reused");
  }
  const sessions = await ctx.rows("web_sessions");
  assert.equal(sessions.length, 1, "repeats never mint rows");
  assert.equal(sessions[0].event_count, 1);
  assert.equal(await startedCount(ctx), 1, "the partial unique index absorbs every retry");
});

sqlTest("(lifecycle 8) a failing session_started never cascades sessions and is repaired later", async () => {
  const ctx = await setup();
  await pg.exec(`create function public.test_fail_started() returns trigger language plpgsql as $$
    begin
      if new.event_name = 'session_started' then raise exception 'test_session_started_failure'; end if;
      return new;
    end; $$;
    create trigger test_fail_started before insert on web_events for each row execute function public.test_fail_started();`);
  try {
    const first = await ctx.post(ctx.webRoute, { action: "create" });
    assert.equal(first.status, 201, "a tracking failure never fails the session identity");
    assert.deepEqual(Object.keys(first.data).sort(), ["ok", "reference_code", "status"], "no internal error detail reaches the browser");
    const firstToken = ctx.jar.get("ecw_web_session");
    assert.match(firstToken, /^[a-f0-9]{64}$/, "the identity cookie is still delivered");
    assert.equal((await ctx.rows("web_sessions")).length, 1);
    assert.equal((await ctx.rows("web_events")).length, 0, "the event insert failed");

    const second = await ctx.post(ctx.webRoute, { action: "create" });
    assert.equal(second.status, 200, "the existing identity is reused instead of replaced");
    assert.equal(ctx.jar.get("ecw_web_session"), firstToken, "no cookie rotation");
    assert.equal(second.data.reference_code, first.data.reference_code);
    assert.equal((await ctx.rows("web_sessions")).length, 1, "no orphan row cascade");
  } finally {
    await pg.exec("drop trigger test_fail_started on web_events; drop function public.test_fail_started();");
  }

  const healed = await ctx.post(ctx.webRoute, { action: "create" });
  assert.equal(healed.status, 200);
  assert.equal((await ctx.rows("web_sessions")).length, 1, "still a single session");
  assert.equal(await startedCount(ctx), 1, "the retried ensureSessionStarted repaired the missing event");
  assert.equal((await ctx.rows("web_sessions"))[0].event_count, 1);
});
