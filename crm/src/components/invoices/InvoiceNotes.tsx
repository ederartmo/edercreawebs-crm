interface InvoiceNotesProps {
  notes: string;
  serviceDescription?: string;
}

export function InvoiceNotes({ notes, serviceDescription }: InvoiceNotesProps) {
  return (
    <div className="space-y-4">
      {serviceDescription && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            Service Description
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {serviceDescription}
          </p>
        </div>
      )}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
          Notes
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {notes}
        </p>
      </div>
    </div>
  );
}
