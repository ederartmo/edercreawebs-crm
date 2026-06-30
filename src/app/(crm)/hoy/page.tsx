import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanizeStatus } from "@/lib/format";
import {
  AlarmClock,
  CircleDollarSign,
  MessageSquareWarning,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

type LeadRow = {
  id: string;
  status: string;
  lead_score: number;
  human_required: boolean;
  next_followup_at: string | null;
  created_at: string;
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

export default async function TodayPage() {
  const supabase = await createClient();

  const [{ data: leadsData }, { data: tasksData }, { data: paymentsData }] =
    await Promise.all([
      supabase
        .from("leads")
        .select(
          "id,status,lead_score,human_required,next_followup_at,created_at,contacts(full_name,phone),businesses(name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id,title,due_at,priority,status,lead_id")
        .eq("status", "pending")
        .order("due_at", { ascending: true })
        .limit(8),
      supabase
        .from("payments")
        .select("id,status,amount,type")
        .eq("status", "confirmed"),
    ]);

  const leads = (leadsData ?? []) as LeadRow[];
  const tasks = tasksData ?? [];
  const payments = paymentsData ?? [];

  const activeLeads = leads.filter(
    (lead) => !["entregado", "perdido"].includes(lead.status),
  );
  const highPriority = leads.filter((lead) => lead.lead_score >= 10);
  const humanReview = leads.filter((lead) => lead.human_required);
  const deposits = payments
    .filter((payment) => payment.type === "deposito")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Panel comercial"
        title="Lo que requiere atención hoy"
        description="Aquí aparecen prospectos activos, revisiones humanas y seguimientos pendientes."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leads activos"
          value={activeLeads.length}
          hint="Excluye entregados y perdidos"
          icon={UsersRound}
        />
        <StatCard
          label="Prioridad alta"
          value={highPriority.length}
          hint="Puntuación de 10 o más"
          icon={AlarmClock}
        />
        <StatCard
          label="Revisión humana"
          value={humanReview.length}
          hint="Precios, negociación o casos especiales"
          icon={MessageSquareWarning}
        />
        <StatCard
          label="Anticipos registrados"
          value={new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
          }).format(deposits)}
          hint="Pagos confirmados"
          icon={CircleDollarSign}
        />
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Prospectos recientes</h2>
              <p className="mt-1 text-sm text-gray-500">
                Últimos contactos registrados en el CRM.
              </p>
            </div>
            <Link href="/pipeline" className="text-sm font-semibold text-blue-600">
              Ver pipeline
            </Link>
          </div>

          <div className="mt-5 divide-y divide-gray-100">
            {leads.slice(0, 8).map((lead) => {
              const contact = firstRelation(lead.contacts);
              const business = firstRelation(lead.businesses);

              return (
                <Link
                  href={`/leads/${lead.id}`}
                  key={lead.id}
                  className="flex items-center justify-between gap-4 py-4 transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {business?.name || contact?.full_name || contact?.phone || "Lead"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {humanizeStatus(lead.status)}
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {lead.lead_score} pts
                  </div>
                </Link>
              );
            })}

            {leads.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
                Todavía no hay leads. La oficina está sospechosamente tranquila.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Tareas pendientes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Seguimientos y aprobaciones.
          </p>

          <div className="mt-5 space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4"
              >
                <p className="text-sm font-semibold">{task.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDate(task.due_at)}
                </p>
              </div>
            ))}

            {tasks.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
                No hay tareas pendientes.
              </p>
            ) : null}
          </div>
        </article>
      </section>
    </>
  );
}
