import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/cloud";

function cleanPhone(value: string | undefined) {
  return (value ?? "").replace(/[^0-9]/g, "");
}

export async function notifyAdminOfWhatsAppHandoff(args: {
  leadId: string;
  leadPhone: string;
  leadName: string | null;
}) {
  const adminPhone = cleanPhone(process.env.WHATSAPP_ADMIN_PHONE);
  if (!adminPhone) {
    console.warn("WhatsApp admin alert skipped: WHATSAPP_ADMIN_PHONE is not configured");
    return false;
  }

  const supabase = createAdminClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("what_sells,how_sells")
    .eq("id", args.leadId)
    .maybeSingle();

  if (error) {
    console.error("WhatsApp admin alert could not load lead context", error);
  }

  const crmBaseUrl = (process.env.CRM_BASE_URL ?? "").trim().replace(/\/$/, "");
  const leadUrl = crmBaseUrl ? `${crmBaseUrl}/leads/${args.leadId}` : "";
  const leadLabel = args.leadName?.trim() || args.leadPhone;

  const alert = [
    "🔥 Nuevo lead calificado por WhatsApp",
    `Lead: ${leadLabel}`,
    `Teléfono: ${args.leadPhone}`,
    `Qué vende: ${lead?.what_sells?.trim() || "Pendiente"}`,
    `Cómo vende: ${lead?.how_sells?.trim() || "Pendiente"}`,
    "El bot ya terminó el diagnóstico inicial y quedó pausado para seguimiento humano.",
    leadUrl ? `Abrir CRM: ${leadUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    await sendWhatsAppText(adminPhone, alert);
    return true;
  } catch (error) {
    // The customer handoff must stay successful even if the internal alert fails.
    console.error("WhatsApp admin alert failed", error);
    return false;
  }
}
