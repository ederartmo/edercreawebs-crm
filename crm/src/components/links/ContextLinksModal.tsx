"use client";

import { useMemo, useState } from "react";
import type { ContextLinkType } from "@/types";
import {
  ALL_CONTEXT_LINK_TYPES,
  CONTEXT_LINK_TYPE_LABELS,
} from "@/lib/crm-helpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Plus, Trash2 } from "lucide-react";

interface ContextLinkItem {
  id: string;
  label: string;
  url: string;
  type: ContextLinkType;
}

interface CreateContextLinkInput {
  label: string;
  url: string;
  type: ContextLinkType;
}

interface ContextLinksModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  links: ContextLinkItem[];
  loading: boolean;
  onCreateLink: (input: CreateContextLinkInput) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ContextLinksModal({
  open,
  onClose,
  title,
  description,
  links,
  loading,
  onCreateLink,
  onDeleteLink,
}: ContextLinksModalProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ContextLinkType>("other");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => {
    return label.trim().length > 0 && isValidUrl(url.trim()) && !saving;
  }, [label, url, saving]);

  async function handleCreateLink() {
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      await onCreateLink({
        label: label.trim(),
        url: url.trim(),
        type,
      });
      setLabel("");
      setUrl("");
      setType("other");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el link.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLink(linkId: string) {
    if (!confirm("¿Eliminar este link?")) return;

    setDeletingId(linkId);
    setError(null);
    try {
      await onDeleteLink(linkId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el link.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="context-link-label">Etiqueta</Label>
              <Input
                id="context-link-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Ej: Diagnóstico ChatGPT"
                disabled={saving || loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as ContextLinkType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{CONTEXT_LINK_TYPE_LABELS[type]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ALL_CONTEXT_LINK_TYPES.map((contextType) => (
                    <SelectItem key={contextType} value={contextType}>
                      {CONTEXT_LINK_TYPE_LABELS[contextType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context-link-url">URL</Label>
            <Input
              id="context-link-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://..."
              disabled={saving || loading}
            />
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-2"
              onClick={handleCreateLink}
              disabled={!canSave || loading}
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Guardando..." : "Guardar link"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          ) : links.length === 0 ? (
            <p className="text-sm text-gray-500">No hay links guardados.</p>
          ) : (
            links.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {link.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {CONTEXT_LINK_TYPE_LABELS[link.type]}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800"
                  title="Abrir en nueva pestaña"
                  onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                  onClick={() => handleDeleteLink(link.id)}
                  disabled={deletingId === link.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
