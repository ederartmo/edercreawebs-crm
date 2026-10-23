"use client";

import { useState } from "react";
import type { ProjectLink, ProjectLinkInsert, LinkType } from "@/types";
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
import { Trash2, Plus, ExternalLink } from "lucide-react";

interface ProjectLinksSectionProps {
  links: ProjectLink[];
  projectId: string;
  onAddLink: (link: ProjectLinkInsert) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
  loading?: boolean;
}

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  drive: "Drive",
  quote: "Cotización",
  design: "Diseño",
  test_site: "Sitio de prueba",
  final_site: "Sitio final",
  repository: "Repositorio",
  hosting: "Hosting",
  domain: "Dominio",
  admin_panel: "Panel admin",
  other: "Otro",
};

export function ProjectLinksSection({
  links,
  projectId,
  onAddLink,
  onDeleteLink,
  loading,
}: ProjectLinksSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    label: "",
    url: "",
    type: "other" as LinkType,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAddLink() {
    if (!form.label.trim() || !form.url.trim()) return;

    setSaving(true);
    try {
      await onAddLink({
        project_id: projectId,
        label: form.label.trim(),
        url: form.url.trim(),
        type: form.type,
      });
      setForm({ label: "", url: "", type: "other" });
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLink(linkId: string) {
    if (!confirm("¿Eliminar este link?")) return;

    setDeletingId(linkId);
    try {
      await onDeleteLink(linkId);
    } finally {
      setDeletingId(null);
    }
  }

  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Links importantes</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFormOpen(!formOpen)}
          className="gap-2"
          disabled={saving || loading}
        >
          <Plus className="h-3.5 w-3.5" />
          Link nuevo
        </Button>
      </div>

      {formOpen && (
        <div className="space-y-3 p-4 rounded-lg border border-blue-200 bg-blue-50">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-label">Etiqueta</Label>
              <Input
                id="link-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Ej: Carpeta Drive"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as LinkType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{LINK_TYPE_LABELS[form.type]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(LINK_TYPE_LABELS)).map(([type, label]) => (
                    <SelectItem key={type} value={type}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
              disabled={saving}
            />
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
              onClick={handleAddLink}
              disabled={
                !form.label.trim() ||
                !isValidUrl(form.url) ||
                saving
              }
            >
              {saving ? "Guardando..." : "Guardar link"}
            </Button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-gray-500">No hay links guardados.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{link.label}</p>
                <p className="text-xs text-gray-500">{LINK_TYPE_LABELS[link.type]}</p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800"
                onClick={() => window.open(link.url, "_blank")}
                title="Abrir en nueva pestaña"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                onClick={() => handleDeleteLink(link.id)}
                disabled={deletingId === link.id}
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
