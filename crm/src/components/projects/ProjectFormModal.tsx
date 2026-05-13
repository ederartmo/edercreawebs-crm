"use client";

import { useEffect, useState } from "react";
import type {
  Client,
  CrmStatus,
  DomainStatus,
  ProjectInsert,
  ProjectType,
  ProjectWithClient,
} from "@/types";
import {
  ALL_CRM_STATUSES,
  ALL_DOMAIN_STATUSES,
  ALL_PROJECT_TYPES,
  CRM_STATUS_LABELS,
  DOMAIN_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/crm-helpers";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProjectInsert) => Promise<void>;
  clients: Client[];
  project?: ProjectWithClient | null;
}

interface ProjectFormState {
  client_id: string;
  title: string;
  project_type: ProjectType[];
  status: CrmStatus;
  total_price: string;
  deposit_amount: string;
  deposit_paid: "true" | "false";
  final_payment_amount: string;
  final_payment_paid: "true" | "false";
  domain_status: DomainStatus;
  start_date: string;
  due_date: string;
  next_action: string;
}

const EMPTY_FORM: ProjectFormState = {
  client_id: "",
  title: "",
  project_type: [],

  status: "lead_nuevo",
  total_price: "0",
  deposit_amount: "0",
  deposit_paid: "false",
  final_payment_amount: "0",
  final_payment_paid: "false",
  domain_status: "pendiente",
  start_date: "",
  due_date: "",
  next_action: "",
};

function toMoney(v: string): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatClientLabel(client: Pick<Client, "name" | "company">): string {
  if (client.company && client.name) {
    return `${client.company} — ${client.name}`;
  }
  return client.company || client.name;
}

function normalizeProjectForSave(form: ProjectFormState): ProjectInsert {
  return {
    client_id: form.client_id,
    lead_id: null,
    title: form.title.trim(),
    project_type: form.project_type as ProjectType[],

    status: form.status,
    total_price: toMoney(form.total_price),
    deposit_amount: toMoney(form.deposit_amount),
    deposit_paid: form.deposit_paid === "true",
    final_payment_amount: toMoney(form.final_payment_amount),
    final_payment_paid: form.final_payment_paid === "true",
    domain_status: form.domain_status,
    drive_url: null,
    quote_url: null,
    test_url: null,
    final_url: null,
    start_date: form.start_date || null,
    due_date: form.due_date || null,
    next_action: form.next_action.trim(),
    notes: null,
  };
}

export function ProjectFormModal({
  open,
  onClose,
  onSave,
  clients,
  project,
}: ProjectFormModalProps) {
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clients.find((client) => client.id === form.client_id);
  const projectClientFallback = project?.clients
    ? formatClientLabel(project.clients)
    : null;
  const selectedClientLabel =
    (selectedClient ? formatClientLabel(selectedClient) : null) ||
    projectClientFallback ||
    "Selecciona un cliente";

  useEffect(() => {
    if (project) {
      setForm({
        client_id: project.client_id,
        title: project.title,
        project_type: Array.isArray(project.project_type)
          ? project.project_type
          : [project.project_type as ProjectType],
        status: project.status,
        total_price: String(project.total_price),
        deposit_amount: String(project.deposit_amount),
        deposit_paid: project.deposit_paid ? "true" : "false",
        final_payment_amount: String(project.final_payment_amount),
        final_payment_paid: project.final_payment_paid ? "true" : "false",
        domain_status: project.domain_status,
        start_date: project.start_date ?? "",
        due_date: project.due_date ?? "",
        next_action: project.next_action,
      });
    } else {
      const defaultClientId = clients[0]?.id ?? "";
      setForm({ ...EMPTY_FORM, client_id: defaultClientId });
    }
    setError(null);
  }, [project, open, clients]);

  function set<K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.client_id) {
      setError("Debes seleccionar un cliente.");
      return;
    }
    if (!form.title.trim()) {
      setError("El nombre del proyecto es obligatorio.");
      return;
    }
    if (form.project_type.length === 0) {
      setError("Selecciona al menos un tipo de proyecto.");
      return;
    }
    if (!form.next_action.trim()) {
      setError("La próxima acción es obligatoria.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(normalizeProjectForSave(form));
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el proyecto."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {project ? "Editar proyecto" : "Nuevo proyecto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto pt-1 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={form.client_id}
                onValueChange={(v) => set("client_id", v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span className="truncate">{selectedClientLabel}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {formatClientLabel(client)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-title">
                Nombre del proyecto <span className="text-red-500">*</span>
              </Label>
              <Input
                id="project-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ej: Sitio corporativo"
              />
            </div>
          </div>

          <div className="space-y-1.5 col-span-3">
            <Label>
              Herramientas / Tipo de proyecto{" "}
              <span className="text-red-500">*</span>
              {form.project_type.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  ({form.project_type.length} seleccionado{form.project_type.length !== 1 ? "s" : ""})
                </span>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {ALL_PROJECT_TYPES.map((type) => {
                const isSelected = form.project_type.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? form.project_type.filter((t) => t !== type)
                        : [...form.project_type, type];
                      set("project_type", next);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600"
                    )}
                  >
                    {PROJECT_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as CrmStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{CRM_STATUS_LABELS[form.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ALL_CRM_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CRM_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado dominio</Label>
              <Select
                value={form.domain_status}
                onValueChange={(v) => set("domain_status", v as DomainStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{DOMAIN_STATUS_LABELS[form.domain_status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ALL_DOMAIN_STATUSES.map((domainStatus) => (
                    <SelectItem key={domainStatus} value={domainStatus}>
                      {DOMAIN_STATUS_LABELS[domainStatus]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="total-price">Precio total</Label>
              <Input
                id="total-price"
                type="number"
                step="0.01"
                min="0"
                value={form.total_price}
                onChange={(e) => set("total_price", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deposit-amount">Anticipo</Label>
              <Input
                id="deposit-amount"
                type="number"
                step="0.01"
                min="0"
                value={form.deposit_amount}
                onChange={(e) => set("deposit_amount", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="final-amount">Segundo pago</Label>
              <Input
                id="final-amount"
                type="number"
                step="0.01"
                min="0"
                value={form.final_payment_amount}
                onChange={(e) => set("final_payment_amount", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Anticipo pagado</Label>
              <Select
                value={form.deposit_paid}
                onValueChange={(v) => set("deposit_paid", v as "true" | "false")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{form.deposit_paid === "true" ? "Sí" : "No"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Sí</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Segundo pago liquidado</Label>
              <Select
                value={form.final_payment_paid}
                onValueChange={(v) =>
                  set("final_payment_paid", v as "true" | "false")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{form.final_payment_paid === "true" ? "Sí" : "No"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Sí</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Fecha inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-date">Fecha estimada</Label>
              <Input
                id="due-date"
                type="date"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="next-action">
              Próxima acción <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="next-action"
              rows={2}
              className="resize-none"
              value={form.next_action}
              onChange={(e) => set("next_action", e.target.value)}
              placeholder="Ej: Confirmar anticipo para iniciar diseño"
            />
          </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="pt-3 mt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Guardando..."
                : project
                ? "Guardar cambios"
                : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
