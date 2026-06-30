import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { humanizeStatus } from "@/lib/format";
import Link from "next/link";

const columns = [
  "nuevo",
  "diagnostico",
  "calificado",
  "activos_solicitados",
  "activos_recibidos",
  "propuesta_visual",
  "cotizacion_enviada",
  "seguimiento",
  "anticipo_programado",
  "anticipo_recibido",
];

type PipelineLead = {
  id: string;
  status: string;
  lead_score: number;
  intention_level: string | null;
  contacts:
    | { full_name: string | null; phone: string }
    | { full_name: string | null; phone: string }[]
    | null;
  businesses:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id,status,lead_score,intention_level,contacts(full_name,phone),businesses(name)",
    )
    .order("lead_score", { ascending: false });

  const leads = (data ?? []) as PipelineLead[];

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Pipeline"
        description="Cada columna representa la etapa comercial actual del prospecto."
      />

      <div className="overflow-x-auto pb-4">
        <section className="grid min-w-max auto-cols-[290px] grid-flow-col gap-4">
          {columns.map((status) => {
            const items = leads.filter((lead) => lead.status === status);

            return (
              <div
                key={status}
                className="rounded-2xl border border-gray-200 bg-white/70 p-3"
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <h2 className="text-sm font-bold">{humanizeStatus(status)}</h2>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                    {items.length}
                  </span>
                </div>

                <div className="mt-2 space-y-3">
                  {items.map((lead) => {
                    const contact = firstRelation(lead.contacts);
                    const business = firstRelation(lead.businesses);

                    return (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <p className="font-semibold">
                          {business?.name ||
                            contact?.full_name ||
                            contact?.phone ||
                            "Lead"}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {lead.intention_level || "Sin nivel"}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                            {lead.lead_score}
                          </span>
                        </div>
                      </Link>
                    );
                  })}

                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-400">
                      Sin prospectos
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
