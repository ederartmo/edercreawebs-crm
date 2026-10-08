// Local-only contract/integration checks. No network, credentials or new framework.
// Run: node --test scripts/test-proposal-prep.mjs
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
    process: { env }, fetch, URL, AbortController, setTimeout, clearTimeout, Buffer, Blob, FormData,
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
      filter(key, operator, value) {
        assert.equal(operator, "eq");
        const expected = JSON.parse(value);
        filters.push(row => JSON.stringify(row[key]) === JSON.stringify(expected));
        return query;
      },
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
            if (table === "visual_proposal_sections") {
              if (db.failSections) return { data: null, error: { code: "TEST_FAILURE" } };
              if (tables[table].some(row => row.proposal_id === payload.proposal_id && row.position === payload.position)) {
                return { data: null, error: { code: "23505" } };
              }
            }
            if (table === "visual_proposals" && tables[table].some(row => row.lead_id === payload.lead_id && row.version === payload.version)) {
              return { data: null, error: { code: "23505" } };
            }
            const row = { ...copy(payload), id: payload.id ?? `id${++sequence}` };
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

export { load, copy, fixture, database, engine };
