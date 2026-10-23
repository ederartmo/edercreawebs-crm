"use client";

import { useState } from "react";
import type { Lead } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConvertLeadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  lead: Lead | null;
}

export function ConvertLeadModal({
  open,
  onClose,
  onConfirm,
  lead,
}: ConvertLeadModalProps) {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setConverting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al convertir el lead."
      );
    } finally {
      setConverting(false);
    }
  }

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Convertir lead a cliente
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Se creará un nuevo cliente con los datos del lead.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-50 rounded-md p-3 space-y-2 text-sm">
          <div>
            <p className="text-gray-600 font-medium">Nombre</p>
            <p className="text-gray-900">{lead.name}</p>
          </div>
          {lead.email && (
            <div>
              <p className="text-gray-600 font-medium">Correo</p>
              <p className="text-gray-900">{lead.email}</p>
            </div>
          )}
          {lead.phone && (
            <div>
              <p className="text-gray-600 font-medium">Teléfono</p>
              <p className="text-gray-900">{lead.phone}</p>
            </div>
          )}
          {lead.company && (
            <div>
              <p className="text-gray-600 font-medium">Empresa</p>
              <p className="text-gray-900">{lead.company}</p>
            </div>
          )}
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
            disabled={converting}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={converting}>
            {converting ? "Convirtiendo..." : "Convertir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
