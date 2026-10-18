import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ycdosrsanutbhbgejwwg.supabase.co",
  RESOURCES_CONFIRMATION_ENABLED: "true",
  RESOURCES_CONFIRMATION_ORIGIN: "http://127.0.0.1:3001",
  RESOURCES_EMAIL_SIGNING_SECRET: "unit-test-secret-for-confirmation-only-32-characters",
  RESEND_API_KEY: "unit-test-key",
};
const id = "11111111-1111-4111-8111-111111111111";
const issued = new Date().toISOString();
let shouldSend = true, providerFailure = false, storageFailure = false, confirmationResult = true;
const deliveries = [], updates = [], calls = [];
const db = {
  async rpc(name, params) {
    calls.push({name, params});
    return { error: null, data: name === "resource_prepare_confirmation" ? {send:shouldSend,id,issued_at:issued} : confirmationResult };
  },
  from(table) {
    assert.equal(table,"resource_subscribers");
    return {update(value) { const filters=[]; const query={eq(key,value){filters.push([key,value]);return filters.length===2 ? Promise.resolve({error:storageFailure?{}:null}) : query;}}; updates.push({value,filters});return query;}};
  },
};
function load(file, imports) {
  const testModule = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
    module:testModule,exports:testModule.exports,require(name){assert.ok(name in imports,`unexpected import ${name}`);return imports[name];},
    process:{env},Buffer,Response,Request,URL,AbortSignal,TextDecoder,Uint8Array,Date,
    async fetch(url,options) { assert.equal(url,"https://api.resend.com/emails"); deliveries.push({headers:options.headers,body:JSON.parse(options.body)}); return Response.json(providerFailure?{error:"simulated"}:{id:"test-email-id"},{status:providerFailure?503:200}); },
  });
  return testModule.exports;
}
const service=load("src/lib/resources/confirmation.ts",{"node:crypto":crypto,"@/lib/supabase/admin":{createAdminClient:()=>db}});
const route=load("src/app/api/resources/confirm/route.ts",{"node:crypto":crypto,"@/lib/resources/confirmation":service});
const token=service.createConfirmationToken(id,issued);

test("signed tokens contain no email, reject edits and expire after 24 hours",()=>{
  assert.equal(service.readConfirmationToken(token).id,id);
  assert.ok(!token.includes("@"));
  const [payload,signature]=token.split(".");
  const changed=`${payload}.${signature[0]==="A"?"B":"A"}${signature.slice(1)}`;
  assert.equal(service.readConfirmationToken(changed),null);
  assert.equal(service.readConfirmationToken(token,Date.parse(issued)+24*3600000+1),null);
  assert.equal(service.readConfirmationToken(token,Date.parse(issued)-61000),null);
  for(const value of [null,"bad","x".repeat(600)]) assert.equal(service.readConfirmationToken(value),null);
});

test("email provides text and HTML with an explicit confirmation link",()=>{
  const message=service.buildConfirmationEmail("https://crm.example/api/resources/confirm#token=test&value=\"");
  assert.match(message.subject,/Confirma tu correo/);
  assert.match(message.text,/24 horas/);
  assert.match(message.html,/Confirmar mi correo/);
  assert.match(message.html,/&amp;value=&quot;/);
  assert.doesNotMatch(message.html,/<script|<img/);
});

test("retry sends the same payload and idempotency key, without storing raw tokens",async()=>{
  deliveries.length=0;updates.length=0;
  providerFailure=true;
  await assert.rejects(service.sendResourceConfirmation("qa.confirmation@example.invalid"));
  assert.equal(updates.length,0);
  providerFailure=false;
  await service.sendResourceConfirmation("qa.confirmation@example.invalid");
  assert.equal(deliveries.length,2);
  assert.deepEqual(deliveries[0],deliveries[1]);
  assert.match(deliveries[0].headers["Idempotency-Key"],/^resources-confirm-v1\//);
  assert.match(deliveries[0].body.text,/#token=/);
  assert.equal(updates.length,1);
  assert.deepEqual(Object.keys(updates[0].value),["confirmation_email_sent_at"]);
});

test("confirmed or opted-out subscribers do not receive another confirmation",async()=>{
  const before=deliveries.length;
  shouldSend=false;
  try {await service.sendResourceConfirmation("qa.confirmation@example.invalid");assert.equal(deliveries.length,before);} finally{shouldSend=true;}
});

test("GET displays a protected page without confirming or reading a subscriber",async()=>{
  const before=calls.length;
  const response=await route.GET();
  const html=await response.text();
  assert.equal(response.status,200);assert.equal(calls.length,before);
  assert.equal(response.headers.get("referrer-policy"),"no-referrer");
  assert.match(response.headers.get("content-security-policy"),/script-src 'nonce-/);
  assert.match(html,/location.hash/);assert.match(html,/history.replaceState/);
  assert.match(html,/button.addEventListener\('click'/);
});

test("confirmation POST checks origin, token, expiry and backend before success",async()=>{
  const request=(data,origin=env.RESOURCES_CONFIRMATION_ORIGIN)=>new Request(env.RESOURCES_CONFIRMATION_ORIGIN+"/api/resources/confirm",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(data)});
  assert.equal((await route.POST(request({token},"https://other.example"))).status,403);
  assert.equal((await route.POST(request({token:"bad"}))).status,400);
  assert.equal((await route.POST(request({token,large:"x".repeat(1100)}))).status,413);
  confirmationResult=false;
  assert.equal((await route.POST(request({token}))).status,400);
  confirmationResult=true;
  const response=await route.POST(request({token}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  assert.equal(calls.at(-1).params.p_id,id);
});

test("configuration and database identity errors never send or confirm",async()=>{
  env.NEXT_PUBLIC_SUPABASE_URL="https://wrong.example";
  await assert.rejects(service.sendResourceConfirmation("qa.confirmation@example.invalid"));
  await assert.rejects(service.confirmResourceSubscription(token));
  env.NEXT_PUBLIC_SUPABASE_URL="https://ycdosrsanutbhbgejwwg.supabase.co";
  const saved=env.RESEND_API_KEY;delete env.RESEND_API_KEY;
  await assert.rejects(service.sendResourceConfirmation("qa.confirmation@example.invalid"));
  env.RESEND_API_KEY=saved;
});
