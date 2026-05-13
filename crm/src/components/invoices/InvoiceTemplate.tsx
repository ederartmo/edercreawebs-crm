import { InvoiceData } from "@/types/invoice";
import { InvoiceItemsTable } from "./InvoiceItemsTable";
import { InvoicePaymentDetails } from "./InvoicePaymentDetails";
import { InvoiceNotes } from "./InvoiceNotes";

interface InvoiceTemplateProps {
  data: InvoiceData;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function InvoiceTemplate({ data }: InvoiceTemplateProps) {
  return (
    <div
      id="invoice-template"
      className="bg-white w-full max-w-[210mm] mx-auto shadow-lg print:shadow-none"
      style={{ minHeight: "297mm" }}
    >
      {/* Header bar */}
      <div className="bg-gray-900 h-2 w-full" />

      <div className="px-12 py-10 print:px-10 print:py-8">
        {/* Top section: Brand + Invoice title */}
        <div className="flex justify-between items-start mb-10">
          {/* Brand */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
              EderCreaWebs
            </h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">
              Diseño & Desarrollo Web
            </p>
            <div className="mt-3 space-y-0.5 text-xs text-gray-600">
              <p>{data.contact.email}</p>
              <p>{data.contact.phone}</p>
              <p>{data.contact.website}</p>
              <p className="text-gray-400">{data.contact.address}</p>
            </div>
          </div>

          {/* Invoice label */}
          <div className="text-right">
            <h2 className="text-5xl font-black tracking-tight text-gray-900 uppercase">
              INVOICE
            </h2>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-end gap-3">
                <span className="text-gray-500">Invoice #</span>
                <span className="font-semibold text-gray-800 min-w-[80px] text-left">
                  {data.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-end gap-3">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold text-gray-800 min-w-[80px] text-left">
                  {data.date}
                </span>
              </div>
              {data.dueDate && (
                <div className="flex justify-end gap-3">
                  <span className="text-gray-500">Due Date</span>
                  <span className="font-semibold text-gray-800 min-w-[80px] text-left">
                    {data.dueDate}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-gray-900 mb-6" />

        {/* Bill to */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            Bill To
          </p>
          <p className="text-base font-semibold text-gray-900">{data.clientName}</p>
          {data.clientEmail && (
            <p className="text-sm text-gray-600">{data.clientEmail}</p>
          )}
        </div>

        {/* Items table */}
        <div className="mb-8 border border-gray-200 rounded-sm overflow-hidden">
          <InvoiceItemsTable items={data.items} currency={data.currency} />
        </div>

        {/* Grand total */}
        <div className="flex justify-end mb-10">
          <div className="min-w-[260px]">
            <div className="flex justify-between py-2 text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(data.grandTotal, data.currency)}</span>
            </div>
            <div className="border-t border-gray-300 my-1" />
            <div className="flex justify-between py-2 bg-gray-900 text-white px-4 rounded-sm">
              <span className="text-sm font-bold uppercase tracking-wide">
                Grand Total
              </span>
              <span className="text-lg font-black">
                {formatCurrency(data.grandTotal, data.currency)}{" "}
                <span className="text-xs font-medium opacity-80">
                  {data.currency}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-8" />

        {/* Payment + Notes side by side */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <InvoicePaymentDetails payment={data.payment} />
          <InvoiceNotes
            notes={data.notes}
            serviceDescription={data.serviceDescription}
          />
        </div>

        {/* Footer bar */}
        <div className="border-t-2 border-gray-900 mt-10 pt-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest">
            {data.contact.website} · {data.contact.email} · {data.contact.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
