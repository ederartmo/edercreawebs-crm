import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanizeStatus } from "@/lib/format";
import Link from "next/link";

type InboxRow = {
  conversation_id: string;
  lead_id: string;
  contact_name: string | null;
  phone: string | null;
  business_name: string | null;
  status: string | null;
  lead_score: number | null;
  human_required: boolean | null;
  human_reason: string | null;
  unread_count: number | null;
  last_message_at: string | null;
};

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_inbox")
    .select("*")
    .order("last_message_at", { ascending: false });

  const rows = (data ?? []) as InboxRow[];

  return (
    <>
      <PageHeader
        eyebrow="Bandeja"
        title="Conversaciones"
        description="Los mensajes de WhatsApp aparecerán aquí cuando conectemos el webhook."
      />

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {error ? (
          <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            No se pudo consultar crm_inbox: {error.message}
          </div>
        ) : null}

        <div className="divide-y divide-gray-100">
          {rows.map((row) => (
            <Link
              href={`/leads/${row.lead_id}`}
              key={row.conversation_id}
              className="grid gap-3 px-5 py-5 transition hover:bg-gray-50 md:grid-cols-[1.3fr_1fr_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">
                    {row.business_name || row.contact_name || row.phone || "Contacto"}
                  </p>
                  {(row.unread_count ?? 0) > 0 ? (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                      {row.unread_count}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {row.phone || "Sin teléfono"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">
                  {humanizeStatus(row.status)}
                </p>
                {row.human_required ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Requiere revisión: {row.human_reason || "caso especial"}
                  </p>
                ) : null}
              </div>

              <div className="text-left md:text-right">
                <p className="text-sm font-bold text-blue-700">
                  {row.lead_score ?? 0} pts
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDate(row.last_message_at)}
                </p>
              </div>
            </Link>
          ))}

          {rows.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-gray-500">
              Todavía no hay conversaciones abiertas.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
