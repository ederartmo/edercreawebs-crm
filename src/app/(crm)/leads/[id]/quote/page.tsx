import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { QuoteEditor, type QuoteDraft, type ProspectContext } from "./quote-editor";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function relatedRow(value: unknown): Record<string, unknown> {
  return Array.isArray(value) ? record(value[0]) : record(value);
}

function timingLabel(value: string) {
  const labels: Record<string, string> = {
    lo_antes_posible: "Lo antes posible",
    este_mes: "Este mes",
    en_1_2_meses: "En 1–2 meses",
    en_3_meses_o_mas: "En 3 meses o más",
    solo_estoy_explorando: "Solo estoy explorando",
  };
  return labels[value] ?? value;
}

function quoteStatusLabel(status: string) {
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

const budgetLabels: Record<string, string> = {
  menos_de_15k: "Menos de $15,000 MXN",
  "15k_20k": "$15,000–$20,000 MXN",
  "20k_35k": "$20,000–$35,000 MXN",
  "35k_50k": "$35,000–$50,000 MXN",
  "50k_plus": "Más de $50,000 MXN",
};

export default async function QuotePreparationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ quoteId?: string }>;
}) {
  const [{ id: leadId }, { quoteId }] = await Promise.all([params, searchParams]);
  if (!quoteId) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: lead } = await supabase
    .from("leads")
    .select("id,current_quote_id,intake,what_sells,how_sells,main_problem,main_goal,contacts(full_name,email,phone),businesses(name,instagram_url,facebook_url,tiktok_url,website,google_business_url)")
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!lead) notFound();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id,lead_id,owner_id,version,status,project_type,solution_proposed,deliverables,manual_project_price_cents,delivery_timeline,payment_terms,maintenance_mode,maintenance_details,maintenance_price_cents,proposal_notes")
    .eq("id", quoteId)
    .eq("lead_id", leadId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!quote) notFound();

  const intake = record(lead.intake);
  const answers = record(intake.answers);
  const contact = relatedRow(lead.contacts);
  const business = relatedRow(lead.businesses);
  const merged = {
    what_sells: text(lead.what_sells) || text(answers.what_sells),
    customer_acquisition: text(answers.customer_acquisition),
    how_sells: text(lead.how_sells) || text(answers.how_sells),
    main_problem: text(lead.main_problem) || text(answers.main_problem),
    main_goal: text(lead.main_goal) || text(answers.main_goal),
    budget_range: text(answers.budget_range),
    timing: text(answers.timing),
    no_digital_presence: answers.no_digital_presence === true,
    instagram: text(answers.instagram) || text(business.instagram_url),
    facebook: text(answers.facebook) || text(business.facebook_url),
    tiktok: text(answers.tiktok) || text(business.tiktok_url),
    website: text(answers.website) || text(business.website),
    google_business: text(answers.google_business) || text(business.google_business_url),
  };
  const digitalPresence = [
    ["Instagram", merged.instagram],
    ["Facebook", merged.facebook],
    ["TikTok", merged.tiktok],
    ["Sitio web", merged.website],
    ["Google Business", merged.google_business],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const prospect: ProspectContext = {
    clientName: text(contact.full_name),
    email: text(contact.email),
    whatsapp: text(contact.phone),
    businessName: text(business.name),
    whatSells: merged.what_sells,
    acquisition: merged.customer_acquisition,
    salesProcess: merged.how_sells,
    objective: merged.main_goal || merged.main_problem,
    problem: merged.main_problem,
    digitalPresence,
    noDigitalPresence: merged.no_digital_presence,
    budget: budgetLabels[merged.budget_range] ?? merged.budget_range,
    timing: timingLabel(merged.timing),
    visualIntent: false,
  };
  const draft: QuoteDraft = {
    id: quote.id,
    leadId: quote.lead_id,
    version: quote.version,
    status: quote.status,
    project_type: quote.project_type ?? "",
    solution_proposed: quote.solution_proposed ?? "",
    deliverables: Array.isArray(quote.deliverables)
      ? quote.deliverables.filter((item): item is string => typeof item === "string")
      : [],
    manual_project_price_cents: quote.manual_project_price_cents == null
      ? null
      : String(quote.manual_project_price_cents),
    delivery_timeline: quote.delivery_timeline ?? "",
    payment_terms: quote.payment_terms ?? "",
    maintenance_mode: quote.maintenance_mode ?? "",
    maintenance_details: quote.maintenance_details ?? "",
    maintenance_price_cents: quote.maintenance_price_cents == null
      ? null
      : String(quote.maintenance_price_cents),
    proposal_notes: quote.proposal_notes ?? "",
  };

  return (
    <>
      <div className="mb-5">
        <Link href={`/leads/${leadId}`} className="text-sm font-medium text-gray-600 hover:text-gray-950">
          ← Volver a la ficha del lead
        </Link>
      </div>
      <PageHeader
        eyebrow={`Cotización V${draft.version} · ${quoteStatusLabel(draft.status)}`}
        title="Preparar cotización"
        description="El contexto del prospecto es de solo lectura. La propuesta editable es tuya."
      />
      <QuoteEditor quote={draft} prospect={prospect} />
    </>
  );
}
