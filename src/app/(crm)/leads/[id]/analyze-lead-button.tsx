"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AnalyzeLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleClick() {
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/analyze-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lead_id: leadId }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error || "No pude analizar el expediente.");
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No pude analizar el expediente.",
      );
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  return (
    <div className="mt-3 sm:mt-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Analizando expediente…" : "Analizar expediente completo"}
      </button>
      {errorMessage ? (
        <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}
