import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, humanizeStatus } from "@/lib/format";
import { notFound } from "next/navigation";

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
  ]);

  if (!lead) notFound();

  const contact = Array.isArray(lead.contacts)
    ? lead.contacts[0]
    : lead.contacts;
  const business = Array.isArray(lead.businesses)
    ? lead.businesses[0]
    : lead.businesses;

  return (
    <>
      <PageHeader
        eyebrow={humanizeStatus(lead.status)}
        title={business?.name || contact?.full_name || contact?.phone || "Lead"}
        description={lead.conversation_summary || lead.main_problem || "Sin resumen todavía."}
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="space-y-6">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Diagnóstico</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Qué vende</dt>
                <dd className="mt-1 font-medium">{lead.what_sells || "Pendiente"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Cómo vende</dt>
                <dd className="mt-1 font-medium">{lead.how_sells || "Pendiente"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Hace anuncios</dt>
                <dd className="mt-1 font-medium">
                  {lead.runs_ads === null ? "Pendiente" : lead.runs_ads ? "Sí" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Problema principal</dt>
                <dd className="mt-1 font-medium">{lead.main_problem || "Pendiente"}</dd>
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
            <h2 className="font-bold">Cotizaciones y pagos</h2>
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
