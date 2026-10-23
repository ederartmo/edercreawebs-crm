"use client";

import { useState, useEffect } from "react";
import type { Client, ClientInsert } from "@/types";
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

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ClientInsert) => Promise<void>;
  client?: Client | null;
}

const EMPTY_FORM: ClientInsert = {
  name: "",
  company: null,
  email: null,
  phone: null,
  rfc: null,
  address: null,
  website: null,
  notes: null,
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

function normalizeClientForSave(form: ClientInsert): ClientInsert {
  return {
    ...form,
    name: form.name.trim(),
    company: toNullableOnSave(form.company),
    email: toNullableOnSave(form.email),
    phone: toNullableOnSave(form.phone),
    rfc: toNullableOnSave(form.rfc),
    address: toNullableOnSave(form.address),
    website: toNullableOnSave(form.website),
    notes: toNullableOnSave(form.notes),
  };
}

export function ClientFormModal({
  open,
  onClose,
  onSave,
  client,
}: ClientFormModalProps) {
  const [form, setForm] = useState<ClientInsert>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        rfc: client.rfc,
        address: client.address,
        website: client.website,
        notes: client.notes,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [client, open]);

  function set(key: keyof ClientInsert, value: string | null) {
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
      await onSave(normalizeClientForSave(form));
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el cliente."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {client ? "Editar cliente" : "Nuevo cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="client-name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="client-name"
              value={toStr(form.name)}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ej: Juan García"
              autoFocus
            />
          </div>

          {/* Empresa y teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="client-company">Empresa</Label>
              <Input
                id="client-company"
                value={toStr(form.company)}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Empresa S.A."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-phone">Teléfono</Label>
              <Input
                id="client-phone"
                value={toStr(form.phone)}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+52 55 1234 5678"
              />
            </div>
          </div>

          {/* Email y RFC */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="client-email">Correo electrónico</Label>
              <Input
                id="client-email"
                type="email"
                value={toStr(form.email)}
                onChange={(e) => set("email", e.target.value)}
                placeholder="cliente@correo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-rfc">RFC</Label>
              <Input
                id="client-rfc"
                value={toStr(form.rfc)}
                onChange={(e) => set("rfc", e.target.value)}
                placeholder="RFC123456789"
              />
            </div>
          </div>

          {/* Sitio web */}
          <div className="space-y-1.5">
            <Label htmlFor="client-website">Sitio web</Label>
            <Input
              id="client-website"
              type="url"
              value={toStr(form.website)}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://ejemplo.com"
            />
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label htmlFor="client-address">Dirección</Label>
            <Input
              id="client-address"
              value={toStr(form.address)}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Calle, número, ciudad..."
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="client-notes">Notas</Label>
            <Textarea
              id="client-notes"
              value={toStr(form.notes)}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas sobre el cliente..."
              rows={3}
              className="resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : client ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
