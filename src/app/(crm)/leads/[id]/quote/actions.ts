"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CENTS = "9223372036854775807";

type QuoteLookup = {
  id: string;
  version: number;
  status: string;
};

export type SaveQuoteState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function getOwnerClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

export async function prepareQuoteAction(leadId: string): Promise<{
  quoteId?: string;
  error?: string;
}> {
  if (!UUID_PATTERN.test(leadId)) return { error: "No se encontró el lead." };
  const auth = await getOwnerClient();
  if (!auth) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { supabase, user } = auth;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,owner_id,current_quote_id")
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (leadError || !lead) return { error: "No se encontró el lead o no tienes acceso." };

  const findQuote = async (id: string) => {
    const { data, error } = await supabase
      .from("quotes")
      .select("id,version,status")
      .eq("id", id)
      .eq("lead_id", leadId)
      .eq("owner_id", user.id)
      .maybeSingle();
    return { quote: data as QuoteLookup | null, error };
  };

  if (lead.current_quote_id) {
    const { quote: current, error } = await findQuote(lead.current_quote_id);
    if (error) return { error: "No se pudo recuperar la cotización actual." };
    if (current) return { quoteId: current.id };
  }

  const findDraft = async () => {
    const { data, error } = await supabase
      .from("quotes")
      .select("id,version,status")
      .eq("lead_id", leadId)
      .eq("owner_id", user.id)
      .eq("status", "draft")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { draft: data as QuoteLookup | null, error };
  };

  const draftResult = await findDraft();
  if (draftResult.error) return { error: "No se pudo revisar los borradores existentes." };
  let draft = draftResult.draft;
  if (!draft) {
    const { data: latest, error: latestError } = await supabase
      .from("quotes")
      .select("version")
      .eq("lead_id", leadId)
      .eq("owner_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) return { error: "No se pudo revisar el historial de cotizaciones." };

    const nextVersion = (latest?.version ?? 0) + 1;
    const { data: created, error: insertError } = await supabase
      .from("quotes")
      .insert({
        owner_id: user.id,
        lead_id: leadId,
        version: nextVersion,
        status: "draft",
      })
      .select("id,version,status")
      .single();

    if (insertError || !created) {
      // UNIQUE(lead_id, version) serializes concurrent explicit starts. Reuse the
      // winner's draft instead of creating another version on a retry.
      const concurrentDraft = await findDraft();
      if (concurrentDraft.error) return { error: "No se pudo recuperar el borrador creado en paralelo." };
      draft = concurrentDraft.draft;
      if (!draft) return { error: "No se pudo crear el borrador. Intenta nuevamente." };
    } else {
      draft = created as QuoteLookup;
    }
  }

  if (lead.current_quote_id !== draft.id) {
    let linkQuery = supabase
      .from("leads")
      .update({ current_quote_id: draft.id })
      .eq("id", leadId)
      .eq("owner_id", user.id);
    linkQuery = lead.current_quote_id
      ? linkQuery.eq("current_quote_id", lead.current_quote_id)
      : linkQuery.is("current_quote_id", null);
    const { data: linkedLead, error: linkError } = await linkQuery
      .select("current_quote_id")
      .maybeSingle();
    if (linkError) {
      return { error: "El borrador existe, pero no se pudo vincular al lead. Vuelve a intentarlo." };
    }
    if (linkedLead?.current_quote_id !== draft.id) {
      const { data: latestLead, error: latestLeadError } = await supabase
        .from("leads")
        .select("current_quote_id")
        .eq("id", leadId)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (latestLeadError || !latestLead?.current_quote_id) {
        return { error: "El borrador existe, pero no se pudo confirmar su vínculo al lead." };
      }
      const { quote: concurrentCurrent, error: currentError } = await findQuote(latestLead.current_quote_id);
      if (currentError || !concurrentCurrent) {
        return { error: "El lead cambió de cotización. Vuelve a intentarlo." };
      }
      return { quoteId: concurrentCurrent.id };
    }
  }

  revalidatePath(`/leads/${leadId}`);
  return { quoteId: draft.id };
}

function parsePesosToCents(value: FormDataEntryValue | null): string | null | "invalid" {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const match = /^(\d{1,17})(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) return "invalid";
  const whole = match[1].replace(/^0+(?=\d)/, "");
  const cents = `${whole}${(match[2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
  if (cents.length > MAX_CENTS.length || (cents.length === MAX_CENTS.length && cents > MAX_CENTS)) return "invalid";
  return cents;
}

function textField(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function saveQuoteAction(
  _previousState: SaveQuoteState,
  formData: FormData,
): Promise<SaveQuoteState> {
  const leadId = textField(formData, "leadId", 36);
  const quoteId = textField(formData, "quoteId", 36);
  if (!UUID_PATTERN.test(leadId) || !UUID_PATTERN.test(quoteId)) {
    return { status: "error", message: "No se pudo validar la cotización." };
  }
  const auth = await getOwnerClient();
  if (!auth) return { status: "error", message: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { supabase, user } = auth;

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id,status")
    .eq("id", quoteId)
    .eq("lead_id", leadId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (quoteError || !quote) return { status: "error", message: "No se encontró el borrador." };
  if (quote.status !== "draft") {
    return { status: "error", message: "Esta cotización ya no está en borrador y no se puede editar aquí." };
  }

  const projectPrice = parsePesosToCents(formData.get("manualProjectPricePesos"));
  const maintenancePrice = parsePesosToCents(formData.get("maintenancePricePesos"));
  if (projectPrice === "invalid" || maintenancePrice === "invalid") {
    return { status: "error", message: "Revisa los importes: usa pesos, sin separadores y con hasta dos decimales." };
  }

  const projectType = textField(formData, "project_type", 120);
  const solution = textField(formData, "solution_proposed", 4000);
  const timeline = textField(formData, "delivery_timeline", 500);
  const paymentTerms = textField(formData, "payment_terms", 2000);
  const maintenanceModeRaw = textField(formData, "maintenance_mode", 16);
  const maintenanceMode = maintenanceModeRaw || null;
  if (maintenanceMode && !["none", "optional", "included"].includes(maintenanceMode)) {
    return { status: "error", message: "Selecciona una modalidad de mantenimiento válida." };
  }
  const maintenanceDetails = textField(formData, "maintenance_details", 2000);
  const proposalNotes = textField(formData, "proposal_notes", 4000);
  const rawDeliverables = formData.getAll("deliverables");
  if (rawDeliverables.length > 40 || rawDeliverables.some((item) => typeof item !== "string")) {
    return { status: "error", message: "La lista de entregables excede el límite permitido." };
  }
  const deliverables = rawDeliverables
    .map((item) => String(item).trim().slice(0, 200))
    .filter(Boolean);

  const { data: saved, error: updateError } = await supabase
    .from("quotes")
    .update({
      project_type: projectType || null,
      solution_proposed: solution || null,
      deliverables,
      manual_project_price_cents: projectPrice,
      delivery_timeline: timeline || null,
      payment_terms: paymentTerms || null,
      maintenance_mode: maintenanceMode,
      maintenance_details: maintenanceDetails || null,
      maintenance_price_cents: maintenancePrice,
      proposal_notes: proposalNotes || null,
    })
    .eq("id", quoteId)
    .eq("lead_id", leadId)
    .eq("owner_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (updateError || !saved) {
    return { status: "error", message: "No se guardó el borrador. Conservamos tus cambios en pantalla; inténtalo de nuevo." };
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/quote`);
  return { status: "success", message: "Borrador guardado." };
}
