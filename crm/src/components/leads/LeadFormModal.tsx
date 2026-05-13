"use client";

import { useState, useEffect } from "react";
import type { Lead, LeadInsert, CrmStatus, LeadSource } from "@/types";
import {
  LEAD_STATUSES,
  LEAD_SOURCE_LABELS,
  ALL_LEAD_SOURCES,
  CRM_STATUS_LABELS,
} from "@/lib/crm-helpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: LeadInsert) => Promise<void>;
  lead?: Lead | null;
}

const EMPTY_FORM: LeadInsert = {
  name: "",
  company: null,
  phone: null,
  email: null,
  source: "otro",
  business_type: null,
  need_summary: null,
  status: "lead_nuevo",
  notes: null,
  contacted_at: null,
};

function toStr(v: string | null): string {
  return v ?? "";
}

function toNullableOnSave(v: string | null): string | null {
  if (v === null) {
    return null;
  }

  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeLeadForSave(form: LeadInsert): LeadInsert {
  return {
    ...form,
    name: form.name.trim(),
    company: toNullableOnSave(form.company),
    phone: toNullableOnSave(form.phone),
    email: toNullableOnSave(form.email),
    business_type: toNullableOnSave(form.business_type),
    need_summary: toNullableOnSave(form.need_summary),
    notes: toNullableOnSave(form.notes),
    contacted_at: toNullableOnSave(form.contacted_at),
  };
}

export function LeadFormModal({
  open,
  onClose,
  onSave,
  lead,
}: LeadFormModalProps) {
  const [form, setForm] = useState<LeadInsert>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Llenar formulario cuando se abre con un lead existente
  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        business_type: lead.business_type,
        need_summary: lead.need_summary,
        status: lead.status,
        notes: lead.notes,
        contacted_at: lead.contacted_at,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [lead, open]);

  function set(key: keyof LeadInsert, value: string | null) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(normalizeLeadForSave(form));
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el lead."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden !flex !flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {lead ? "Editar lead" : "Nuevo lead"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="lead-name"
                value={toStr(form.name)}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ej: Juan García"
                autoFocus
              />
            </div>

            {/* Empresa y teléfono */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-company">Empresa</Label>
                <Input
                  id="lead-company"
                  value={toStr(form.company)}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Empresa S.A."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">Teléfono</Label>
                <Input
                  id="lead-phone"
                  value={toStr(form.phone)}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+52 55 1234 5678"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Correo electrónico</Label>
              <Input
                id="lead-email"
                type="email"
                value={toStr(form.email)}
                onChange={(e) => set("email", e.target.value)}
                placeholder="lead@correo.com"
              />
            </div>

            {/* Fuente y Estado */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fuente</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => set("source", v as LeadSource)}
                >
                  <SelectTrigger>
                    <SelectValue>{LEAD_SOURCE_LABELS[form.source]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {LEAD_SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v as CrmStatus)}
                >
                  <SelectTrigger>
                    <SelectValue>{CRM_STATUS_LABELS[form.status]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CRM_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tipo de negocio */}
            <div className="space-y-1.5">
              <Label htmlFor="lead-business">Tipo de negocio</Label>
              <Input
                id="lead-business"
                value={toStr(form.business_type)}
                onChange={(e) => set("business_type", e.target.value)}
                placeholder="Ej: Restaurante, Tienda en línea..."
              />
            </div>

            {/* Qué necesita */}
            <div className="space-y-1.5">
              <Label htmlFor="lead-need">Qué necesita</Label>
              <Textarea
                id="lead-need"
                value={toStr(form.need_summary)}
                onChange={(e) => set("need_summary", e.target.value)}
                placeholder="Ej: Sitio web con formulario de contacto"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Notas internas</Label>
              <Textarea
                id="lead-notes"
                value={toStr(form.notes)}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Notas privadas sobre el lead..."
                rows={3}
                className="resize-none"
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
              {saving ? "Guardando..." : lead ? "Guardar cambios" : "Crear lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
