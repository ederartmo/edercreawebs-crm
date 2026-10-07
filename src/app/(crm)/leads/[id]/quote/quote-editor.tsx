"use client";

import { useActionState, useState } from "react";
import { saveQuoteAction, type SaveQuoteState } from "./actions";

export type QuoteDraft = {
  id: string;
  leadId: string;
  version: number;
  status: string;
  project_type: string;
  solution_proposed: string;
  deliverables: string[];
  manual_project_price_cents: string | null;
  delivery_timeline: string;
  payment_terms: string;
  maintenance_mode: string;
  maintenance_details: string;
  maintenance_price_cents: string | null;
  proposal_notes: string;
};

export type ProspectContext = {
  clientName: string;
  email: string;
  whatsapp: string;
  businessName: string;
  whatSells: string;
  acquisition: string;
  salesProcess: string;
  objective: string;
  problem: string;
  digitalPresence: [string, string][];
  noDigitalPresence: boolean;
  budget: string;
  timing: string;
  visualIntent: boolean;
};

type EditorValues = Omit<QuoteDraft, "id" | "leadId" | "version" | "status" | "manual_project_price_cents" | "maintenance_price_cents"> & {
  project_type_custom: string;
  manual_project_price_pesos: string;
  maintenance_price_pesos: string;
  newDeliverable: string;
};

const initialSaveState: SaveQuoteState = { status: "idle", message: "" };
const inputClass = "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-950 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";
const labelClass = "block text-sm font-semibold text-gray-800";
const projectTypes = ["Sitio web", "Landing page", "Ecommerce", "Sistema / herramienta", "Automatización", "Otro"];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    expired: "Vencida",
    approved: "Aprobada",
    pending_approval: "Pendiente de aprobación",
  };
  return labels[status] ?? "Cotización";
}

function pesosInput(cents: string | null) {
  if (cents === null) return "";
  if (!/^\d+$/.test(cents)) return "";
  const normalized = cents.replace(/^0+(?=\d)/, "").padStart(3, "0");
  const whole = normalized.slice(0, -2).replace(/^0+(?=\d)/, "");
  const fraction = normalized.slice(-2);
  return fraction === "00" ? whole : `${whole}.${fraction}`;
}

function pesosCents(value: string) {
  const match = /^(\d{1,17})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = match[1].replace(/^0+(?=\d)/, "");
  const cents = `${whole}${(match[2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
  if (cents.length > 19 || (cents.length === 19 && cents > "9223372036854775807")) return null;
  return cents;
}

function money(value: string) {
  const cents = pesosCents(value);
  if (cents === null) return "";
  const normalized = cents.padStart(3, "0");
  const whole = normalized.slice(0, -2);
  const fraction = normalized.slice(-2);
  const formatted = `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  return fraction === "00" ? formatted : `${formatted}.${fraction}`;
}

function display(value: string) {
  return value.trim();
}

function ContextValue({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-900">{value}</dd>
    </div>
  );
}

export function QuoteEditor({ quote, prospect }: { quote: QuoteDraft; prospect: ProspectContext }) {
  const readOnly = quote.status !== "draft";
  const initialProjectType = projectTypes.includes(quote.project_type) ? quote.project_type : (quote.project_type ? "Otro" : "");
  const [values, setValues] = useState<EditorValues>({
    project_type: initialProjectType,
    project_type_custom: initialProjectType === "Otro" && quote.project_type !== "Otro" ? quote.project_type : "",
    solution_proposed: quote.solution_proposed,
    deliverables: quote.deliverables,
    manual_project_price_pesos: pesosInput(quote.manual_project_price_cents),
    delivery_timeline: quote.delivery_timeline,
    payment_terms: quote.payment_terms,
    maintenance_mode: quote.maintenance_mode,
    maintenance_details: quote.maintenance_details,
    maintenance_price_pesos: pesosInput(quote.maintenance_price_cents),
    proposal_notes: quote.proposal_notes,
    newDeliverable: "",
  });
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saveState, saveAction, isSaving] = useActionState(saveQuoteAction, initialSaveState);

  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };
  const projectTypeValue = values.project_type === "Otro" ? values.project_type_custom : values.project_type;
  const title = prospect.businessName || prospect.clientName || "tu proyecto";
  const summary = [prospect.problem, prospect.objective && prospect.objective !== prospect.problem ? prospect.objective : ""]
    .filter(Boolean)
    .join("\n\n");
  const contextLines = [prospect.whatSells, prospect.acquisition, prospect.salesProcess].filter(Boolean);

  function addDeliverable() {
    const item = values.newDeliverable.trim();
    if (!item || values.deliverables.length >= 40) return;
    setValues((current) => ({ ...current, deliverables: [...current.deliverables, item.slice(0, 200)], newDeliverable: "" }));
  }

  return (
    <div className="space-y-6">
      {readOnly ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Esta cotización ya fue enviada. Se muestra en modo de solo lectura.
        </div>
      ) : null}

      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Editor o vista previa">
        <button type="button" role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "edit" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
          Editor
        </button>
        <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "preview" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
          Vista previa
        </button>
      </div>

      <div className={tab === "edit"
        ? "grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
        : "mx-auto w-full max-w-5xl"}>
        <section className={tab === "edit" ? "space-y-5" : "hidden"}>
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Contexto del prospecto · solo lectura</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-gray-950">{title}</h2>
            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <ContextValue label="Cliente" value={prospect.clientName} />
              <ContextValue label="Negocio" value={prospect.businessName} />
              <ContextValue label="Email" value={prospect.email} />
              <ContextValue label="WhatsApp" value={prospect.whatsapp} />
              <ContextValue label="Qué vende" value={prospect.whatSells} />
              <ContextValue label="Cómo consigue clientes" value={prospect.acquisition} />
              <ContextValue label="Cómo vende / atiende y cobra" value={prospect.salesProcess} />
              <ContextValue label="Objetivo principal" value={prospect.objective} />
              {prospect.digitalPresence.length ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Presencia digital</dt>
                  <dd className="mt-1 space-y-1 text-sm leading-6 text-gray-900">
                    {prospect.digitalPresence.map(([label, value]) => <p key={label}>{label}: {value}</p>)}
                  </dd>
                </div>
              ) : prospect.noDigitalPresence ? <ContextValue label="Presencia digital" value="Sin presencia digital actual" /> : null}
              <ContextValue label="Presupuesto declarado · solo contexto" value={prospect.budget ? `Presupuesto declarado: ${prospect.budget}` : ""} />
              <ContextValue label="Timing" value={prospect.timing} />
            </dl>
            {prospect.visualIntent ? (
              <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Propuesta visual</p>
                <p className="mt-1 text-sm leading-6 text-violet-950">Este prospecto solicitó ver una propuesta visual junto con su cotización.</p>
                <p className="mt-2 text-xs text-violet-800">La incorporación de imágenes se habilitará en una etapa posterior.</p>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Propuesta de Eder · editable</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Contenido de la cotización</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{statusLabel(quote.status)}</span>
            </div>

            <form action={saveAction} className="mt-6 space-y-5">
              <input type="hidden" name="leadId" value={quote.leadId} />
              <input type="hidden" name="quoteId" value={quote.id} />

              <div>
                <label className={labelClass} htmlFor="project_type">Tipo de proyecto</label>
                <select id="project_type" className={inputClass} value={values.project_type} disabled={readOnly} onChange={(event) => set("project_type", event.target.value)}>
                  <option value="">Seleccionar tipo</option>
                  {projectTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                {values.project_type === "Otro" ? (
                  <input aria-label="Especifica el tipo de proyecto" className={inputClass} placeholder="Especifica el tipo" value={values.project_type_custom} disabled={readOnly} onChange={(event) => set("project_type_custom", event.target.value)} />
                ) : null}
                <input type="hidden" name="project_type" value={projectTypeValue} />
              </div>

              <div>
                <label className={labelClass} htmlFor="solution_proposed">Solución propuesta</label>
                <textarea id="solution_proposed" name="solution_proposed" rows={4} maxLength={4000} className={inputClass} placeholder="Describe la solución que propones para este negocio." value={values.solution_proposed} disabled={readOnly} onChange={(event) => set("solution_proposed", event.target.value)} />
              </div>

              <div>
                <label className={labelClass} htmlFor="deliverable-new">Alcance / entregables</label>
                <div className="mt-2 flex gap-2">
                  <input id="deliverable-new" className={inputClass.replace("mt-1", "mt-0")} maxLength={200} placeholder="Ej. Diseño responsive" value={values.newDeliverable} disabled={readOnly || values.deliverables.length >= 40} onChange={(event) => set("newDeliverable", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDeliverable(); } }} />
                  <button type="button" onClick={addDeliverable} disabled={readOnly || !values.newDeliverable.trim() || values.deliverables.length >= 40} className="shrink-0 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">Agregar</button>
                </div>
                <div className="mt-3 space-y-2">
                  {values.deliverables.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3.5 py-2.5">
                      <span className="text-sm text-gray-800">{item}</span>
                      <input type="hidden" name="deliverables" value={item} />
                      {!readOnly ? <button type="button" onClick={() => set("deliverables", values.deliverables.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Eliminar ${item}`} className="rounded-lg px-2 py-1 text-sm font-medium text-gray-500 hover:bg-white hover:text-red-700">Quitar</button> : null}
                    </div>
                  ))}
                  {!values.deliverables.length ? <p className="text-sm text-gray-500">Aún no agregas entregables.</p> : null}
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="manual-project-price">Inversión del proyecto · MXN</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                  <input id="manual-project-price" name="manualProjectPricePesos" type="number" min="0" step="0.01" inputMode="decimal" className={`${inputClass} mt-0 pl-8`} placeholder="20000" value={values.manual_project_price_pesos} disabled={readOnly} onChange={(event) => set("manual_project_price_pesos", event.target.value)} />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">Captura manual de Eder; no se calcula del presupuesto declarado.</p>
              </div>

              <div>
                <label className={labelClass} htmlFor="delivery_timeline">Tiempo estimado de entrega</label>
                <input id="delivery_timeline" name="delivery_timeline" maxLength={500} className={inputClass} placeholder="3–4 semanas" value={values.delivery_timeline} disabled={readOnly} onChange={(event) => set("delivery_timeline", event.target.value)} />
              </div>

              <div>
                <label className={labelClass} htmlFor="payment_terms">Forma de pago</label>
                <textarea id="payment_terms" name="payment_terms" rows={2} maxLength={2000} className={inputClass} placeholder="Escribe las condiciones acordadas, si ya están definidas." value={values.payment_terms} disabled={readOnly} onChange={(event) => set("payment_terms", event.target.value)} />
              </div>

              <div>
                <label className={labelClass} htmlFor="maintenance_mode">Mantenimiento</label>
                <select id="maintenance_mode" name="maintenance_mode" className={inputClass} value={values.maintenance_mode} disabled={readOnly} onChange={(event) => set("maintenance_mode", event.target.value)}>
                  <option value="">Seleccionar modalidad</option>
                  <option value="none">No incluido</option>
                  <option value="optional">Opcional</option>
                  <option value="included">Incluido</option>
                </select>
                {values.maintenance_mode && values.maintenance_mode !== "none" ? (
                  <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-4">
                    <div>
                      <label className={labelClass} htmlFor="maintenance_details">Detalle del mantenimiento</label>
                      <textarea id="maintenance_details" name="maintenance_details" rows={2} maxLength={2000} className={inputClass} placeholder="Describe el seguimiento o mantenimiento." value={values.maintenance_details} disabled={readOnly} onChange={(event) => set("maintenance_details", event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="maintenance-price">Precio opcional · MXN</label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                        <input id="maintenance-price" name="maintenancePricePesos" type="number" min="0" step="0.01" inputMode="decimal" className={`${inputClass} mt-0 pl-8`} placeholder="Opcional" value={values.maintenance_price_pesos} disabled={readOnly} onChange={(event) => set("maintenance_price_pesos", event.target.value)} />
                      </div>
                    </div>
                  </div>
                ) : null}
                {values.maintenance_mode === "none" || !values.maintenance_mode ? (
                  <>
                    <input type="hidden" name="maintenance_details" value={values.maintenance_details} />
                    <input type="hidden" name="maintenancePricePesos" value={values.maintenance_price_pesos} />
                  </>
                ) : null}
              </div>

              <div>
                <label className={labelClass} htmlFor="proposal_notes">Notas de la propuesta</label>
                <textarea id="proposal_notes" name="proposal_notes" rows={3} maxLength={4000} className={inputClass} placeholder="Notas que quieras incluir en la propuesta." value={values.proposal_notes} disabled={readOnly} onChange={(event) => set("proposal_notes", event.target.value)} />
              </div>

              {!readOnly ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
                  <button type="submit" disabled={isSaving} className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60">
                    {isSaving ? "Guardando…" : "Guardar borrador"}
                  </button>
                  <p aria-live="polite" className={`text-sm ${saveState.status === "error" ? "text-red-700" : "text-green-700"}`}>
                    {saveState.message}
                  </p>
                </div>
              ) : null}
            </form>
          </article>
        </section>

        <aside className={tab === "preview" ? "w-full" : "hidden xl:block"}>
          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-7 py-5 sm:px-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">EderCreaWebs</p>
              <p className="mt-2 text-xs text-gray-500">Propuesta · V{quote.version}</p>
            </div>
            <div className="px-7 py-8 sm:px-10 sm:py-11">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Propuesta para</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-gray-950">{title}</h2>
              {summary ? <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-600">{summary}</p> : null}
              {contextLines.length ? (
                <p className="mt-3 text-sm leading-6 text-gray-500">{contextLines[0]}</p>
              ) : null}

              {values.solution_proposed.trim() ? (
                <section className="mt-9 border-t border-gray-200 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Solución propuesta</h3>
                  <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-gray-900">{values.solution_proposed}</p>
                </section>
              ) : null}
              {values.deliverables.length ? (
                <section className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Alcance del proyecto</h3>
                  <ul className="mt-4 space-y-3">
                    {values.deliverables.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6 text-gray-800"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-900" />{item}</li>)}
                  </ul>
                </section>
              ) : null}
              {display(values.delivery_timeline) ? (
                <section className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Tiempo estimado</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-900">{values.delivery_timeline}</p>
                </section>
              ) : null}
              {values.manual_project_price_pesos ? (
                <section className="mt-8 rounded-2xl bg-gray-950 p-6 text-white sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-300">Inversión del proyecto</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{money(values.manual_project_price_pesos) || "Por revisar"}</p>
                  <p className="mt-1 text-xs text-gray-300">MXN</p>
                </section>
              ) : null}
              {display(values.payment_terms) ? (
                <section className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Forma de pago</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">{values.payment_terms}</p>
                </section>
              ) : null}
              {values.maintenance_mode && values.maintenance_mode !== "none" ? (
                <section className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Mantenimiento · {values.maintenance_mode === "included" ? "Incluido" : "Opcional"}</h3>
                  {display(values.maintenance_details) ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">{values.maintenance_details}</p> : null}
                  {values.maintenance_price_pesos ? <p className="mt-3 text-sm font-semibold text-gray-950">{money(values.maintenance_price_pesos)} MXN</p> : null}
                </section>
              ) : null}
              {display(values.proposal_notes) ? (
                <section className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Notas</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">{values.proposal_notes}</p>
                </section>
              ) : null}
              {prospect.visualIntent ? (
                <p className="mt-8 border-t border-gray-200 pt-5 text-xs leading-5 text-gray-500">La propuesta final incluirá la propuesta visual solicitada.</p>
              ) : null}
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-7 py-4 text-xs text-gray-500 sm:px-10">
              Vista previa interna · Cotización en estado {statusLabel(quote.status).toLowerCase()}
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}
