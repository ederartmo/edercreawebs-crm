"use client";

import { useState } from "react";
import type { ProjectNote, ProjectNoteInsert } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";

interface ProjectNotesSectionProps {
  notes: ProjectNote[];
  onAddNote: (note: ProjectNoteInsert) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  loading?: boolean;
}

export function ProjectNotesSection({
  notes,
  onAddNote,
  onDeleteNote,
  loading,
}: ProjectNotesSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAddNote() {
    if (!noteText.trim()) return;

    setSaving(true);
    try {
      await onAddNote({ project_id: notes[0]?.project_id || "", note: noteText.trim() });
      setNoteText("");
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("¿Eliminar esta nota?")) return;

    setDeletingId(noteId);
    try {
      await onDeleteNote(noteId);
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Notas internas</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFormOpen(!formOpen)}
          className="gap-2"
          disabled={saving || loading}
        >
          <Plus className="h-3.5 w-3.5" />
          Nota nueva
        </Button>
      </div>

      {formOpen && (
        <div className="space-y-3 p-4 rounded-lg border border-blue-200 bg-blue-50">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Escribe una nota interna..."
            rows={3}
            className="resize-none"
            disabled={saving}
          />
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
              onClick={handleAddNote}
              disabled={!noteText.trim() || saving}
            >
              {saving ? "Guardando..." : "Guardar nota"}
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">No hay notas todavía.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex gap-3 p-3 rounded-lg border border-gray-200 bg-white"
            >
              <div className="flex-1">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.note}</p>
                <p className="text-xs text-gray-500 mt-2">{formatDate(note.created_at)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                onClick={() => handleDeleteNote(note.id)}
                disabled={deletingId === note.id}
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
