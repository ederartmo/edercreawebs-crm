"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Client, ProjectInsert, ProjectType, ProjectWithClient } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  CRM_STATUS_COLORS,
  CRM_STATUS_LABELS,
  DOMAIN_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/crm-helpers";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

function toCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function toDate(value: string | null): string {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-MX");
}

function toFriendlyError(message: string): string {
  if (message.includes("projects_status_requires_deposit")) {
    return "No se puede mover a diseño o desarrollo sin marcar el anticipo como pagado.";
  }
  if (message.includes("projects_delivery_requires_final_payment")) {
    return "No se puede publicar, entregar o pasar a mantenimiento sin marcar el segundo pago como liquidado.";
  }
  return message;
}

export default function ProyectosPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithClient | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingNotice, setSavingNotice] = useState<string | null>(null);

  const supabase = createClient();

  const canCreate = useMemo(() => clients.length > 0, [clients.length]);

  const fetchProjects = useCallback(async () => {
    if (!supabase) {
      setFetchError("Supabase no está configurado.");
      setLoadingProjects(false);
      return;
    }
    setLoadingProjects(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("projects")
      .select("*, clients(id, name, company)")
      .order("created_at", { ascending: false });

    if (error) {
      setFetchError(toFriendlyError(error.message));
    } else {
      setProjects((data as ProjectWithClient[]) ?? []);
    }
    setLoadingProjects(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClients = useCallback(async () => {
    if (!supabase) {
      setLoadingClients(false);
      return;
    }
    setLoadingClients(true);
    const { data } = await supabase
      .from("clients")
      .select("id, name, company, email, phone, rfc, address, website, notes, created_at, updated_at, social_links")
      .order("created_at", { ascending: false });

    setClients((data as Client[]) ?? []);
    setLoadingClients(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, [fetchProjects, fetchClients]);

  async function validateChecklistTrigger(projectId: string) {
    if (!supabase) return;
    const { count, error } = await supabase
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    if (error) {
      setSavingNotice(`Proyecto creado, pero no se pudo verificar checklist: ${error.message}`);
      return;
    }

    if (!count || count === 0) {
      setSavingNotice("Proyecto creado, pero no hay tareas automáticas en project_tasks. Revisa el trigger en Supabase.");
      return;
    }

    setSavingNotice(`Proyecto creado. Checklist automático generado con ${count} tareas.`);
  }

  async function handleCreate(data: ProjectInsert) {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { data: created, error } = await supabase
      .from("projects")
      .insert([data])
      .select("id")
      .single();

    if (error) throw new Error(toFriendlyError(error.message));

    await validateChecklistTrigger(created.id);
    await fetchProjects();
  }

  async function handleEdit(data: ProjectInsert) {
    if (!supabase || !editingProject) {
      throw new Error("Supabase no está configurado.");
    }

    const { error } = await supabase
      .from("projects")
      .update(data)
      .eq("id", editingProject.id);

    if (error) throw new Error(toFriendlyError(error.message));

    setSavingNotice("Proyecto actualizado correctamente.");
    await fetchProjects();
  }

  async function handleDelete(project: ProjectWithClient) {
    if (!supabase) return;
    const confirmed = confirm(
      `¿Eliminar el proyecto "${project.title}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setDeletingId(project.id);
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) {
      setFetchError(toFriendlyError(error.message));
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setSavingNotice("Proyecto eliminado correctamente.");
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proyectos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {loadingProjects
              ? "Cargando..."
              : `${projects.length} proyecto${projects.length !== 1 ? "s" : ""} registrado${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditingProject(null);
            setModalOpen(true);
          }}
          disabled={!canCreate || loadingClients}
          title={!canCreate ? "Crea primero un cliente para asociar el proyecto" : undefined}
        >
          <Plus className="h-4 w-4" />
          Nuevo proyecto
        </Button>
      </div>

      {!canCreate && !loadingClients && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          Necesitas al menos un cliente para crear proyectos.
        </div>
      )}

      {fetchError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          Error en proyectos: {fetchError}
        </div>
      )}

      {savingNotice && (
        <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-4 py-3">
          {savingNotice}
        </div>
      )}

      {loadingProjects && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loadingProjects && !fetchError && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          {projects.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <p>Sin proyectos aún.</p>
              <p className="mt-1">
                Haz clic en <span className="font-medium text-gray-600">Nuevo proyecto</span> para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Proyecto</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Precio</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Dominio</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Fechas</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Próxima acción</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/proyectos/${project.id}`)}>
                        <p className="font-medium text-gray-900">{project.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Anticipo: {toCurrency(project.deposit_amount)} ({project.deposit_paid ? "pagado" : "pendiente"})
                        </p>
                        <p className="text-xs text-gray-500">
                          Segundo pago: {toCurrency(project.final_payment_amount)} ({project.final_payment_paid ? "liquidado" : "pendiente"})
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <p>{project.clients?.name ?? "-"}</p>
                        <p className="text-xs text-gray-500">{project.clients?.company ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {Array.isArray(project.project_type)
                          ? project.project_type
                              .map((t) => PROJECT_TYPE_LABELS[t])
                              .join(", ")
                          : PROJECT_TYPE_LABELS[project.project_type as ProjectType]}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${CRM_STATUS_COLORS[project.status]} border-0`}>
                          {CRM_STATUS_LABELS[project.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{toCurrency(project.total_price)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {DOMAIN_STATUS_LABELS[project.domain_status]}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <p>Inicio: {toDate(project.start_date)}</p>
                        <p>Estimada: {toDate(project.due_date)}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="text-xs text-gray-700 truncate">{project.next_action}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-800"
                            title="Editar proyecto"
                            onClick={() => {
                              setEditingProject(project);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            title="Eliminar proyecto"
                            onClick={() => handleDelete(project)}
                            disabled={deletingId === project.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ProjectFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
        }}
        onSave={editingProject ? handleEdit : handleCreate}
        clients={clients}
        project={editingProject}
      />
    </div>
  );
}
