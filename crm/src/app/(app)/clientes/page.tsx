"use client";

import { useEffect, useState, useCallback } from "react";
import type { Client, ClientInsert } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Mail, Phone, Globe } from "lucide-react";

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    if (!supabase) {
      setFetchError("Supabase no está configurado.");
      setLoadingClients(false);
      return;
    }
    setLoadingClients(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setFetchError(error.message);
    } else {
      setClients((data as Client[]) ?? []);
    }
    setLoadingClients(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  async function handleCreate(data: ClientInsert) {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error } = await supabase.from("clients").insert([data]);
    if (error) throw new Error(error.message);
    await fetchClients();
  }

  async function handleEdit(data: ClientInsert) {
    if (!supabase || !editingClient) throw new Error("Supabase no está configurado.");
    const { error } = await supabase
      .from("clients")
      .update(data)
      .eq("id", editingClient.id);
    if (error) throw new Error(error.message);
    await fetchClients();
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    if (!confirm("¿Eliminar este cliente? Esta acción no se puede deshacer."))
      return;
    setDeletingId(id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (!error) {
      setClients((prev) => prev.filter((c) => c.id !== id));
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {loadingClients
              ? "Cargando..."
              : `${clients.length} cliente${clients.length !== 1 ? "s" : ""} registrado${clients.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditingClient(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {fetchError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          Error al cargar clientes: {fetchError}
        </div>
      )}

      {loadingClients && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loadingClients && !fetchError && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          {clients.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <p>Sin clientes aún.</p>
              <p className="mt-1">
                Haz clic en{" "}
                <span className="font-medium text-gray-600">Nuevo cliente</span>{" "}
                para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Contacto</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">RFC</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{client.name}</div>
                        {client.website && (
                          <a
                            href={client.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Globe className="h-3 w-3" />
                            {client.website}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {client.company || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {client.email && (
                            <a
                              href={`mailto:${client.email}`}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </a>
                          )}
                          {client.phone && (
                            <a
                              href={`tel:${client.phone}`}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                        {client.rfc || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingClient(client);
                              setModalOpen(true);
                            }}
                            disabled={deletingId === client.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(client.id)}
                            disabled={deletingId !== null}
                          >
                            {deletingId === client.id ? (
                              <span className="text-xs">Eliminando...</span>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
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

      <ClientFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingClient(null);
        }}
        onSave={editingClient ? handleEdit : handleCreate}
        client={editingClient}
      />
    </div>
  );
}
