"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CrmStatus, PaymentStatus } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { CRM_STATUS_COLORS, CRM_STATUS_LABELS } from "@/lib/crm-helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  FolderKanban,
  CreditCard,
  Send,
  Clock4,
  AlertOctagon,
  ExternalLink,
  DollarSign,
} from "lucide-react";

interface ProjectDashboardRow {
  id: string;
  title: string;
  status: CrmStatus;
  next_action: string;
  due_date: string | null;
  total_price: number;
  deposit_amount: number;
  deposit_paid: boolean;
  final_payment_amount: number;
  final_payment_paid: boolean;
  clients: {
    name: string;
    company: string | null;
  } | null;
}

interface PendingPaymentRow {
  id: string;
  project_id: string;
  concept: string;
  amount: number;
  status: PaymentStatus;
  due_date: string | null;
  projects: {
    id: string;
    title: string;
    clients: {
      name: string;
      company: string | null;
    } | null;
  } | null;
}

interface BlockedTaskRow {
  id: string;
  title: string;
  project_id: string;
  projects: {
    id: string;
    title: string;
    clients: {
      name: string;
      company: string | null;
    } | null;
  } | null;
}

interface DashboardStats {
  leadsActivos: number;
  clientes: number;
  proyectosEnCurso: number;
  pagosPendientesMonto: number;
  totalCobrado: number;
  cotizacionesEnviadas: number;
  esperandoAnticipo: number;
  tareasBloqueadas: number;
}

const PENDING_PAYMENT_STATUS_LABELS: Record<"pending" | "overdue", string> = {
  pending: "Pendiente",
  overdue: "Vencido",
};

const PENDING_PAYMENT_STATUS_COLORS: Record<"pending" | "overdue", string> = {
  pending: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
};

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

function getClientLabel(client: { name: string; company: string | null } | null): string {
  if (!client) return "-";
  return client.company || client.name;
}

function getProjectPendingAmount(project: ProjectDashboardRow): number {
  const paidTotal =
    (project.deposit_paid ? project.deposit_amount : 0) +
    (project.final_payment_paid ? project.final_payment_amount : 0);
  return Math.max(project.total_price - paidTotal, 0);
}

export default function DashboardPage() {
  const supabase = createClient();

  const [projects, setProjects] = useState<ProjectDashboardRow[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentRow[]>([]);
  const [blockedTasks, setBlockedTasks] = useState<BlockedTaskRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    leadsActivos: 0,
    clientes: 0,
    proyectosEnCurso: 0,
    pagosPendientesMonto: 0,
    totalCobrado: 0,
    cotizacionesEnviadas: 0,
    esperandoAnticipo: 0,
    tareasBloqueadas: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!supabase) {
        setError("Supabase no está configurado.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [leadsRes, clientsRes, projectsRes, paymentsRes, paidPaymentsRes, tasksRes] = await Promise.all([
          supabase.from("leads").select("status"),
          supabase.from("clients").select("id", { count: "exact" }),
          supabase
            .from("projects")
            .select(
              "id, title, status, next_action, due_date, total_price, deposit_amount, deposit_paid, final_payment_amount, final_payment_paid, clients(name, company)"
            ),
          supabase
            .from("payments")
            .select(
              "id, project_id, concept, amount, status, due_date, projects(id, title, clients(name, company))"
            )
            .in("status", ["pending", "overdue"])
            .order("due_date", { ascending: true, nullsFirst: false }),
          supabase
            .from("payments")
            .select("amount")
            .eq("status", "paid"),
          supabase
            .from("project_tasks")
            .select("id, title, project_id, projects(id, title, clients(name, company))")
            .eq("status", "blocked"),
        ]);

        if (leadsRes.error) throw new Error(leadsRes.error.message);
        if (clientsRes.error) throw new Error(clientsRes.error.message);
        if (projectsRes.error) throw new Error(projectsRes.error.message);
        if (paymentsRes.error) throw new Error(paymentsRes.error.message);
        if (paidPaymentsRes.error) throw new Error(paidPaymentsRes.error.message);
        if (tasksRes.error) throw new Error(tasksRes.error.message);

        const leads = leadsRes.data ?? [];
        const allProjects = (projectsRes.data as unknown as ProjectDashboardRow[]) ?? [];
        const blocked = (tasksRes.data as unknown as BlockedTaskRow[]) ?? [];
        const pending = (paymentsRes.data as unknown as PendingPaymentRow[]) ?? [];
        const paidPayments = paidPaymentsRes.data ?? [];

        const leadsActivos = leads.filter((lead) => lead.status !== "perdido").length;
        const leadsCotizacion = leads.filter(
          (lead) => lead.status === "cotizacion_enviada"
        ).length;

        const projectsCotizacion = allProjects.filter(
          (project) => project.status === "cotizacion_enviada"
        ).length;

        const proyectosEnCurso = allProjects.filter(
          (project) =>
            project.status !== "entregado" &&
            project.status !== "mantenimiento" &&
            project.status !== "perdido"
        ).length;

        const esperandoAnticipo = allProjects.filter(
          (project) => project.status === "esperando_anticipo"
        ).length;

        const pagosPendientesMonto = pending.reduce((sum, payment) => sum + payment.amount, 0);
        const totalCobrado = paidPayments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);

        setProjects(allProjects);
        setPendingPayments(pending);
        setBlockedTasks(blocked);
        setStats({
          leadsActivos,
          clientes: clientsRes.count ?? 0,
          proyectosEnCurso,
          pagosPendientesMonto,
          totalCobrado,
          cotizacionesEnviadas: leadsCotizacion + projectsCotizacion,
          esperandoAnticipo,
          tareasBloqueadas: blocked.length,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [supabase]);

  const projectsWithActions = useMemo(
    () =>
      projects
        .filter((project) => project.next_action.trim().length > 0)
        .sort((a, b) => {
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return a.title.localeCompare(b.title);
        }),
    [projects]
  );

  const projectStatusSummary = useMemo(() => {
    const grouped = new Map<CrmStatus, number>();
    for (const project of projects) {
      grouped.set(project.status, (grouped.get(project.status) ?? 0) + 1);
    }
    return Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
  }, [projects]);

  const statCards = [
    {
      label: "Leads activos",
      value: stats.leadsActivos,
      icon: Users,
      description: "Leads que no están perdidos",
      href: "/leads",
    },
    {
      label: "Clientes",
      value: stats.clientes,
      icon: UserCheck,
      description: "Total de clientes registrados",
      href: "/clientes",
    },
    {
      label: "Proyectos en curso",
      value: stats.proyectosEnCurso,
      icon: FolderKanban,
      description: "Sin entregados, mantenimiento o perdidos",
      href: "/proyectos",
    },
    {
      label: "Total cobrado",
      value: toCurrency(stats.totalCobrado),
      icon: DollarSign,
      description: "Pagos completados",
      href: "/pagos",
    },
    {
      label: "Pagos pendientes",
      value: toCurrency(stats.pagosPendientesMonto),
      icon: CreditCard,
      description: "Suma de pending y overdue",
      href: "/pagos",
    },
    {
      label: "Cotizaciones enviadas",
      value: stats.cotizacionesEnviadas,
      icon: Send,
      description: "Leads + proyectos en cotización enviada",
      href: "/leads",
    },
    {
      label: "Esperando anticipo",
      value: stats.esperandoAnticipo,
      icon: Clock4,
      description: "Proyectos en espera de anticipo",
      href: "/proyectos",
    },
    {
      label: "Tareas bloqueadas",
      value: stats.tareasBloqueadas,
      icon: AlertOctagon,
      description: "Checklist bloqueado por resolver",
      href: "/proyectos",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Qué atender hoy en el CRM.</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          Error al cargar dashboard: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, description, href }) => (
          <Link key={label} href={href} className="block">
            <Card className="border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
                <Icon className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : value}
                </div>
                <CardDescription className="text-xs text-gray-400 mt-1">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700">Próximas acciones</CardTitle>
          <CardDescription className="text-xs text-gray-400">
            Proyectos con seguimiento pendiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400 italic">Cargando próximas acciones...</p>
          ) : projectsWithActions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No hay próximas acciones pendientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Proyecto</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Estado</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Próxima acción</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Fecha estimada</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Monto pendiente</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectsWithActions.map((project) => (
                    <tr key={project.id}>
                      <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                        {project.title}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {getClientLabel(project.clients)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge className={`${CRM_STATUS_COLORS[project.status]} border-0`}>
                          {CRM_STATUS_LABELS[project.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[300px] truncate">
                        {project.next_action}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {toDate(project.due_date)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap font-medium">
                        {toCurrency(getProjectPendingAmount(project))}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`/proyectos/${project.id}`}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                        >
                          Abrir
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700">Pagos pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-400 italic">Cargando pagos...</p>
            ) : pendingPayments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No hay pagos pendientes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Proyecto</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Cliente</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Concepto</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Monto</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Estado</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Fecha límite</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingPayments.map((payment) => {
                      const readableStatus =
                        payment.status === "overdue" ? "overdue" : "pending";
                      return (
                        <tr key={payment.id}>
                          <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                            {payment.projects?.title ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {getClientLabel(payment.projects?.clients ?? null)}
                          </td>
                          <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">
                            {payment.concept}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                            {toCurrency(payment.amount)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Badge className={`${PENDING_PAYMENT_STATUS_COLORS[readableStatus]} border-0`}>
                              {PENDING_PAYMENT_STATUS_LABELS[readableStatus]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {toDate(payment.due_date)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {payment.project_id ? (
                              <Link
                                href={`/proyectos/${payment.project_id}`}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                              >
                                Abrir
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700">Proyectos por estado</CardTitle>
            <CardDescription className="text-xs text-gray-400">
              Distribución actual del pipeline de proyectos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-400 italic">Cargando estados...</p>
            ) : projectStatusSummary.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin proyectos registrados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projectStatusSummary.map(([status, count]) => (
                  <div
                    key={status}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5"
                  >
                    <Badge className={`${CRM_STATUS_COLORS[status]} border-0`}>
                      {CRM_STATUS_LABELS[status]}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-700">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700">Tareas bloqueadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400 italic">Cargando tareas bloqueadas...</p>
          ) : blockedTasks.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No hay tareas bloqueadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Proyecto</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Tarea</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {blockedTasks.map((task) => (
                    <tr key={task.id}>
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {task.projects?.title ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {getClientLabel(task.projects?.clients ?? null)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{task.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {task.project_id ? (
                          <Link
                            href={`/proyectos/${task.project_id}`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                          >
                            Abrir
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
