import type { SupabaseClient } from "@supabase/supabase-js";

type PaymentBucket = "deposit" | "final" | "other";

type PaymentStatusValue = "pending" | "paid" | "overdue" | "cancelled";

interface PaymentConceptRow {
  concept: string;
  status: PaymentStatusValue;
}

export interface ProjectPaymentFlags {
  deposit_paid: boolean;
  final_payment_paid: boolean;
}

function normalizeConcept(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function classifyPaymentConcept(concept: string): PaymentBucket {
  const normalized = normalizeConcept(concept);

  if (normalized.includes("anticipo")) {
    return "deposit";
  }

  if (normalized.includes("segundo pago") || normalized.includes("pago final")) {
    return "final";
  }

  return "other";
}

export async function syncProjectPaymentFlags(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectPaymentFlags> {
  const { data, error } = await supabase
    .from("payments")
    .select("concept, status")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`No se pudo recalcular pagos del proyecto: ${error.message}`);
  }

  const rows = ((data as PaymentConceptRow[] | null) ?? []);

  const flags = rows.reduce<ProjectPaymentFlags>(
    (acc, payment) => {
      if (payment.status !== "paid") {
        return acc;
      }

      const bucket = classifyPaymentConcept(payment.concept || "");
      if (bucket === "deposit") {
        acc.deposit_paid = true;
      }
      if (bucket === "final") {
        acc.final_payment_paid = true;
      }

      return acc;
    },
    { deposit_paid: false, final_payment_paid: false }
  );

  const { error: updateError } = await supabase
    .from("projects")
    .update(flags)
    .eq("id", projectId);

  if (updateError) {
    throw new Error(`No se pudo sincronizar flags del proyecto: ${updateError.message}`);
  }

  return flags;
}
