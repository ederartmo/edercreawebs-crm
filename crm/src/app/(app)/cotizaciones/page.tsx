"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Quote } from "@/types";
import {
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
} from "@/lib/crm-helpers";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export default function QuotesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuotes() {
      if (!supabase) {
        setError("Supabase no está configurado.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setQuotes((data as Quote[]) ?? []);
      }

      setLoading(false);
    }

    fetchQuotes();
  }, [supabase]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Cotizaciones</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading
              ? "Cargando..."
              : `${quotes.length} cotización${quotes.length !== 1 ? "es" : ""} guardada${quotes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/cotizaciones/nueva"
          className={buttonVariants({ size: "sm", className: "gap-2" })}
        >
          <Plus className="h-4 w-4" />
          Nueva cotización
        </Link>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          Error al cargar cotizaciones: {error}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          {quotes.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <p>Sin cotizaciones aún.</p>
              <p className="mt-1">
                Haz clic en <span className="font-medium text-gray-600">Nueva cotización</span> para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Número</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {quote.quote_number}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {quote.client_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {toDate(quote.issue_date)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${QUOTE_STATUS_COLORS[quote.status]} border-0`}>
                          {QUOTE_STATUS_LABELS[quote.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {toCurrency(quote.grand_total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/cotizaciones/${quote.id}`}
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                              className: "gap-1",
                            })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Link>
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
    </div>
  );
}
