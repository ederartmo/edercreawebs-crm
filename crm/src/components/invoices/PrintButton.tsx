"use client";

import { Button } from "@/components/ui/button";

function openPrintDialog() {
  window.print();
}

export function PrintButton() {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={openPrintDialog}>
          Exportar PDF
        </Button>
        <Button type="button" variant="outline" onClick={openPrintDialog}>
          Imprimir
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Para exportar, elige "Guardar como PDF" en el dialogo de impresion.
      </p>
    </div>
  );
}
