import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanizeStatus } from "@/lib/format";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id,title,description,status,priority,due_at,created_by_type")
    .order("due_at", { ascending: true });

  const tasks = data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Tareas"
        description="Seguimientos, cotizaciones, revisiones y pendientes."
      />

      <section className="grid gap-4">
        {tasks.map((task) => (
          <article
            key={task.id}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{task.title}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {task.description || "Sin descripción"}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                {humanizeStatus(task.status)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>Fecha: {formatDate(task.due_at)}</span>
              <span>Prioridad: {task.priority}</span>
              <span>Origen: {task.created_by_type}</span>
            </div>
          </article>
        ))}

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-16 text-center text-sm text-gray-500">
            No hay tareas registradas.
          </div>
        ) : null}
      </section>
    </>
  );
}
