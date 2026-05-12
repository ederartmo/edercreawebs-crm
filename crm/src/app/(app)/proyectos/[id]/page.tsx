"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  ProjectWithClient,
  ProjectTask,
  ProjectNote,
  Payment,
  ProjectLink,
  ProjectTaskUpdate,
  PaymentUpdate,
} from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  CRM_STATUS_COLORS,
  CRM_STATUS_LABELS,
  DOMAIN_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/crm-helpers";
import { ProjectChecklistSection } from "@/components/projects/ProjectChecklistSection";
import { ProjectNotesSection } from "@/components/projects/ProjectNotesSection";
import { ProjectPaymentsSection } from "@/components/projects/ProjectPaymentsSection";
import { ProjectLinksSection } from "@/components/projects/ProjectLinksSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil } from "lucide-react";

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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectWithClient | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function fetchProjectData() {
    if (!supabase || !projectId) {
      setError("Supabase no está configurado o falta el ID del proyecto.");
      setLoading(false);
      return;
    }

    try {
      // Fetch project
      const { data: projectData, error: projectErr } = await supabase
        .from("projects")
        .select("*, clients(id, name, company, email, phone)")
        .eq("id", projectId)
        .single();

      if (projectErr) throw new Error(`Proyecto no encontrado: ${projectErr.message}`);

      setProject(projectData as ProjectWithClient);

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });

      setTasks((tasksData as ProjectTask[]) ?? []);

      // Fetch notes
      const { data: notesData } = await supabase
        .from("project_notes")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      setNotes((notesData as ProjectNote[]) ?? []);

      // Fetch payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      setPayments((paymentsData as Payment[]) ?? []);

      // Fetch links
      const { data: linksData } = await supabase
        .from("project_links")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      setLinks((linksData as ProjectLink[]) ?? []);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar proyecto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjectData();
  }, [projectId, supabase]);

  async function handleUpdateTask(taskId: string, newStatus: string) {
    if (!supabase) return;

    const completed_at =
      newStatus === "done" ? new Date().toISOString() : null;

    const { error } = await supabase
      .from("project_tasks")
      .update({ status: newStatus, completed_at })
      .eq("id", taskId);

    if (!error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus as any, completed_at } : t
        )
      );
    }
  }

  async function handleAddNote(noteInsert: { project_id: string; note: string }) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("project_notes")
      .insert([noteInsert])
      .select("*")
      .single();

    if (!error) {
      setNotes((prev) => [data as ProjectNote, ...prev]);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!supabase) return;

    const { error } = await supabase.from("project_notes").delete().eq("id", noteId);

    if (!error) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  }

  async function handleAddPayment(paymentInsert: any) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("payments")
      .insert([paymentInsert])
      .select("*")
      .single();

    if (!error) {
      setPayments((prev) => [data as Payment, ...prev]);
    }
  }

  async function handleUpdatePayment(paymentId: string, updates: Partial<Payment>) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("payments")
      .update(updates)
      .eq("id", paymentId)
      .select("*")
      .single();

    if (!error) {
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? (data as Payment) : p))
      );
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!supabase) return;

    const { error } = await supabase.from("payments").delete().eq("id", paymentId);

    if (!error) {
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    }
  }

  async function handleAddLink(linkInsert: any) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("project_links")
      .insert([linkInsert])
      .select("*")
      .single();

    if (!error) {
      setLinks((prev) => [data as ProjectLink, ...prev]);
    }
  }

  async function handleDeleteLink(linkId: string) {
    if (!supabase) return;

    const { error } = await supabase.from("project_links").delete().eq("id", linkId);

    if (!error) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => router.push("/proyectos")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a proyectos
        </Button>
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {error || "Proyecto no encontrado."}
        </div>
      </div>
    );
  }

  const totalPending = project.total_price - (project.deposit_amount + project.final_payment_amount);
  const paidTotal = (project.deposit_paid ? project.deposit_amount : 0) +
    (project.final_payment_paid ? project.final_payment_amount : 0);
  const stillPending = project.total_price - paidTotal;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/proyectos")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <Badge className={`${CRM_STATUS_COLORS[project.status]} border-0`}>
              {CRM_STATUS_LABELS[project.status]}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          <p className="text-gray-600 mt-2">
            {project.clients?.name}
            {project.clients?.company ? ` · ${project.clients.company}` : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/proyectos?edit=${projectId}`)}
          className="gap-2"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Project Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Resumen */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Información</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Tipo:</span>
              <span className="font-medium">{PROJECT_TYPE_LABELS[project.project_type]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Próxima acción:</span>
              <span className="font-medium text-right max-w-[200px]">{project.next_action}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Dominio:</span>
              <span className="font-medium">{DOMAIN_STATUS_LABELS[project.domain_status]}</span>
            </div>
          </div>
        </div>

        {/* Fechas */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Fechas</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Inicio:</span>
              <span className="font-medium">{toDate(project.start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estimada:</span>
              <span className="font-medium">{toDate(project.due_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Contacto cliente:</span>
              <span className="font-medium text-right">
                {project.clients?.phone || project.clients?.email || "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen Financiero */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Resumen Financiero</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-gray-600">Precio total</p>
            <p className="text-lg font-semibold text-gray-900">
              {toCurrency(project.total_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Anticipo</p>
            <p className="text-lg font-semibold text-gray-900">
              {toCurrency(project.deposit_amount)}
            </p>
            <Badge
              variant="outline"
              className={`mt-1 text-xs ${
                project.deposit_paid
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {project.deposit_paid ? "Pagado" : "Pendiente"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-gray-600">Segundo pago</p>
            <p className="text-lg font-semibold text-gray-900">
              {toCurrency(project.final_payment_amount)}
            </p>
            <Badge
              variant="outline"
              className={`mt-1 text-xs ${
                project.final_payment_paid
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {project.final_payment_paid ? "Liquidado" : "Pendiente"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-gray-600">Pagado</p>
            <p className="text-lg font-semibold text-green-600">{toCurrency(paidTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Pendiente</p>
            <p className="text-lg font-semibold text-red-600">{toCurrency(stillPending)}</p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <ProjectChecklistSection
          tasks={tasks}
          onUpdateTask={handleUpdateTask}
          loading={loading}
        />
      </div>

      {/* Notas y Pagos en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <ProjectNotesSection
            notes={notes}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            loading={loading}
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <ProjectPaymentsSection
            payments={payments}
            projectId={projectId}
            onAddPayment={handleAddPayment}
            onUpdatePayment={handleUpdatePayment}
            onDeletePayment={handleDeletePayment}
            loading={loading}
          />
        </div>
      </div>

      {/* Links */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <ProjectLinksSection
          links={links}
          projectId={projectId}
          onAddLink={handleAddLink}
          onDeleteLink={handleDeleteLink}
          loading={loading}
        />
      </div>
    </div>
  );
}
