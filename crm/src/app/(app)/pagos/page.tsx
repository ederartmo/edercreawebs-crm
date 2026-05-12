"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Payment, PaymentStatus } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, ExternalLink } from "lucide-react";

// ── Tipos de join ────────────────────────────────────────────

interface PaymentRow extends Payment {
  projects: {
    id: string;
    title: string;
    clients: {
      id: string;
      name: string;
      company: string | null;
    } | null;
  } | null;
}

// ── Labels y colores ─────────────────────────────────────────

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const ALL_PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "overdue", "cancelled"];

// ── Helpers ───────────────────────────────────────────────────

function toCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function toDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-MX");
}

// ── Componente principal ─────────────────────────────────────

type FilterStatus = PaymentStatus | "all";

export default function PagosPage() {
  const supabase = createClient();

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!supabase) {
      setFetchError("Supabase no está configurado.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*, projects(id, title, clients(id, name, company))")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      setPayments((data as PaymentRow[]) ?? []);
      setFetchError(null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Error al cargar pagos");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  async function handleUpdateStatus(payment: PaymentRow, newStatus: PaymentStatus) {
    if (!supabase) return;
    setUpdatingId(payment.id);
    try {
      const paid_at =
        newStatus === "paid"
          ? new Date().toISOString()
          : payment.status === "paid"
          ? null
          : payment.paid_at;

      const { error } = await supabase
        .from("payments")
        .update({ status: newStatus, paid_at })
        .eq("id", payment.id);

      if (error) throw new Error(error.message);

      setPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id ? { ...p, status: newStatus, paid_at: paid_at ?? null } : p
        )
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(paymentId: string) {
    if (!supabase) return;
    if (!confirm("¿Eliminar este pago? Esta acción no se puede deshacer.")) return;
    setDeletingId(paymentId);
    try {
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw new Error(error.message);
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } finally {
      setDeletingId(null);
    }
  }

  const filtered =
    filterStatus === "all" ? payments : payments.filter((p) => p.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pagos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Vista global de todos los pagos registrados en proyectos.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {filtered.length} {filtered.length === 1 ? "pago" : "pagos"}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Filtrar por estado:</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === "all"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Todos
          </button>
          {ALL_PAYMENT_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {PAYMENT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Estados de carga / error */}
      {loading && (
        <p className="text-sm text-gray-400 italic">Cargando pagos...</p>
      )}
      {fetchError && (
        <p className="text-sm text-red-500">Error: {fetchError}</p>
      )}

      {/* Estado vacío */}
      {!loading && !fetchError && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-gray-400 italic">
            {filterStatus === "all"
              ? "No hay pagos registrados todavía."
              : `No hay pagos con estado "${PAYMENT_STATUS_LABELS[filterStatus]}".`}
          </p>
        </div>
      )}

      {/* Tabla */}
      {!loading && !fetchError && filtered.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Proyecto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Concepto</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 whitespace-nowrap">Monto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Fecha límite</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Fecha de pago</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Método</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((payment) => {
                  const projectTitle = payment.projects?.title ?? "—";
                  const projectId = payment.projects?.id;
                  const clientName = payment.projects?.clients?.name ?? "—";
                  const clientCompany = payment.projects?.clients?.company;
                  const isUpdating = updatingId === payment.id;
                  const isDeleting = deletingId === payment.id;

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                      {/* Proyecto */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {projectId ? (
                          <Link
                            href={`/proyectos/${projectId}`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {projectTitle}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-900">{clientName}</span>
                        {clientCompany && (
                          <span className="block text-xs text-gray-400">{clientCompany}</span>
                        )}
                      </td>

                      {/* Concepto */}
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-700">
                        {payment.concept}
                      </td>

                      {/* Monto */}
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 whitespace-nowrap">
                        {toCurrency(payment.amount)}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Select
                          value={payment.status}
                          onValueChange={(val) =>
                            handleUpdateStatus(payment, val as PaymentStatus)
                          }
                          disabled={isUpdating || isDeleting}
                        >
                          <SelectTrigger className="h-7 w-36 border-0 p-0 shadow-none focus:ring-0">
                            <SelectValue>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[payment.status]}`}
                              >
                                {isUpdating ? "..." : PAYMENT_STATUS_LABELS[payment.status]}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_PAYMENT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[s]}`}
                                >
                                  {PAYMENT_STATUS_LABELS[s]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Fecha límite */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {toDate(payment.due_date)}
                      </td>

                      {/* Fecha de pago */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {payment.paid_at ? toDate(payment.paid_at) : "-"}
                      </td>

                      {/* Método */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {payment.payment_method ?? "-"}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                          onClick={() => handleDelete(payment.id)}
                          disabled={isDeleting || isUpdating}
                          title="Eliminar pago"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
