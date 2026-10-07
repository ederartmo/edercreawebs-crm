// Production service + webhook against local PostgreSQL (no network/provider).
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { load, copy } from "./test-helpers/proposal-fixture.mjs";

const d = load("src/lib/intake/domain.ts", {});
const tokens = load("src/lib/intake/tokens.ts", { "node:crypto": crypto });
const enabled = Boolean(process.env.ECW_PGLITE_MODULE);
let pg;
before(async () => {
  if (!enabled) return;
  const { PGlite } = await import(pathToFileURL(process.env.ECW_PGLITE_MODULE).href);
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';`);
  for (const name of ["20260705000100_baseline_current_public_schema", "20260927000100_whatsapp_handoff_task", "20260927000200_whatsapp_agent_v2_handoff_task", "20261005210820_intake_v1"]) {
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
              let sql = `select * from ${identifier(table)}`;
              if (operation === "insert") sql = `insert into ${identifier(table)}(${Object.keys(payload).map(identifier).join(",")}) values(${Object.values(payload).map(bind).join(",")})`;
              if (operation === "update") sql = `update ${identifier(table)} set ${Object.entries(payload).map(([k, v]) => `${identifier(k)}=${bind(v)}`).join(",")}`;
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
const firstTouch = { source: "meta_ads", entry_channel: "web", utm_source: "facebook", utm_medium: "paid", utm_campaign: "First", utm_content: "creative", utm_term: "term", landing_path: "/proyecto", referrer: "https://example.org/origin", fbclid: "first-click", source_id: "123", ctwa_clid: "existing-click" };

async function setup() {
  const owner = crypto.randomUUID(), db = sqlClient();
  await pg.query("insert into auth.users values($1)", [owner]);
  const env = { CRM_OWNER_ID: owner, NEXT_PUBLIC_SUPABASE_URL: "https://ycdosrsanutbhbgejwwg.supabase.co", META_APP_SECRET: "local-test-placeholder", WHATSAPP_PHONE_NUMBER_ID: "phone-id" };
  const service = load("src/lib/intake/service.ts", { "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db }, "./domain": d, "./tokens": tokens }, env);
  const { token } = await service.createIntakeSession(firstTouch);
  const rows = table => pg.query(`select * from ${table} where owner_id=$1`, [owner]).then(r => r.rows);
  const saveComplete = (answers = complete) => service.saveSessionAnswer(token, answers);
  const finish = async (answers = complete) => {
    await saveComplete(answers);
    return service.finalizeIntakeSession(token);
  };
  return { owner, db, env, service, token, rows, saveComplete, finish };
}
function webhook(ctx) {
  const replies = [];
  let providerCalls = 0;
  const agent = load("src/lib/whatsapp/sales-agent.ts", {
    "next/server": { after() { throw Error("No enrichment expected"); } },
    "@/lib/intake/domain": d, "@/lib/intake/service": ctx.service,
    "@/lib/supabase/admin": { createAdminClient: () => ctx.db }, "@/lib/whatsapp/asset-enrichment": {},
  }, ctx.env, async () => { providerCalls++; throw Error("No model call expected"); });
  const route = load("src/app/api/whatsapp/webhook/route.ts", {
    "next/server": { NextResponse: { json: (data, opts = {}) => ({ data, status: opts.status ?? 200 }) } },
    "@/lib/intake/domain": d, "@/lib/intake/tokens": tokens, "@/lib/intake/service": ctx.service,
    "@/lib/supabase/admin": { createAdminClient: () => ctx.db },
    "@/lib/whatsapp/admin-alert": { notifyAdminOfWhatsAppHandoff: async () => {} }, "@/lib/whatsapp/audio": {},
    "@/lib/whatsapp/sales-agent": agent,
    "@/lib/whatsapp/cloud": { verifyMetaWebhookSignature: () => true, isWhatsAppSendConfigured: () => true, sendWhatsAppText: async (_phone, body) => { replies.push(body); return crypto.randomUUID(); } },
  }, ctx.env);
  return {
    replies, providerCalls: () => providerCalls,
    async send(text, phone = complete.whatsapp) {
      const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-id" }, messages: [{ id: crypto.randomUUID(), from: phone, type: "text", text: { body: text }, referral: { source_type: "ad", source_id: "later", ctwa_clid: "later-click" } }] } }] }] };
      return route.POST(new Request("https://example.com/api/whatsapp/webhook", { method: "POST", body: JSON.stringify(body) }));
    },
  };
}

sqlTest("1. web-only readiness creates contact, business and lead in CRM", async () => {
  const ctx = await setup(); const receipt = await ctx.finish();
  assert.equal(receipt.ready_for_quote, true); assert.equal(receipt.linked, true);
  for (const table of ["contacts", "businesses", "leads"]) assert.equal((await ctx.rows(table)).length, 1);
  const lead = (await ctx.rows("leads"))[0];
  assert.equal(lead.what_sells, complete.what_sells); assert.equal(lead.intake.ready_for_quote, true);
  assert.equal(lead.human_required, true); assert.equal(lead.bot_mode, "paused"); assert.equal(lead.status, "nuevo");
  assert.equal((await ctx.rows("contacts"))[0].phone, null); // declared value is not verified transport
  assert.equal((await ctx.service.getLeadIntake(lead.id)).ready_for_quote, true);
});
sqlTest("save and GET keep a complete session staged until explicit finalize", async () => {
  const ctx = await setup();
  const saved = await ctx.saveComplete();
  assert.equal(saved.ready_for_quote, true); assert.equal(saved.materialized, false); assert.equal(saved.status, "complete");
  const reloaded = await ctx.service.getIntakeSession(ctx.token);
  assert.equal(reloaded.ready_for_quote, true); assert.equal(reloaded.materialized, false);
  for (const table of ["contacts", "businesses", "leads", "tasks"]) assert.equal((await ctx.rows(table)).length, 0);
});
sqlTest("finalize rejects incomplete sessions without CRM side effects", async () => {
  const ctx = await setup(); const partial = { ...complete }; delete partial.timing;
  await ctx.saveComplete(partial);
  const result = await ctx.service.finalizeIntakeSession(ctx.token);
  assert.equal(result.ready_for_quote, false); assert.equal(result.materialized, false); assert.ok(result.missing_fields.includes("timing"));
  for (const table of ["contacts", "businesses", "leads", "tasks"]) assert.equal((await ctx.rows(table)).length, 0);
});
sqlTest("explicit edit replaces one staged answer, preserves others, recalculates readiness, and finalize uses the edit", async () => {
  const ctx = await setup(); await ctx.saveComplete();
  const ordinary = await ctx.service.saveSessionAnswer(ctx.token, { what_sells: "Normal save must remain fill-only" });
  assert.equal(ordinary.known_fields.what_sells, complete.what_sells);

  const replacement = "Creo sistemas web para PyMEs";
  const edited = await ctx.service.editSessionAnswer(ctx.token, "what_sells", replacement);
  assert.equal(edited.known_fields.what_sells, replacement);
  assert.equal(edited.known_fields.main_goal, complete.main_goal);
  assert.equal(edited.known_fields.budget_range, complete.budget_range);
  assert.deepEqual((await ctx.rows("intake_sessions"))[0].answers.what_sells, replacement);

  await assert.rejects(ctx.service.editSessionAnswer(ctx.token, "budget_range", "25k_30k"), /invalid_intake_edit/);
  assert.equal((await ctx.service.getIntakeSession(ctx.token)).known_fields.what_sells, replacement);
  const incomplete = await ctx.service.editSessionAnswer(ctx.token, "what_sells", "");
  assert.equal(incomplete.ready_for_quote, false); assert.ok(incomplete.missing_fields.includes("what_sells"));
  const restored = await ctx.service.editSessionAnswer(ctx.token, "what_sells", replacement);
  assert.equal(restored.ready_for_quote, true);

  await ctx.service.finalizeIntakeSession(ctx.token);
  await ctx.service.finalizeIntakeSession(ctx.token);
  const lead = (await ctx.rows("leads"))[0];
  assert.equal(lead.what_sells, replacement);
  assert.equal((await ctx.rows("leads")).length, 1); assert.equal((await ctx.rows("tasks")).length, 1);
  await assert.rejects(ctx.service.editSessionAnswer(ctx.token, "what_sells", "After finalize"), /intake_session_materialized/);
  assert.equal((await ctx.rows("leads"))[0].what_sells, replacement);
  assert.equal((await ctx.rows("tasks")).length, 1);
});
sqlTest("finalize creates the lead and review task, and repeated finalize reuses both", async () => {
  const ctx = await setup(); await ctx.saveComplete();
  const [first, second] = await Promise.all([ctx.service.finalizeIntakeSession(ctx.token), ctx.service.finalizeIntakeSession(ctx.token)]);
  assert.equal(first.materialized, true); assert.equal(second.materialized, true);
  assert.equal((await ctx.rows("leads")).length, 1); assert.equal((await ctx.rows("tasks")).length, 1);
  assert.equal((await ctx.rows("tasks"))[0].title, "Revisar proyecto y preparar cotización");
  assert.equal((await ctx.rows("intake_sessions"))[0].lead_id, (await ctx.rows("leads"))[0].id);
});
sqlTest("a materialized legacy session remains a receipt and save is a safe no-op", async () => {
  const ctx = await setup(); await ctx.finish();
  const receipt = await ctx.service.getIntakeSession(ctx.token);
  assert.equal(receipt.materialized, true); assert.equal(receipt.ready_for_quote, true);
  const afterSave = await ctx.service.saveSessionAnswer(ctx.token, { timing: "Changed after finalization" });
  const afterFinalize = await ctx.service.finalizeIntakeSession(ctx.token);
  assert.equal(afterSave.materialized, true); assert.equal(afterFinalize.materialized, true);
  assert.equal((await ctx.rows("leads")).length, 1); assert.equal((await ctx.rows("tasks")).length, 1);
  assert.equal((await ctx.rows("leads"))[0].intake.answers.timing, "Octubre");
});
sqlTest("2. web-only creates Eder review task without conversation/WhatsApp", async () => {
  const ctx = await setup(); await ctx.finish();
  const task = (await ctx.rows("tasks"))[0];
  assert.equal(task.title, "Revisar proyecto y preparar cotización"); assert.equal(task.status, "pending");
  assert.ok(task.due_at); assert.equal(task.priority, "high");
  assert.equal(task.lead_id, (await ctx.rows("leads"))[0].id); assert.equal((await ctx.rows("conversations")).length, 0);
});
sqlTest("3. repeated/concurrent final submits and reload reuse contact/business/lead", async () => {
  const ctx = await setup(); await Promise.all([ctx.finish(), ctx.finish(), ctx.finish()]);
  await ctx.service.getIntakeSession(ctx.token); await ctx.finish();
  for (const table of ["contacts", "businesses", "leads"]) assert.equal((await ctx.rows(table)).length, 1);
});
sqlTest("4. final submit and reload never duplicate the task", async () => {
  const ctx = await setup(); await ctx.finish(); await ctx.finish(); await ctx.service.getIntakeSession(ctx.token);
  assert.equal((await ctx.rows("tasks")).length, 1);
});
sqlTest("5. materialization links the session and clears staging; receipt exposes no CRM IDs", async () => {
  const ctx = await setup(); const receipt = await ctx.finish();
  const session = (await ctx.rows("intake_sessions"))[0], lead = (await ctx.rows("leads"))[0];
  assert.equal(session.lead_id, lead.id); assert.ok(session.materialized_at); assert.deepEqual(session.answers, {});
  assert.ok(!JSON.stringify(receipt).includes(lead.id)); assert.equal(receipt.known_fields, undefined);
});
sqlTest("6. source and all first-touch attribution arrive at the web lead", async () => {
  const ctx = await setup(); await ctx.finish();
  const lead = (await ctx.rows("leads"))[0]; assert.equal(lead.source, "meta_ads");
  assert.deepEqual(lead.intake.first_touch, firstTouch);
});
sqlTest("7. ECW issued after web completion resolves the same lead and verifies its phone", async () => {
  const ctx = await setup(); await ctx.finish(); const lead = (await ctx.rows("leads"))[0];
  const { message } = await ctx.service.issueContinuation(ctx.token), code = tokens.extractContinuationCode(message);
  assert.equal(await ctx.service.resolveIntakeContinuation(code, complete.whatsapp), lead.id);
  assert.equal((await ctx.rows("contacts"))[0].phone, complete.whatsapp);
  assert.equal((await ctx.rows("leads"))[0].intake.answers.whatsapp, undefined);
});
sqlTest("8. production webhook never creates another lead for a completed web ECW", async () => {
  const ctx = await setup(); await ctx.finish(); const lead = (await ctx.rows("leads"))[0];
  const { message } = await ctx.service.issueContinuation(ctx.token);
  const wa = webhook(ctx); assert.equal((await wa.send(message)).status, 200);
  assert.equal((await ctx.rows("leads")).length, 1);
  assert.equal((await ctx.rows("messages"))[0].lead_id, lead.id);
  assert.deepEqual((await ctx.rows("leads"))[0].intake.first_touch, firstTouch);
  assert.equal((await ctx.rows("leads"))[0].intake.last_referral.ctwa_clid, "later-click");
  assert.equal((await ctx.rows("tasks")).length, 1);
});
sqlTest("9. ready web lead enters WhatsApp without interrogation or provider call", async () => {
  const ctx = await setup(); await ctx.finish(); const { message } = await ctx.service.issueContinuation(ctx.token);
  const wa = webhook(ctx); const response = await wa.send(message);
  assert.equal(response.data.handoffs, 1); assert.equal(wa.providerCalls(), 0);
  assert.equal(wa.replies[0], d.READY_REPLY); assert.ok(!wa.replies[0].includes("?"));
  assert.equal((await ctx.rows("conversations"))[0].bot_paused, true);
});
sqlTest("10. incomplete web session stays staged without contact/lead/business/task", async () => {
  const ctx = await setup(); const partial = { ...complete }; delete partial.timing;
  const state = await ctx.service.saveSessionAnswer(ctx.token, partial); assert.equal(state.ready_for_quote, false);
  await ctx.service.getIntakeSession(ctx.token);
  for (const table of ["contacts", "businesses", "leads", "tasks"]) assert.equal((await ctx.rows(table)).length, 0);
});
sqlTest("email-only readiness materializes without fake phone and can later bind signed WhatsApp", async () => {
  const ctx = await setup(); const emailOnly = { ...complete }; delete emailOnly.whatsapp;
  const saved = await ctx.service.saveSessionAnswer(ctx.token, emailOnly);
  assert.equal(saved.ready_for_quote, true); assert.equal(saved.materialized, false);
  assert.equal((await ctx.rows("leads")).length, 0);
  await ctx.service.finalizeIntakeSession(ctx.token);
  const lead = (await ctx.rows("leads"))[0];
  const contact = (await ctx.rows("contacts"))[0];
  assert.equal(contact.phone, null);
  const { message } = await ctx.service.issueContinuation(ctx.token);
  const wa = webhook(ctx);
  assert.equal((await wa.send(message)).status, 200);
  assert.equal((await wa.send(message)).status, 200);
  const contacts = await ctx.rows("contacts"), leads = await ctx.rows("leads");
  assert.equal(contacts.length, 1); assert.equal(leads.length, 1);
  assert.equal(contacts[0].id, contact.id); assert.equal(contacts[0].phone, complete.whatsapp);
  assert.equal(leads[0].id, lead.id); assert.equal(leads[0].contact_id, contact.id);
  assert.deepEqual(leads[0].intake.first_touch, firstTouch);
  assert.equal((await ctx.rows("intake_sessions"))[0].lead_id, lead.id);
  assert.equal((await ctx.rows("tasks")).length, 1);
  assert.ok((await ctx.rows("messages")).every(m => m.lead_id === lead.id));
  assert.equal(wa.replies[0], d.READY_REPLY); assert.equal(wa.providerCalls(), 0);
});
sqlTest("separate sessions with the same unverified email remain isolated; each final submit is idempotent", async () => {
  const ctx = await setup(); const answers = { ...complete }; delete answers.whatsapp;
  const other = await ctx.service.createIntakeSession(firstTouch);
  for (const token of [ctx.token, other.token]) {
    await ctx.service.saveSessionAnswer(token, { ...answers, email: " ANA@EXAMPLE.COM " });
    await ctx.service.saveSessionAnswer(token, answers);
    await ctx.service.finalizeIntakeSession(token);
  }
  const contacts = await ctx.rows("contacts");
  assert.equal(contacts.length, 2);
  assert.ok(contacts.every(c => c.email === "ana@example.com" && c.phone === null));
  assert.equal((await ctx.rows("leads")).length, 2); assert.equal((await ctx.rows("tasks")).length, 2);
  const { message } = await ctx.service.issueContinuation(other.token);
  await ctx.service.resolveIntakeContinuation(tokens.extractContinuationCode(message), complete.whatsapp);
  assert.equal((await ctx.rows("contacts")).filter(c => c.phone === null).length, 1);
});
sqlTest("nullable phones preserve owner/phone uniqueness and inbox projection", async () => {
  const ctx = await setup(); await ctx.finish(); const lead = (await ctx.rows("leads"))[0];
  await pg.query("insert into conversations(owner_id,lead_id) values($1,$2)", [ctx.owner, lead.id]);
  assert.equal((await pg.query("select phone from crm_inbox where lead_id=$1", [lead.id])).rows[0].phone, null);
  await pg.query("insert into contacts(owner_id,phone) values($1,$2)", [ctx.owner, complete.whatsapp]);
  await assert.rejects(pg.query("insert into contacts(owner_id,phone) values($1,$2)", [ctx.owner, complete.whatsapp]), /unique/);
  const other = await setup();
  await pg.query("insert into contacts(owner_id,phone) values($1,$2)", [other.owner, complete.whatsapp]);
});
sqlTest("wrong sender/owner/expired ECW cannot create or steal a lead; same sender retry is idempotent", async () => {
  const ctx = await setup(); await ctx.finish(); const { message } = await ctx.service.issueContinuation(ctx.token), code = tokens.extractContinuationCode(message);
  assert.equal(await ctx.service.resolveIntakeContinuation(code, "525599999999"), null);
  const outsider = await setup(); assert.equal(await outsider.service.resolveIntakeContinuation(code, complete.whatsapp), null);
  const id = await ctx.service.resolveIntakeContinuation(code, complete.whatsapp);
  assert.equal(await ctx.service.resolveIntakeContinuation(code, complete.whatsapp), id);
  await pg.query("update intake_sessions set continuation_expires_at=now()-interval '1 second' where owner_id=$1", [ctx.owner]);
  assert.equal((await webhook(ctx).send(message)).data.ignored, 1);
  assert.equal((await ctx.rows("leads")).length, 1); assert.equal((await ctx.rows("tasks")).length, 1);
});
sqlTest("GET leaves saved-ready session staged; stale snapshot cannot materialize before finalize", async () => {
  const ctx = await setup();
  await ctx.db.rpc("intake_save_session", { p_owner: ctx.owner, p_hash: tokens.hashToken(ctx.token), p_answers: complete });
  const stale = await ctx.db.rpc("intake_materialize_session", { p_owner: ctx.owner, p_hash: tokens.hashToken(ctx.token), p_expected_answers: { ...complete, timing: "wrong" }, p_summary: "stale" });
  assert.equal(stale.data, null); assert.equal((await ctx.rows("leads")).length, 0);
  assert.equal((await ctx.service.getIntakeSession(ctx.token)).ready_for_quote, true);
  assert.equal((await ctx.rows("leads")).length, 0);
  await ctx.service.finalizeIntakeSession(ctx.token);
  assert.equal((await ctx.rows("leads")).length, 1);
  assert.equal((await ctx.rows("tasks")).length, 1);
});
sqlTest("ECW and final web submit serialized around one session cannot allocate two leads", async () => {
  const ctx = await setup(); const partial = { ...complete }; delete partial.timing;
  await ctx.service.saveSessionAnswer(ctx.token, partial); const { message } = await ctx.service.issueContinuation(ctx.token);
  await Promise.allSettled([ctx.finish(), ctx.service.resolveIntakeContinuation(tokens.extractContinuationCode(message), complete.whatsapp)]);
  assert.equal((await ctx.rows("leads")).length, 1); assert.ok((await ctx.rows("tasks")).length <= 1);
  assert.equal((await ctx.rows("intake_sessions"))[0].lead_id, (await ctx.rows("leads"))[0].id);
});
sqlTest("browser does not merge into an existing contact; signed ECW preserves confirmed identity", async () => {
  const ctx = await setup();
  const existing = (await pg.query("insert into contacts(owner_id,full_name,phone,email) values($1,'Confirmed',$2,'confirmed@example.com') returning *", [ctx.owner, complete.whatsapp])).rows[0];
  await ctx.finish(); const webLead = (await ctx.rows("leads"))[0]; assert.notEqual(webLead.contact_id, existing.id);
  const { message } = await ctx.service.issueContinuation(ctx.token);
  assert.equal(await ctx.service.resolveIntakeContinuation(tokens.extractContinuationCode(message), complete.whatsapp), webLead.id);
  const linked = (await ctx.rows("leads"))[0]; assert.equal(linked.contact_id, existing.id);
  assert.equal((await ctx.rows("contacts")).find(c => c.id === existing.id).email, existing.email);
  assert.equal((await ctx.service.getLeadIntake(webLead.id)).ready_for_quote, true);
  assert.equal(linked.intake.submitted_contact_id, webLead.contact_id);
});
sqlTest("new materialization/continuity RPCs remain inaccessible to browser roles", async () => {
  const functions = (await pg.query("select oid::regprocedure::text as signature, prosecdef, proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'intake_%'")).rows;
  assert.equal(functions.length, 8);
  for (const fn of functions) {
    assert.equal(fn.prosecdef, false);
    assert.ok(fn.proconfig.includes('search_path=""'));
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await pg.query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, fn.signature])).rows[0].allowed, false);
    }
  }
  assert.equal((await pg.query("select relrowsecurity from pg_class where oid='public.intake_sessions'::regclass")).rows[0].relrowsecurity, true);
  for (const role of ["anon", "authenticated"]) for (const signature of ["intake_materialize_session(uuid,text,jsonb,text)", "intake_issue_continuation(uuid,text,text)", "intake_resolve_continuation(uuid,text,text)"]) {
    const result = await pg.query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, `public.${signature}`]);
    assert.equal(result.rows[0].allowed, false);
  }
});
sqlTest("public final POST is idempotent and reload returns completed receipt", async () => {
  const ctx = await setup(); const partial = { ...complete }; delete partial.timing;
  await ctx.service.saveSessionAnswer(ctx.token, partial);
  const route = load("src/app/api/intake/session/route.ts", {
    "next/server": { NextResponse: { json: (data, opts = {}) => ({ data, status: opts.status ?? 200 }) } },
    "next/headers": { cookies: async () => ({ get: () => ({ value: ctx.token }) }) },
    "@/lib/intake/service": ctx.service, "@/lib/intake/web": load("src/lib/intake/web.ts", { "./domain": d }),
  }, { ...ctx.env, INTAKE_WEB_ENABLED: "true", INTAKE_WEB_ORIGIN: "https://example.com" });
  const editResult = await route.POST(new Request("https://example.com/api/intake/session", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify({ action: "save", mode: "edit", field: "what_sells", value: "API corrected business" }) }));
  assert.equal(editResult.status, 200); assert.equal(editResult.data.known_fields.what_sells, "API corrected business");
  for (let i = 0; i < 2; i++) {
    const result = await route.POST(new Request("https://example.com/api/intake/session", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify({ action: "save", answers: { timing: "Octubre" } }) }));
    assert.equal(result.status, 200); assert.equal(result.data.ready_for_quote, true); assert.equal(result.data.materialized, false);
  }
  assert.equal((await ctx.rows("leads")).length, 0); assert.equal((await ctx.rows("tasks")).length, 0);
  for (let i = 0; i < 2; i++) {
    const result = await route.POST(new Request("https://example.com/api/intake/session", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify({ action: "finalize" }) }));
    assert.equal(result.status, 200); assert.equal(result.data.ready_for_quote, true); assert.equal(result.data.materialized, true);
  }
  assert.deepEqual(copy((await route.GET()).data), { linked: true, materialized: true, status: "materialized", ready_for_quote: true, completion_percent: 100, missing_fields: [], intake_version: 1 });
  const postMaterializedEdit = await route.POST(new Request("https://example.com/api/intake/session", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify({ action: "save", mode: "edit", field: "what_sells", value: "Must not replace" }) }));
  assert.equal(postMaterializedEdit.status, 400);
  assert.equal((await ctx.rows("leads")).length, 1); assert.equal((await ctx.rows("tasks")).length, 1);
  assert.equal((await ctx.rows("leads"))[0].what_sells, "API corrected business");
});
sqlTest("ECW selects its exact web lead even when a newer lead exists for the same contact", async () => {
  const ctx = await setup(); await ctx.finish(); const webLead = (await ctx.rows("leads"))[0];
  await pg.query("insert into leads(owner_id,contact_id,created_at) values($1,$2,now()+interval '1 day')", [ctx.owner, webLead.contact_id]);
  const { message } = await ctx.service.issueContinuation(ctx.token);
  assert.equal((await webhook(ctx).send(message)).status, 200);
  assert.equal((await ctx.rows("leads")).length, 2); // only the two records deliberately created above
  assert.ok((await ctx.rows("messages")).every(m => m.lead_id === webLead.id));
});
sqlTest("task failure rolls back all CRM materialization; reload retries once safely", async () => {
  const ctx = await setup();
  await pg.exec(`create function public.test_fail_intake_task() returns trigger language plpgsql as $$
    begin if new.owner_id='${ctx.owner}'::uuid then raise exception 'test_task_failure'; end if; return new; end; $$;
    create trigger test_fail_intake_task before insert on tasks for each row execute function public.test_fail_intake_task();`);
  try {
    await ctx.saveComplete();
    await assert.rejects(ctx.service.finalizeIntakeSession(ctx.token), /intake_storage_failed/);
    for (const table of ["contacts", "businesses", "leads", "tasks"]) assert.equal((await ctx.rows(table)).length, 0);
    const session = (await ctx.rows("intake_sessions"))[0]; assert.equal(session.lead_id, null);
    assert.equal(session.answers.timing, complete.timing);
  } finally { await pg.exec("drop trigger test_fail_intake_task on tasks; drop function public.test_fail_intake_task()"); }
  assert.equal((await ctx.service.getIntakeSession(ctx.token)).ready_for_quote, true);
  assert.equal((await ctx.rows("leads")).length, 0);
  await ctx.service.finalizeIntakeSession(ctx.token);
  assert.equal((await ctx.rows("leads")).length, 1); assert.equal((await ctx.rows("tasks")).length, 1);
});
