// No network: every provider/Storage/DB operation uses an in-memory double.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { load, copy, fixture, database, engine } from "./test-helpers/proposal-fixture.mjs";

const bytes = () => {
  const b = Buffer.alloc(60);
  Buffer.from("89504e470d0a1a0a", "hex").copy(b);
  b.write("IHDR",12); b.writeUInt32BE(864,16); b.writeUInt32BE(1536,20);
  return b;
};
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function setup(generate) {
  const db = database();
  const prep = engine(db).api;
  const created = await prep.prepareVisualProposalDraft({ leadId:"lead", sourceAssetId:"source" });
  const direction = load("src/lib/whatsapp/visual-direction.ts", { "./proposal-prep":prep });
  const provider = load("src/lib/whatsapp/visual-image-provider.ts", { "server-only":{} });
  const requests = [], files = new Map();
  db.failUpload = false;
  db.storage = { from(bucket) {
    assert.equal(bucket,"whatsapp-imports");
    return {
      async upload(path, data, options) {
        assert.equal(options.upsert,false);
        if (db.failUpload || files.has(path)) return { error:{code:"MOCK_UPLOAD"} };
        files.set(path,Buffer.from(data)); return {data:{path},error:null};
      },
      async download(path) { return files.has(path) ? { data:new Blob([files.get(path)]),error:null } : {data:null,error:{code:"NOT_FOUND"}}; },
    };
  } };
  const generatorModule = load("src/lib/whatsapp/visual-generator.ts", {
    "server-only":{}, "node:crypto":crypto, "@/lib/supabase/admin":{createAdminClient:()=>db},
    "./proposal-prep":prep,"./visual-direction":direction,"./visual-image-provider":provider,
  });
  const api = generatorModule.createVisualGenerator({ db, ownerId:"owner", preflight() {}, async generate(args) {
    requests.push(args);
    if (generate) return generate(args,requests.length);
    return { bytes:bytes(),request_id:"req_mock" };
  } });
  return { api, db, requests, files, prep, direction, provider, args:{proposalId:created.proposal_id},
    section:position=>db.tables.visual_proposal_sections[position-1], proposal:()=>db.tables.visual_proposals[0] };
}

test("versioned spec/envelope, exact mobile format, prompt guards, single-section asset and no desktop",async()=>{
  const f=await setup(); const original=f.proposal().direction_notes;
  const output=await f.api.generateVisualAnchor(f.args);
  assert.equal(output.status,"review_pending"); assert.equal(f.requests.length,1);
  const e=f.direction.parseVisualEnvelope(f.proposal().direction_notes);
  assert.deepEqual(copy(e.proposal_brief),JSON.parse(original));
  assert.deepEqual(copy(e.visual_spec.format),{target:"mobile",aspect_ratio:"9:16",viewport_type:"single_screen"});
  assert.equal(e.schema_version,1);assert.equal(e.visual_spec.schema_version,1);
  for(const phrase of ["one screen only","no mockup","no collage","realistic ui","no device mockup","no full-page website","no invented prices"]) {
    assert.ok(f.requests[0].prompt.toLowerCase().includes(phrase),phrase);
  }
  assert.ok(!f.requests[0].prompt.includes("desktop"));
  const generated=f.db.tables.assets.filter(a=>a.source==="visual_generator_v1");
  assert.equal(generated.length,1); assert.equal(generated[0].metadata.position,1);
  assert.equal(f.section(1).asset_id,generated[0].id);
  assert.equal(generated[0].is_client_facing,false);
  assert.equal(f.section(2).status,"pending");
  assert.ok(!JSON.stringify(f.db.tables).includes("b64_json"));
  assert.ok(!JSON.stringify(f.db.tables.automation_runs).includes("FROZEN VISUAL SPEC"));
  for(const change of [s=>s.schema_version=2,s=>s.format.target="desktop",s=>s.format.aspect_ratio="2:3",s=>s.format.viewport_type="full_page"]) {
    const spec=copy(e.visual_spec);change(spec);assert.throws(()=>f.direction.parseVisualSpec(spec));
  }
});

test("two concurrent anchors: only one reservation and one paid provider call",async()=>{
  const called=deferred(),release=deferred();
  const f=await setup(async()=>{called.resolve();await release.promise;return {bytes:bytes(),request_id:"req_mock"};});
  const first=f.api.generateVisualAnchor(f.args); await called.promise;
  const second=await f.api.generateVisualAnchor(f.args);
  assert.equal(second.status,"generation_reserved");assert.equal(second.new_paid_generation,false);
  assert.equal(f.requests.length,1); release.resolve(); await first;
  assert.equal(f.section(1).status,"review_pending");assert.equal(f.requests.length,1);
  const reserveWrites=f.db.events.filter(e=>e.table==="visual_proposal_sections"&&e.payload?.status==="generation_reserved"&&e.result.data);
  assert.equal(reserveWrites.length,1);
});

test("simultaneous calls reaching the section CAS are arbitrated by database predicates",async()=>{
  const f=await setup(); const gate=deferred(); let contenders=0;
  f.db.beforeQuery=async event=>{
    if(event.table==="visual_proposal_sections"&&event.payload?.status==="generation_reserved") {
      if(++contenders===2)gate.resolve();await gate.promise;
    }
  };
  await Promise.all([f.api.generateVisualAnchor(f.args),f.api.generateVisualAnchor(f.args)]);
  assert.equal(contenders,2);assert.equal(f.requests.length,1);
  assert.equal(f.section(1).status,"review_pending");
});

test("review_pending and approved return existing image; approval is idempotent and never generates",async()=>{
  const f=await setup();const first=await f.api.generateVisualAnchor(f.args);
  assert.equal((await f.api.generateVisualAnchor(f.args)).asset_id,first.asset_id);
  assert.equal((await f.api.approveVisualAnchor(f.args)).status,"approved");
  assert.equal((await f.api.approveVisualAnchor(f.args)).status,"approved");
  assert.equal((await f.api.generateVisualAnchor(f.args)).status,"approved");
  assert.equal(f.requests.length,1);
  await assert.rejects(f.api.regenerateVisualAnchor({...f.args,reason:"new direction"}),/state_blocked/);
});

test("approval and downstream calls require a successfully stored anchor asset",async()=>{
  const f=await setup();
  await assert.rejects(f.api.generateRemainingVisualScreens(f.args),/approval_required/);
  assert.equal(f.requests.length,0);
  await f.api.generateVisualAnchor(f.args);const asset=f.section(1).asset_id;
  f.section(1).asset_id=null;
  await assert.rejects(f.api.approveVisualAnchor(f.args),/asset_required/);
  f.section(1).asset_id=asset;f.files.clear();
  await assert.rejects(f.api.approveVisualAnchor(f.args),/file_unavailable/);
});

test("screens 2–4 use exactly the frozen spec and approved anchor image; complete retry skips all",async()=>{
  const f=await setup();await f.api.generateVisualAnchor(f.args);
  const frozen=f.proposal().direction_notes; await f.api.approveVisualAnchor(f.args);
  f.db.tables.assets[0].metadata.enrichment_profile.brand_colors=["#FF0000"];
  const outputs=await f.api.generateRemainingVisualScreens(f.args);
  assert.equal(outputs.length,3);assert.equal(f.requests.length,4);
  assert.equal(f.proposal().direction_notes,frozen);
  const spec=JSON.stringify(JSON.parse(frozen).visual_spec);
  for(const req of f.requests.slice(1)) {
    assert.ok(req.prompt.includes(`FROZEN VISUAL SPEC: ${spec}`));
    assert.equal(req.inputs[0].asset_id,f.section(1).asset_id);
    assert.equal(req.inputs[0].role,"approved_anchor_style_reference");
    assert.deepEqual(Buffer.from(req.inputs[0].bytes),bytes());
  }
  assert.equal(new Set(f.db.tables.visual_proposal_sections.map(s=>s.asset_id)).size,4);
  await f.api.generateRemainingVisualScreens(f.args);assert.equal(f.requests.length,4);
});

test("known provider rejection becomes failed, retains brief/enrichment, never retries silently",async()=>{
  let failure;
  const f=await setup(async()=>{throw failure;});failure=new f.provider.ImageProviderFailure("known_failure","req_failure");
  const enrichment=copy(f.db.tables.assets),brief=JSON.parse(f.proposal().direction_notes);
  const output=await f.api.generateVisualAnchor(f.args);
  assert.equal(output.status,"generation_failed");assert.equal(f.section(1).asset_id,null);
  assert.deepEqual(copy(f.db.tables.assets),enrichment);
  assert.deepEqual(JSON.parse(f.proposal().direction_notes).proposal_brief,brief);
  await f.api.generateVisualAnchor(f.args);assert.equal(f.requests.length,1);
  await assert.rejects(f.api.regenerateVisualAnchor({...f.args,reason:""}),/reason_required/);
  await f.api.regenerateVisualAnchor({...f.args,reason:"Inputs corrected"});assert.equal(f.requests.length,2);
});

test("timeout/unknown and persistence failures block automatic retry",async()=>{
  for(const kind of ["timeout","upload"]) {
    const f=await setup(kind==="timeout"?async()=>{throw Error("secret provider detail");}:undefined);
    if(kind==="upload")f.db.failUpload=true;
    const before=JSON.parse(f.proposal().direction_notes);
    const output=await f.api.generateVisualAnchor(f.args);
    assert.equal(output.status,"generation_unknown");assert.equal(f.section(1).asset_id,null);
    await f.api.generateVisualAnchor(f.args);assert.equal(f.requests.length,1);
    assert.deepEqual(JSON.parse(f.proposal().direction_notes).proposal_brief,before);
    assert.ok(!JSON.stringify(f.db.tables).includes("secret provider detail"));
  }
});

test("explicit regeneration retains previous asset until replacement is persisted",async()=>{
  let fail=false,oldId;
  const f=await setup(async()=>{
    if(fail) { assert.equal(f.section(1).asset_id,oldId);throw Error("timeout"); }
    return {bytes:bytes(),request_id:"req_mock"};
  });
  await f.api.generateVisualAnchor(f.args);oldId=f.section(1).asset_id;fail=true;
  await f.api.regenerateVisualAnchor({...f.args,reason:"Adjust spacing"});
  assert.equal(f.section(1).asset_id,oldId);assert.equal(f.section(1).status,"generation_unknown");
  fail=false;await f.api.regenerateVisualAnchor({...f.args,reason:"Accept new paid attempt after unknown"});
  assert.notEqual(f.section(1).asset_id,oldId);
  assert.ok(f.db.tables.assets.some(a=>a.id===oldId));assert.equal(f.requests.length,3);
});

test("partial downstream failure preserves completed screen, explicit retry pays only missing failed screen",async()=>{
  let fail=true,f;
  f=await setup(async(_args,count)=>{
    if(count===3&&fail)throw new f.provider.ImageProviderFailure("known_failure");
    return {bytes:bytes(),request_id:"req_mock"};
  });
  await f.api.generateVisualAnchor(f.args);await f.api.approveVisualAnchor(f.args);
  await f.api.generateRemainingVisualScreens(f.args);const second=f.section(2).asset_id;
  assert.equal(f.section(3).status,"generation_failed");assert.equal(f.section(4).status,"pending");
  await f.api.generateRemainingVisualScreens(f.args);assert.equal(f.requests.length,3);
  fail=false;await f.api.generateRemainingVisualScreens({...f.args,retryFailedReason:"Explicit failed-screen retry"});
  assert.equal(f.section(2).asset_id,second);assert.equal(f.requests.length,5);
  assert.equal(f.section(4).status,"review_pending");
});

test("uploaded bytes survive asset insertion failure and can be recovered without regeneration",async()=>{
  const f=await setup();let fail=true;
  f.db.beforeQuery=async e=>{
    if(fail&&e.table==="assets"&&e.operation==="insert"&&e.payload.source==="visual_generator_v1")throw Error("DB unavailable");
  };
  assert.equal((await f.api.generateVisualAnchor(f.args)).status,"generation_unknown");
  assert.equal(f.files.size,1);assert.equal(f.db.tables.assets.filter(a=>a.source==="visual_generator_v1").length,0);
  const id=JSON.parse(f.section(1).brief).visual_attempt.id;
  fail=false;
  assert.equal((await f.api.recoverStoredVisualScreen({...f.args,position:1,expectedAttemptId:id})).status,"review_pending");
  assert.equal(f.requests.length,1);assert.equal(f.section(1).asset_id,id);
});

test("concurrent approval is idempotent and unknown cannot be retried by failed-screen batch option",async()=>{
  const f=await setup();await f.api.generateVisualAnchor(f.args);
  const approved=await Promise.all([f.api.approveVisualAnchor(f.args),f.api.approveVisualAnchor(f.args)]);
  assert.ok(approved.every(r=>r.status==="approved"));
  f.section(2).status="generation_unknown";
  await f.api.generateRemainingVisualScreens({...f.args,retryFailedReason:"Explicit known failure retry"});
  assert.equal(f.requests.length,1);
});

test("recovery fences delayed worker and can attach its stored asset without paying again",async()=>{
  const called=deferred(),release=deferred();
  const f=await setup(async()=>{called.resolve();await release.promise;return {bytes:bytes(),request_id:"req_late"};});
  const running=f.api.generateVisualAnchor(f.args);await called.promise;
  const id=JSON.parse(f.section(1).brief).visual_attempt.id;
  await f.api.markVisualGenerationUnknown({...f.args,position:1,expectedAttemptId:id,reason:"Worker outcome under investigation"});
  await f.api.generateVisualAnchor(f.args);assert.equal(f.requests.length,1);
  release.resolve();await running;
  assert.equal(f.section(1).status,"generation_unknown");assert.equal(f.section(1).asset_id,null);
  const recovered=await f.api.recoverStoredVisualScreen({...f.args,position:1,expectedAttemptId:id});
  assert.equal(recovered.status,"review_pending");assert.equal(recovered.asset_id,id);assert.equal(f.requests.length,1);
});

test("Prep cannot rewrite frozen direction or generated sections; generator cannot enter active Prep",async()=>{
  const f=await setup();await f.api.generateVisualAnchor(f.args);
  const before=copy(f.db.tables.visual_proposals),sections=copy(f.db.tables.visual_proposal_sections);
  await engine(f.db,()=>({...fixture(),business_summary:"Changed"})).api.prepareVisualProposalDraft({leadId:"lead",sourceAssetId:"source"});
  assert.deepEqual(copy(f.db.tables.visual_proposals),before);assert.deepEqual(copy(f.db.tables.visual_proposal_sections),sections);
  const other=await setup();const paused=deferred(),release=deferred();let stopped=false;
  other.db.afterQuery=async event=>{
    if(!stopped&&event.table==="visual_proposals"&&event.payload?.status==="preparing") {
      stopped=true;paused.resolve();await release.promise;
    }
  };
  const prepRun=other.prep.prepareVisualProposalDraft({leadId:"lead",sourceAssetId:"source"});await paused.promise;
  assert.equal((await other.api.generateVisualAnchor(other.args)).status,"busy");assert.equal(other.requests.length,0);
  release.resolve();await prepRun;
});

test("pending/failed images cannot become verified inputs; complete files used only in relevant section",async()=>{
  const f=await setup();
  const real={id:"real-photo",owner_id:"owner",lead_id:"lead",source:"whatsapp_zip",category:"image",mime_type:"image/png",
    storage_bucket:"whatsapp-imports",storage_path:"owner/lead/real.png",metadata:{visual_verification:{status:"verified",role:"photo",verified_by:"owner",source_description:"Prospect supplied business photo",section_positions:[1]}}};
  for(const status of ["pending","processing","failed"]) {
    assert.equal(f.direction.verifiedImageReference({...real,metadata:{...real.metadata,enrichment_status:status}}),null);
  }
  assert.equal(f.direction.verifiedImageReference({...real,metadata:{enrichment_status:"complete",enrichment_profile:{useful_image_notes:["Photo exists"]}}}),null);
  f.db.tables.assets.push(real);f.files.set(real.storage_path,bytes());
  await f.api.generateVisualAnchor(f.args);
  assert.equal(f.requests[0].inputs[0].asset_id,real.id);
  await f.api.approveVisualAnchor(f.args);await f.api.generateRemainingVisualScreens(f.args);
  assert.ok(f.requests.slice(1).every(r=>r.inputs.length===1));
});

test("commercial copy and wrong format fail before any paid request",async()=>{
  const f=await setup();const spec=f.direction.buildVisualSpec("p",fixture(),[]);
  for(const text of ["$100","MXN 100","20% descuento","Nuestros paquetes","Mensualidades","500 clientes","4.9 estrellas"]) {
    assert.throws(()=>f.direction.buildVisualPrompt(spec,{...fixture().sections[0],content:[text]},[]));
  }
  assert.throws(()=>f.provider.assertMobilePng(Buffer.alloc(80)));
  assert.equal(f.requests.length,0);
  assert.equal(spec.brand.color_source,"proposed");assert.equal(spec.brand.typography_source,"proposed");
});

test("Images API mock verifies endpoint, n=1, 9:16 dimensions, edit references and no retry on error",async()=>{
  const calls=[];
  const api=load("src/lib/whatsapp/visual-image-provider.ts",{"server-only":{}},
    {OPENAI_API_KEY:"local-test-placeholder",WHATSAPP_VISUAL_GENERATION_ENABLED:"true"},
    async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,headers:new Headers({"x-request-id":"req_mock"}),json:async()=>({data:[{b64_json:bytes().toString("base64")}]})};});
  await api.generateScreenImage({prompt:"one screen only",inputs:[]});
  await api.generateScreenImage({prompt:"same style",inputs:[{asset_id:"anchor",role:"anchor",bytes:bytes(),mime_type:"image/png"}]});
  assert.ok(calls[0].url.endsWith("/generations"));assert.ok(calls[1].url.endsWith("/edits"));
  for(const call of calls) {assert.equal(call.body.n,1);assert.equal(call.body.size,"864x1536");assert.equal(call.body.output_format,"png");assert.equal(call.body.model,"gpt-image-2.5-sunburst-2026-09-08");}
  assert.ok(calls[1].body.images[0].image_url.startsWith("data:image/png;base64,"));
  let count=0;
  const failed=load("src/lib/whatsapp/visual-image-provider.ts",{"server-only":{}},
    {OPENAI_API_KEY:"local-test-placeholder",WHATSAPP_VISUAL_GENERATION_ENABLED:"true"},async()=>{count++;return {ok:false,status:500,headers:new Headers()};});
  await assert.rejects(failed.generateScreenImage({prompt:"test",inputs:[]}),/unknown/);assert.equal(count,1);
});
