import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, humanizeStatus } from "@/lib/format";
import Link from "next/link";

type LeadListRow = {
  id: string;
  status: string;
  project_type: string;
  lead_score: number;
  approved_price: number | null;
  suggested_price: number | null;
  currency: string;
  contacts:
    | { full_name: string | null; phone: string }
    | { full_name: string | null; phone: string }[]
    | null;
  businesses:
    | { name: string | null; industry: string | null }
    | { name: string | null; industry: string | null }[]
    | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id,status,project_type,lead_score,approved_price,suggested_price,currency,contacts(full_name,phone),businesses(name,industry)",
    )
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as LeadListRow[];

  return (
    <>
      <PageHeader
        eyebrow="Base comercial"
        title="Leads"
        description="Vista completa de los prospectos registrados."
      />

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_110px] gap-4 border-b border-gray-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400 md:grid">
          <span>Prospecto</span>
          <span>Etapa</span>
          <span>Proyecto</span>
          <span className="text-right">Valor</span>
        </div>

        <div className="divide-y divide-gray-100">
          {leads.map((lead) => {
            const contact = firstRelation(lead.contacts);
            const business = firstRelation(lead.businesses);
            const value = lead.approved_price ?? lead.suggested_price;

            return (
              <Link
                href={`/leads/${lead.id}`}
                key={lead.id}
                className="grid gap-3 px-5 py-5 transition hover:bg-gray-50 md:grid-cols-[1.4fr_1fr_1fr_110px] md:items-center"
              >
                <div>
                  <p className="font-semibold">
                    {business?.name || contact?.full_name || contact?.phone || "Lead"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {business?.industry || contact?.phone || "Sin giro"}
                  </p>
                </div>
                <span className="text-sm">{humanizeStatus(lead.status)}</span>
                <span className="text-sm">{humanizeStatus(lead.project_type)}</span>
                <div className="md:text-right">
                  <p className="font-semibold">
                    {value ? formatMoney(value, lead.currency) : "Por definir"}
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    {lead.lead_score} pts
                  </p>
                </div>
              </Link>
            );
          })}

          {leads.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-gray-500">
              Aún no hay leads registrados.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
