"use client";

import { useEffect, useState, useCallback } from "react";
import type { Lead, LeadInsert, CrmStatus } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  LEAD_SOURCE_LABELS,
} from "@/lib/crm-helpers";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { LeadStatusSelect } from "@/components/leads/LeadStatusSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Phone, Mail } from "lucide-react";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchLeads = useCallback(async () => {
    if (!supabase) {
      setFetchError("Supabase no está configurado.");
      setLoadingLeads(false);
      return;
    }
    setLoadingLeads(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setFetchError(error.message);
    } else {
      setLeads((data as Lead[]) ?? []);
    }
    setLoadingLeads(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleCreate(data: LeadInsert) {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error } = await supabase.from("leads").insert([data]);
    if (error) throw new Error(error.message);
    await fetchLeads();
  }

  async function handleEdit(data: LeadInsert) {
    if (!supabase || !editingLead) throw new Error("Supabase no está configurado.");
    const { error } = await supabase
      .from("leads")
      .update(data)
      .eq("id", editingLead.id);
    if (error) throw new Error(error.message);
    await fetchLeads();
  }

  async function handleStatusChange(id: string, status: CrmStatus) {
    if (!supabase) return;
    setUpdatingStatusId(id);
    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status } : l))
      );
    }
    setUpdatingStatusId(null);
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    if (!confirm("¿Eliminar este lead? Esta acción no se puede deshacer."))
      return;
    setDeletingId(id);
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Leads</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {loadingLeads
              ? "Cargando..."
              : `${leads.length} lead${leads.length !== 1 ? "s" : ""} registrado${leads.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditingLead(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo lead
        </Button>
      </div>

      {fetchError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          Error al cargar leads: {fetchError}
        </div>
      )}

      {loadingLeads && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loadingLeads && !fetchError && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          {leads.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <p>Sin leads aún.</p>
              <p className="mt-1">
                Haz clic en{" "}
                <span className="font-medium text-gray-600">Nuevo lead</span>{" "}
                para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Contacto</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Fuente</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Qué necesita</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        {lead.company && (
                          <p className="text-xs text-gray-500 mt-0.5">{lead.company}</p>
                        )}
                        {lead.business_type && (
                          <p className="text-xs text-gray-400">{lead.business_type}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              {lead.phone}
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 truncate max-w-[160px]"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              {lead.email}
                            </a>
                          )}
                          {!lead.phone && !lead.email && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-normal text-gray-600">
                          {LEAD_SOURCE_LABELS[lead.source]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusSelect
                          value={lead.status}
                          onChange={(status) => handleStatusChange(lead.id, status)}
                          disabled={updatingStatusId === lead.id}
                        />
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-gray-600 truncate">
                          {lead.need_summary ?? (
                            <span className="text-gray-400">—</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-800"
                            title="Editar lead"
                            onClick={() => {
                              setEditingLead(lead);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            title="Eliminar lead"
                            onClick={() => handleDelete(lead.id)}
                            disabled={deletingId === lead.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <LeadFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingLead(null);
        }}
        onSave={editingLead ? handleEdit : handleCreate}
        lead={editingLead}
      />
    </div>
  );
}
