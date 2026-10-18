import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports, env) {
  const testModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: testModule, exports: testModule.exports, require(name) { assert.ok(name in imports, `unexpected dependency ${name}`); return imports[name]; },
    process: { env }, Response, Request, URL, AbortSignal, TextDecoder, Uint8Array,
  });
  return testModule.exports;
}
const env = { NEXT_PUBLIC_SUPABASE_URL: "https://ycdosrsanutbhbgejwwg.supabase.co", RESOURCES_WEB_ENABLED: "true", RESOURCES_WEB_ORIGIN: "http://127.0.0.1:5174" };
const rows = new Map();
let failure = false;
let calls = 0;
const service = load("src/lib/resources/subscription.ts", { "@/lib/supabase/admin": { createAdminClient: () => ({ from(table) {
  assert.equal(table, "resource_subscribers");
  return { upsert(value, options) {
    calls++;
    assert.equal(options.onConflict, "email"); assert.equal(options.ignoreDuplicates, true);
    return { async abortSignal(signal) {
      assert.ok(signal instanceof AbortSignal);
      if (failure) return { error: { message: "private database details" } };
      if (!rows.has(value.email)) rows.set(value.email, { ...JSON.parse(JSON.stringify(value)), subscribed_at: "original", unsubscribed_at: null });
      return { error: null };
    } };
  } };
} }) } }, env);
const route = load("src/app/api/resources/subscribe/route.ts", { "@/lib/resources/subscription": service }, env);
const valid = { email: " QA.Resources@Example.invalid ", consent: true, consentVersion: "recursos-v1", website: "" };
const request = (value, headers = {}) => new Request("http://127.0.0.1:3001/api/resources/subscribe", { method: "POST", headers: { origin: env.RESOURCES_WEB_ORIGIN, "content-type": "application/json", ...headers }, body: JSON.stringify(value) });

test("only normalized email with explicit versioned consent reaches storage", () => {
  assert.equal(service.parseResourceSubscription(valid).email, "qa.resources@example.invalid");
  for (const changed of [{ consent: false }, { consent: "true" }, { consentVersion: "old" }, { website: "bot" }, { email: "invalid" }, { email: "x..y@example.com" }]) assert.equal(service.parseResourceSubscription({ ...valid, ...changed }), null);
});

test("duplicates preserve subscription date and withdrawal rather than resubscribing", async () => {
  rows.clear();
  for (let n = 0; n < 2; n++) {
    const response = await route.POST(request(valid));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
    rows.get("qa.resources@example.invalid").unsubscribed_at = "withdrawn";
  }
  assert.equal(rows.size, 1);
  assert.equal(rows.get("qa.resources@example.invalid").subscribed_at, "original");
  assert.equal(rows.get("qa.resources@example.invalid").unsubscribed_at, "withdrawn");
});

test("server gate, exact origin and input validation prevent writes", async () => {
  const before = calls;
  env.RESOURCES_WEB_ENABLED = "false";
  assert.equal((await route.POST(request(valid))).status, 503);
  env.RESOURCES_WEB_ENABLED = "true";
  assert.equal((await route.POST(request(valid, { origin: "https://attacker.example" }))).status, 403);
  assert.equal((await route.POST(request(valid, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await route.POST(request({ ...valid, consent: false }))).status, 400);
  assert.equal((await route.POST(request({ ...valid, large: "x".repeat(3000) }))).status, 413);
  assert.equal(calls, before);
});

test("wrong project identity and database failure return no success or internal details", async () => {
  const before = calls;
  env.NEXT_PUBLIC_SUPABASE_URL = "https://other-project.supabase.co";
  let response = await route.POST(request(valid));
  assert.equal(response.status, 503); assert.equal(calls, before);
  env.NEXT_PUBLIC_SUPABASE_URL = "https://ycdosrsanutbhbgejwwg.supabase.co";
  failure = true;
  try {
    response = await route.POST(request(valid));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "subscription_unavailable" });
  } finally { failure = false; }
});
