interface InvoiceNotesProps {
  notes: string;
  projectConditions?: string;
  observations?: string;
  serviceDescription?: string;
}

export function InvoiceNotes({
  notes,
  projectConditions,
  observations,
  serviceDescription,
}: InvoiceNotesProps) {
  return (
    <div className="space-y-4">
      {serviceDescription && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 mb-2.5">
            Service Overview
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {serviceDescription}
          </p>
        </div>
      )}

      <div className="rounded-md border border-gray-200 bg-white p-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 mb-2.5">
          Payment Notes
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {notes}
        </p>
      </div>

      {projectConditions && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 mb-2.5">
            Project Conditions
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {projectConditions}
          </p>
        </div>
      )}

      {observations && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 mb-2.5">
            Observations
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {observations}
          </p>
        </div>
      )}
    </div>
  );
}
