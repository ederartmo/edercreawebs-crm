// Optional local PostgreSQL runtime, installed outside the repo. No remote connections.
// $env:ECW_PGLITE_MODULE = '<temporary install>/node_modules/@electric-sql/pglite/dist/index.js'
// node --test scripts/test-intake-sql.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

test("Intake migration: real local SQL, grants, merge, claims, expiry and atomic handoff", { skip: !process.env.ECW_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.ECW_PGLITE_MODULE).href);
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    await db.exec(fs.readFileSync("supabase/migrations/20260705000100_baseline_current_public_schema.sql", "utf8"));
    await db.exec(fs.readFileSync("supabase/migrations/20260927000100_whatsapp_handoff_task.sql", "utf8"));
    await db.exec(fs.readFileSync("supabase/migrations/20260927000200_whatsapp_agent_v2_handoff_task.sql", "utf8"));
    await db.exec(fs.readFileSync("supabase/migrations/20261005200629_intake_v1.sql", "utf8"));
    const owner = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
    await db.query("insert into auth.users values($1),($2)", [owner, other]);
    const contact = (await db.query("insert into contacts(owner_id,phone,full_name) values($1,'525512345678','Confirmed') returning id", [owner])).rows[0].id;
    const lead = (await db.query("insert into leads(owner_id,contact_id,status,what_sells,currently_selling) values($1,$2,'cotizacion_enviada','CRM business',false) returning id", [owner, contact])).rows[0].id;
    const conv = (await db.query("insert into conversations(owner_id,lead_id) values($1,$2) returning id", [owner, lead])).rows[0].id;
    const hash = "a".repeat(64), code = "b".repeat(64);
    await db.query("select intake_create_session($1,$2,$3)", [owner, hash, { source: "meta_ads", entry_channel: "web", utm_campaign: "First" }]);
    await db.query("select intake_save_session($1,$2,$3)", [owner, hash, { name: "Browser", whatsapp: "525512345678", budget_range: "20k_35k", what_sells: "Browser business", how_sells: "Agenda y cobra", main_goal: "Filtrar", timing: "Octubre", no_digital_presence: true, currently_selling: true }]);
    await db.query("select intake_save_session($1,$2,$3)", [owner, hash, { budget_range: "50k_plus", business_name: "Negocio" }]);
    await db.query("update intake_sessions set continuation_hash=$1,continuation_expires_at=now()+interval '1 day'", [code]);
    const claim = (who, phone) => db.query("select intake_claim_session($1,$2,$3,$4) as claimed", [who, code, lead, phone]);
    assert.equal((await claim(other, "525512345678")).rows[0].claimed, false);
    assert.equal((await claim(owner, "525599999999")).rows[0].claimed, false);
    assert.equal((await claim(owner, "525512345678")).rows[0].claimed, true);
    assert.equal((await claim(owner, "525512345678")).rows[0].claimed, false);
    await assert.rejects(db.query("select intake_save_session($1,$2,$3)", [owner, hash, { timing: "Later" }]));
    const row = (await db.query("select * from leads where id=$1", [lead])).rows[0];
    assert.equal(row.what_sells, "CRM business"); assert.equal(row.currently_selling, false);
    assert.equal(row.how_sells, "Agenda y cobra"); assert.equal(row.intake.answers.budget_range, "20k_35k");
    assert.equal(row.intake.answers.what_sells, undefined); assert.equal(row.intake.answers.name, undefined);
    assert.equal(row.suggested_price, null); assert.equal(row.approved_price, null);
    assert.equal((await db.query("select full_name from contacts where id=$1", [contact])).rows[0].full_name, "Confirmed");
    assert.equal((await db.query("select name from businesses where id=$1", [row.business_id])).rows[0].name, "Negocio");
    assert.deepEqual((await db.query("select answers from intake_sessions where token_hash=$1", [hash])).rows[0].answers, {});
    await db.query("select intake_apply_lead($1,$2,$3,$4)", [owner, lead, { budget_range: "50k_plus", main_problem: "Falta seguimiento" }, { source: "whatsapp", utm_campaign: "Later" }]);
    const after = (await db.query("select intake from leads where id=$1", [lead])).rows[0].intake;
    assert.equal(after.first_touch.utm_campaign, "First"); assert.equal(after.answers.budget_range, "20k_35k");
    await db.query("select intake_apply_lead($1,$2,$3,$4)", [owner, lead, {}, { source: "meta_ads", source_id: "later_ad", ctwa_clid: "later_click" }]);
    await db.query("select intake_apply_lead($1,$2,$3,$4)", [owner, lead, {}, { source: "whatsapp" }]);
    const referral = (await db.query("select intake from leads where id=$1", [lead])).rows[0].intake;
    assert.equal(referral.first_touch.utm_campaign, "First"); assert.equal(referral.last_referral.ctwa_clid, "later_click");
    await assert.rejects(db.query("select intake_apply_lead($1,$2,$3,$4)", [other, lead, {}, {}]));
    await assert.rejects(db.query("select intake_apply_lead($1,$2,$3,$4)", [owner, lead, { budget_range: "25000" }, {}]));
    await assert.rejects(db.query("select intake_handoff($1,$2,$3,'summary')", [owner, lead, contact]));
    assert.equal((await db.query("select human_required from leads where id=$1", [lead])).rows[0].human_required, false);
    for (const status of ["nuevo", "calificado", "propuesta_visual", "cotizacion_enviada", "en_desarrollo", "entregado", "perdido"]) {
      await db.query("update leads set status=$1 where id=$2", [status, lead]);
      await db.query("select intake_handoff($1,$2,$3,'summary')", [owner, lead, conv]);
      const result = (await db.query("select status,human_required,bot_mode from leads where id=$1", [lead])).rows[0];
      assert.equal(result.status, status); assert.equal(result.human_required, true); assert.equal(result.bot_mode, "paused");
    }
    assert.equal((await db.query("select count(*)::int as n from tasks where lead_id=$1 and automation_key='intake-v1-ready-for-quote'", [lead])).rows[0].n, 1);
    assert.equal((await db.query("select bot_paused from conversations where id=$1", [conv])).rows[0].bot_paused, true);
    for (const role of ["anon", "authenticated"]) {
      const privileges = (await db.query("select has_table_privilege($1,'public.intake_sessions','SELECT') as can_read,has_function_privilege($1,'public.intake_claim_session(uuid,text,uuid,text)','EXECUTE') as can_claim", [role])).rows[0];
      assert.equal(privileges.can_read, false); assert.equal(privileges.can_claim, false);
    }
    await db.query("select intake_create_session($1,$2,$3)", [owner, "c".repeat(64), {}]);
    await db.exec("update intake_sessions set expires_at=now()-interval '1 day' where lead_id is null");
    await assert.rejects(db.query("select intake_save_session($1,$2,$3)", [owner, "c".repeat(64), { name: "Expired" }]));
  } finally { await db.close(); }
});
