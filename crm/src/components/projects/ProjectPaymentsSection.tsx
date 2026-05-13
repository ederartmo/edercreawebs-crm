"use client";

import { useState } from "react";
import type { Payment, PaymentInsert, PaymentStatus, PaymentMethod } from "@/types";
import { PAYMENT_METHOD_LABELS, ALL_PAYMENT_METHODS } from "@/lib/crm-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

interface ProjectPaymentsSectionProps {
  payments: Payment[];
  projectId: string;
  onAddPayment: (payment: PaymentInsert) => Promise<void>;
  onUpdatePayment: (paymentId: string, updates: Partial<Payment>) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  loading?: boolean;
}

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

export function ProjectPaymentsSection({
  payments,
  projectId,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  loading,
}: ProjectPaymentsSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    concept: "",
    amount: "0",
    due_date: "",
    payment_method: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleAddPayment() {
    if (!form.concept.trim() || Number(form.amount) <= 0) return;

    setSaving(true);
    try {
      await onAddPayment({
        project_id: projectId,
        concept: form.concept.trim(),
        amount: Number(form.amount),
        status: "pending",
        due_date: form.due_date || null,
        paid_at: null,
        payment_method: form.payment_method || null,
        notes: null,
      });
      setForm({ concept: "", amount: "0", due_date: "", payment_method: "" });
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(paymentId: string, newStatus: PaymentStatus) {
    setUpdatingId(paymentId);
    try {
      const paid_at = newStatus === "paid" ? new Date().toISOString() : null;
      await onUpdatePayment(paymentId, { status: newStatus, paid_at });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm("¿Eliminar este pago?")) return;

    setDeletingId(paymentId);
    try {
      await onDeletePayment(paymentId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Pagos</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFormOpen(!formOpen)}
          className="gap-2"
          disabled={saving || loading}
        >
          <Plus className="h-3.5 w-3.5" />
          Pago nuevo
        </Button>
      </div>

      {formOpen && (
        <div className="space-y-3 p-4 rounded-lg border border-blue-200 bg-blue-50">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-concept">Concepto</Label>
              <Input
                id="payment-concept"
                value={form.concept}
                onChange={(e) => setForm({ ...form, concept: e.target.value })}
                placeholder="Ej: Anticipo 50%"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Monto</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-duedate">Fecha límite</Label>
              <Input
                id="payment-duedate"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Método de pago</Label>
              <Select
                value={form.payment_method}
                onValueChange={(val) => setForm({ ...form, payment_method: val })}
                disabled={saving}
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAddPayment}
              disabled={!form.concept.trim() || Number(form.amount) <= 0 || saving}
            >
              {saving ? "Guardando..." : "Guardar pago"}
            </Button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-gray-500">No hay pagos registrados.</p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{payment.concept}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {toCurrency(payment.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Vence: {toDate(payment.due_date)}</span>
                  {payment.paid_at && (
                    <span>Pagado: {toDate(payment.paid_at)}</span>
                  )}
                </div>
              </div>

              <Select
                value={payment.status}
                onValueChange={(v) => handleUpdateStatus(payment.id, v as PaymentStatus)}
                disabled={updatingId === payment.id || loading}
              >
                <SelectTrigger className={`h-7 text-xs w-auto gap-1 ${PAYMENT_STATUS_COLORS[payment.status]} border-0 shadow-none`}>
                  <SelectValue>{PAYMENT_STATUS_LABELS[payment.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["pending", "paid", "overdue", "cancelled"] as PaymentStatus[]).map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {PAYMENT_STATUS_LABELS[status]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                onClick={() => handleDeletePayment(payment.id)}
                disabled={deletingId === payment.id}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
