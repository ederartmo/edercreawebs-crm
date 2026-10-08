"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepareQuoteAction } from "./quote/actions";

export function PrepareQuoteButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function prepare() {
    setError(null);
    startTransition(async () => {
      const result = await prepareQuoteAction(leadId);
      if (!result.quoteId) {
        setError(result.error ?? "No se pudo abrir el borrador.");
        return;
      }
      router.push(`/leads/${leadId}/quote?quoteId=${encodeURIComponent(result.quoteId)}`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={prepare}
        disabled={pending}
        className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Abriendo borrador…" : "Preparar cotización"}
      </button>
      {error ? <p role="alert" className="max-w-sm text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
