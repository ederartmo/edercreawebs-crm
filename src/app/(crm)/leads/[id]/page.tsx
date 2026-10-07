import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, humanizeStatus } from "@/lib/format";
import { evaluateIntakeReadiness, type IntakeData } from "@/lib/intake/domain";
import { notFound } from "next/navigation";
import { AnalyzeLeadButton } from "./analyze-lead-button";
import { PrepareQuoteButton } from "./prepare-quote-button";

type LatestAnalysisInput = {
  messageCount: number | null;
  audioCount: number | null;
  imageCount: number | null;
  pdfCount: number | null;
};

type LatestCommercialAnalysis = {
  whatSells: string | null;
  mainProblem: string | null;
  mainGoal: string | null;
  requestedFeatures: string[];
  leadScore: number | null;
  intentionLevel: string | null;
  suggestedPrice: number | null;
  currency: string | null;
  confidence: string | null;
  reasons: string[];
};

type LeadIntake = {
  answers?: Record<string, unknown>;
  first_touch?: Record<string, unknown>;
  ready_for_quote?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => getText(item))
    .filter((item): item is string => Boolean(item));
}

function parseLeadIntake(value: unknown): LeadIntake {
  if (!isRecord(value)) return {};
  return {
    answers: isRecord(value.answers) ? value.answers : {},
    first_touch: isRecord(value.first_touch) ? value.first_touch : {},
    ready_for_quote: value.ready_for_quote === true,
  };
}

function leadDescription(value: unknown, fallback: string) {
  const text = getText(value);
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (isRecord(parsed) && ("known_fields" in parsed || "ready_for_quote" in parsed)) {
      return fallback;
    }
  } catch {
    // Keep ordinary conversation summaries as written.
  }
  return text;
}

const budgetLabels: Record<string, string> = {
  menos_de_15k: "Menos de $15,000 MXN",
  "15k_20k": "$15,000–$20,000 MXN",
  "20k_35k": "$20,000–$35,000 MXN",
  "35k_50k": "$35,000–$50,000 MXN",
  "50k_plus": "Más de $50,000 MXN",
};

const missingFieldLabels: Record<string, string> = {
  identity: "Contacto",
  what_sells: "Qué vende",
  customer_acquisition: "Cómo consigue clientes",
  how_sells: "Cómo vende",
  objective: "Objetivo principal",
  budget_range: "Inversión contemplada",
  timing: "Inicio",
  reference: "Presencia digital",
};

function timingLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Por definir";
  const labels: Record<string, string> = {
    lo_antes_posible: "Lo antes posible",
    este_mes: "Este mes",
    en_1_2_meses: "En 1–2 meses",
    en_3_meses_o_mas: "En 3 meses o más",
    solo_estoy_explorando: "Solo estoy explorando",
  };
  return labels[value] ?? value;
}

function parseLatestAnalysisInput(value: unknown): LatestAnalysisInput {
  if (!isRecord(value)) {
    return {
      messageCount: null,
      audioCount: null,
      imageCount: null,
      pdfCount: null,
    };
  }

  return {
    messageCount: getNumber(value.message_count),
    audioCount: getNumber(value.audio_count),
    imageCount: getNumber(value.image_count),
    pdfCount: getNumber(value.pdf_count),
  };
}

function parseLatestCommercialAnalysis(value: unknown): LatestCommercialAnalysis | null {
  if (!isRecord(value)) return null;

  return {
    whatSells: getText(value.what_sells),
    mainProblem: getText(value.main_problem),
    mainGoal: getText(value.main_goal),
    requestedFeatures: getStringList(value.requested_features),
    leadScore: getNumber(value.lead_score),
    intentionLevel: getText(value.intention_level),
    suggestedPrice: getNumber(value.suggested_price),
    currency: getText(value.currency),
    confidence: getText(value.confidence),
    reasons: getStringList(value.reasons),
  };
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: lead },
    { data: messages },
    { data: tasks },
    { data: quotes },
    { data: payments },
    { data: latestAnalysisRuns, error: latestAnalysisError },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*,contacts(*),businesses(*)")
      .eq("id", id)
      .single(),
    supabase
      .from("messages")
      .select("id,direction,type,body,processed_text,transcription,created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("tasks")
      .select("id,title,status,due_at")
      .eq("lead_id", id)
      .order("due_at", { ascending: true }),
    supabase
      .from("quotes")
      .select("id,version,status,total,currency,sent_at")
      .eq("lead_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("payments")
      .select("id,type,status,amount,currency,paid_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("automation_runs")
      .select("finished_at,input,output")
      .eq("lead_id", id)
      .in("workflow_name", ["whatsapp_import_analysis_v1", "lead_full_analysis_v1"])
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);

  if (!lead) notFound();
  if (latestAnalysisError) {
    console.error("Failed to load latest lead analysis", latestAnalysisError);
  }

  const contact = Array.isArray(lead.contacts)
    ? lead.contacts[0]
    : lead.contacts;
  const business = Array.isArray(lead.businesses)
    ? lead.businesses[0]
    : lead.businesses;
  const leadIntake = parseLeadIntake(lead.intake);
  const intakeAnswers = leadIntake.answers ?? {};
  const intakeData: IntakeData = {
    ...(typeof lead.what_sells === "string" ? { what_sells: lead.what_sells } : {}),
    ...(typeof lead.how_sells === "string" ? { how_sells: lead.how_sells } : {}),
    ...(typeof lead.main_problem === "string" ? { main_problem: lead.main_problem } : {}),
    ...(typeof lead.main_goal === "string" ? { main_goal: lead.main_goal } : {}),
    ...(typeof contact?.full_name === "string" ? { name: contact.full_name } : {}),
    ...(typeof contact?.email === "string" ? { email: contact.email } : {}),
    ...(typeof contact?.phone === "string" ? { whatsapp: contact.phone } : {}),
    ...(typeof business?.instagram_url === "string" ? { instagram: business.instagram_url } : {}),
    ...(typeof business?.facebook_url === "string" ? { facebook: business.facebook_url } : {}),
    ...(typeof business?.tiktok_url === "string" ? { tiktok: business.tiktok_url } : {}),
    ...(typeof business?.website === "string" ? { website: business.website } : {}),
    ...(typeof business?.google_business_url === "string" ? { google_business: business.google_business_url } : {}),
    ...intakeAnswers,
    ...(typeof contact?.phone === "string" ? { whatsapp: contact.phone } : {}),
  } as IntakeData;
  const intakeReadiness = evaluateIntakeReadiness(intakeData);
  const intakeReady = leadIntake.ready_for_quote === true || intakeReadiness.ready_for_quote;
  const intakeMissing = intakeReadiness.missing_fields.map((field) => missingFieldLabels[field] ?? field);
  const digitalPresence = [
    ["Instagram", intakeData.instagram],
    ["Facebook", intakeData.facebook],
    ["TikTok", intakeData.tiktok],
    ["Sitio web", intakeData.website],
    ["Google Business", intakeData.google_business],
  ].filter(([, value]) => typeof value === "string" && value.trim());
  const latestAnalysisRun = latestAnalysisRuns?.[0] ?? null;
  const latestAnalysisInput = parseLatestAnalysisInput(latestAnalysisRun?.input);
  const latestAnalysisOutput = isRecord(latestAnalysisRun?.output)
    ? latestAnalysisRun.output
    : null;
  const latestCommercialAnalysis = parseLatestCommercialAnalysis(
    latestAnalysisOutput?.commercial_analysis,
  );
  const analysisCountItems = [
    { label: "Mensajes", value: latestAnalysisInput.messageCount },
    { label: "Audios", value: latestAnalysisInput.audioCount },
    { label: "Imágenes", value: latestAnalysisInput.imageCount },
    { label: "PDFs", value: latestAnalysisInput.pdfCount },
  ].filter((item) => item.value !== null);

  return (
    <>
      <PageHeader
        eyebrow={humanizeStatus(lead.status)}
        title={business?.name || contact?.full_name || contact?.phone || "Lead"}
        description={leadDescription(lead.conversation_summary, lead.main_problem || "Sin resumen todavía.")}
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="space-y-6">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Diagnóstico</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Qué vende</dt>
                <dd className="mt-1 font-medium">{intakeData.what_sells || "Pendiente"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Cómo consigue clientes</dt>
                <dd className="mt-1 font-medium">{intakeData.customer_acquisition || "Pendiente"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Cómo vende</dt>
                <dd className="mt-1 font-medium">{intakeData.how_sells || "Pendiente"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Objetivo principal</dt>
                <dd className="mt-1 font-medium">{intakeData.main_goal || "Pendiente"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Inversión contemplada</dt>
                <dd className="mt-1 font-medium">
                  {typeof intakeData.budget_range === "string"
                    ? budgetLabels[intakeData.budget_range] ?? intakeData.budget_range
                    : "Por definir"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Cuándo quiere iniciar</dt>
                <dd className="mt-1 font-medium">{timingLabel(intakeData.timing)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Presencia digital</dt>
                <dd className="mt-1 font-medium">
                  {digitalPresence.length > 0 ? (
                    <ul className="space-y-1">
                      {digitalPresence.map(([label, value]) => (
                        <li key={label}>
                          {label}: {value}
                        </li>
                      ))}
                    </ul>
                  ) : intakeData.no_digital_presence === true ? (
                    "Sin presencia digital actual"
                  ) : (
                    "Por definir"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Tipo de proyecto</dt>
                <dd className="mt-1 font-medium">{humanizeStatus(lead.project_type)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Precio</dt>
                <dd className="mt-1 font-medium">
                  {lead.approved_price || lead.suggested_price
                    ? formatMoney(
                        Number(lead.approved_price ?? lead.suggested_price),
                        lead.currency,
                      )
                    : "Por definir"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 border-t border-gray-100 pt-4 text-sm">
              <p className="font-semibold text-gray-900">Estado del Intake</p>
              <p className="mt-2 text-gray-600">
                Completado: <span className="font-medium text-gray-900">{intakeReadiness.completion_percent}%</span>
                {" · "}
                Estado: <span className="font-medium text-gray-900">{intakeReady ? "Listo para cotización" : "En progreso"}</span>
              </p>
              {intakeMissing.length > 0 ? (
                <p className="mt-1 text-gray-600">Faltan: {intakeMissing.join(", ")}</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="font-bold">Último análisis del expediente</h2>
              <AnalyzeLeadButton leadId={id} />
            </div>
            {latestAnalysisRun ? (
              <div className="mt-4 space-y-4 text-sm">
                <p className="text-xs text-gray-500">
                  Actualizado {formatDate(latestAnalysisRun.finished_at)}
                </p>

                {analysisCountItems.length > 0 ? (
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {analysisCountItems.map((item) => (
                      <div key={item.label} className="rounded-xl bg-gray-50 p-3">
                        <dt className="text-xs text-gray-500">{item.label}</dt>
                        <dd className="mt-1 font-semibold text-gray-900">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {latestCommercialAnalysis ? (
                  <div className="space-y-4">
                    <dl className="grid gap-4 sm:grid-cols-2">
                      {latestCommercialAnalysis.whatSells ? (
                        <div>
                          <dt className="text-gray-500">Qué vende</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {latestCommercialAnalysis.whatSells}
                          </dd>
                        </div>
                      ) : null}
                      {latestCommercialAnalysis.mainProblem ? (
                        <div>
                          <dt className="text-gray-500">Problema principal</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {latestCommercialAnalysis.mainProblem}
                          </dd>
                        </div>
                      ) : null}
                      {latestCommercialAnalysis.mainGoal ? (
                        <div>
                          <dt className="text-gray-500">Objetivo principal</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {latestCommercialAnalysis.mainGoal}
                          </dd>
                        </div>
                      ) : null}
                      {latestCommercialAnalysis.leadScore !== null ? (
                        <div>
                          <dt className="text-gray-500">Lead score</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {latestCommercialAnalysis.leadScore}
                          </dd>
                        </div>
                      ) : null}
                      {latestCommercialAnalysis.intentionLevel ? (
                        <div>
                          <dt className="text-gray-500">Nivel de intención</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {humanizeStatus(latestCommercialAnalysis.intentionLevel)}
                          </dd>
                        </div>
                      ) : null}
                      {latestCommercialAnalysis.confidence ? (
                        <div>
                          <dt className="text-gray-500">Confianza</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {humanizeStatus(latestCommercialAnalysis.confidence)}
                          </dd>
                        </div>
                      ) : null}
                      {latestCommercialAnalysis.suggestedPrice !== null ? (
                        <div>
                          <dt className="text-gray-500">Precio sugerido</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {formatMoney(
                              latestCommercialAnalysis.suggestedPrice,
                              latestCommercialAnalysis.currency ?? "MXN",
                            )}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {latestCommercialAnalysis.requestedFeatures.length > 0 ? (
                      <div>
                        <p className="text-gray-500">Funciones solicitadas</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-800">
                          {latestCommercialAnalysis.requestedFeatures.map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {latestCommercialAnalysis.reasons.length > 0 ? (
                      <div>
                        <p className="text-gray-500">Razones del análisis</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-800">
                          {latestCommercialAnalysis.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Aún no hay un análisis guardado para este expediente.
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Tareas</h2>
            <div className="mt-4 space-y-3">
              {(tasks ?? []).map((task) => (
                <div key={task.id} className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {humanizeStatus(task.status)} · {formatDate(task.due_at)}
                  </p>
                </div>
              ))}
              {(tasks ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">Sin tareas.</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold">Cotizaciones y pagos</h2>
              <PrepareQuoteButton leadId={id} />
            </div>
            <div className="mt-4 space-y-3">
              {(quotes ?? []).map((quote) => (
                <div key={quote.id} className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm font-semibold">
                    Cotización V{quote.version} · {formatMoney(Number(quote.total), quote.currency)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {humanizeStatus(quote.status)}
                  </p>
                </div>
              ))}
              {(payments ?? []).map((payment) => (
                <div key={payment.id} className="rounded-xl bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-800">
                    {humanizeStatus(payment.type)} · {formatMoney(Number(payment.amount), payment.currency)}
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    {humanizeStatus(payment.status)} · {formatDate(payment.paid_at)}
                  </p>
                </div>
              ))}
              {(quotes ?? []).length === 0 && (payments ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">Sin movimientos comerciales.</p>
              ) : null}
            </div>
          </article>
        </div>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Conversación</h2>
          <p className="mt-1 text-sm text-gray-500">
            Aquí aparecerán mensajes importados y de WhatsApp.
          </p>

          <div className="mt-6 space-y-4">
            {(messages ?? []).map((message) => {
              const outbound = message.direction === "outbound";
              const content =
                message.body ||
                message.transcription ||
                message.processed_text ||
                `[${message.type}]`;

              return (
                <div
                  key={message.id}
                  className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      outbound
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p>{content}</p>
                    <p
                      className={`mt-2 text-[11px] ${
                        outbound ? "text-blue-100" : "text-gray-400"
                      }`}
                    >
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}

            {(messages ?? []).length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-500">
                Todavía no hay mensajes guardados.
              </p>
            ) : null}
          </div>
        </article>
      </section>
    </>
  );
}
