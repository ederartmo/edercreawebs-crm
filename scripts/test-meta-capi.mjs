import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { load } from "./test-helpers/proposal-fixture.mjs";

const base = { leadId: "test-lead", materializedAt: "2026-10-07T10:00:00Z", marketing: true, email: " Test@Example.com ", phone: "+52 (55) 1234-5678" };
const env = { META_DATASET_ID: "1641466280624093", META_CAPI_ACCESS_TOKEN: "local-test-token" };
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function setup(options = {}, transport = async () => ({ ok: true })) {
  const calls = [];
  const capi = load("src/lib/meta/capi.ts", { "server-only": {}, "node:crypto": crypto }, { ...env, ...options }, async (url, request) => { calls.push({ url, request, body: JSON.parse(request.body) }); return transport(url, request); });
  return { capi, calls };
}
test("Marketing false/unknown sends nothing, even with configured credentials", async () => {
  const ctx = setup();
  for (const marketing of [false, undefined, null, "true"]) assert.equal(await ctx.capi.sendMetaLead({ ...base, marketing }), false);
  assert.equal(ctx.calls.length, 0);
});
test("Lead uses configured dataset, deterministic ID, original timestamp and hashed matching only", async () => {
  const ctx = setup({ META_DATASET_ID: "123456" });
  assert.equal(await ctx.capi.sendMetaLead(base), true);
  const { url, body, request } = ctx.calls[0], event = body.data[0];
  assert.equal(url, "https://graph.facebook.com/v25.0/123456/events");
  assert.equal(request.headers.Authorization, "Bearer local-test-token");
  assert.equal(event.event_id, `lead_${hash(base.leadId)}`);
  assert.equal(event.event_time, Date.parse(base.materializedAt) / 1000);
  assert.equal(event.event_name, "Lead"); assert.equal(event.action_source, "website");
  assert.equal(event.event_source_url, "https://edercreawebs.com");
  assert.deepEqual(event.user_data, { em: [hash("test@example.com")], ph: [hash("525512345678")], external_id: [hash(base.leadId)] });
  for (const value of ["local-test-token", "test@example.com", "525512345678", base.leadId]) assert.ok(!JSON.stringify(body).includes(value));
  assert.equal(body.test_event_code, undefined); assert.equal(event.user_data.fbp, undefined); assert.equal(event.user_data.fbc, undefined);
  await ctx.capi.sendMetaLead(base);
  assert.deepEqual(ctx.calls[0].body, ctx.calls[1].body);
});
test("optional test code is sent only when configured; missing credentials do not call Meta", async () => {
  const ctx = setup({ META_CAPI_TEST_EVENT_CODE: " TEST_LOCAL " }); await ctx.capi.sendMetaLead(base);
  assert.equal(ctx.calls[0].body.test_event_code, "TEST_LOCAL");
  for (const options of [{ META_DATASET_ID: "" }, { META_DATASET_ID: "evil/path" }, { META_CAPI_ACCESS_TOKEN: "" }]) {
    const missing = setup(options); assert.equal(await missing.capi.sendMetaLead(base), false); assert.equal(missing.calls.length, 0);
  }
});
test("500, network errors and timeout return false without leaking or throwing", async () => {
  for (const transport of [async () => ({ ok: false, status: 500 }), async () => { throw Error("private error"); }, async (_url, request) => new Promise((_, reject) => request.signal.addEventListener("abort", () => reject(Error("timeout"))))]) {
    assert.equal(await setup({}, transport).capi.sendMetaLead(base), false);
  }
});
test("invalid matching data never fabricates phone/country code and invalid time suppresses CAPI", async () => {
  const ctx = setup(); await ctx.capi.sendMetaLead({ ...base, email: "bad", phone: "5512345678" });
  assert.deepEqual(ctx.calls[0].body.data[0].user_data, { external_id: [hash(base.leadId)] });
  assert.equal(await ctx.capi.sendMetaLead({ ...base, materializedAt: "bad" }), false);
  assert.equal(ctx.calls.length, 1);
});
