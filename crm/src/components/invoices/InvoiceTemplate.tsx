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
  const subtotal = data.subtotal ?? data.grandTotal;
  const discount = data.discount ?? 0;
  const taxRate = data.taxRate ?? 0;
  const tax = data.tax ?? 0;

  return (
    <div
      id="invoice-template"
      className="invoice-sheet bg-white w-full min-w-[780px] max-w-[210mm] mx-auto border border-gray-200/80 shadow-[0_20px_45px_-30px_rgba(17,24,39,0.45)] print:shadow-none print:border-none"
      style={{ minHeight: "297mm" }}
    >
      {/* Header bar */}
      <div className="h-2.5 w-full bg-gradient-to-r from-gray-950 via-gray-700 to-gray-900" />

      <div className="px-12 py-10 print:px-9 print:py-8">
        {/* Top section: Brand + Invoice title */}
        <div className="invoice-block flex justify-between items-start mb-10 gap-8">
          {/* Brand */}
          <div>
            <h1 className="text-3xl font-black tracking-[0.08em] text-gray-900 uppercase leading-none">
              EderCreaWebs
            </h1>
            <p className="text-[11px] text-gray-500 mt-2 uppercase tracking-[0.22em]">
              Diseño & Desarrollo Web
            </p>
            <div className="mt-4 space-y-1 text-xs text-gray-600">
              <p>{data.contact.email}</p>
              <p>{data.contact.phone}</p>
              <p>{data.contact.website}</p>
              <p className="text-gray-400">{data.contact.address}</p>
            </div>
          </div>

          {/* Invoice label */}
          <div className="text-right">
            <h2 className="text-6xl font-black tracking-[0.12em] text-gray-900 uppercase leading-none">
              INVOICE
            </h2>
            <div className="mt-4 inline-flex flex-col gap-1 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <div className="flex justify-end gap-4">
                <span className="text-gray-500 uppercase tracking-wide text-[11px]">Invoice #</span>
                <span className="font-semibold text-gray-800 min-w-[108px] text-left tabular-nums">
                  {data.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-gray-500 uppercase tracking-wide text-[11px]">Date</span>
                <span className="font-semibold text-gray-800 min-w-[108px] text-left tabular-nums">
                  {data.date}
                </span>
              </div>
              {data.dueDate && (
                <div className="flex justify-end gap-4">
                  <span className="text-gray-500 uppercase tracking-wide text-[11px]">Due Date</span>
                  <span className="font-semibold text-gray-800 min-w-[108px] text-left tabular-nums">
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
        <div className="invoice-block mb-8 rounded-md border border-gray-200 bg-gray-50/70 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 mb-1.5">
            Bill To
          </p>
          <p className="text-lg font-semibold text-gray-900 leading-tight">{data.clientName}</p>
          {data.clientEmail && (
            <p className="text-sm text-gray-600 mt-1">{data.clientEmail}</p>
          )}
          {data.clientReference && (
            <p className="text-sm text-gray-500 mt-2">
              <span className="font-medium text-gray-700">Project Reference:</span>{" "}
              {data.clientReference}
            </p>
          )}
        </div>

        {/* Items table */}
        <div className="invoice-block mb-9 border border-gray-200 rounded-md overflow-hidden">
          <InvoiceItemsTable items={data.items} currency={data.currency} />
        </div>

        {/* Grand total */}
        <div className="invoice-block flex justify-end mb-10">
          <div className="min-w-[330px]">
            <div className="flex justify-between py-2 text-sm text-gray-600 px-1">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal, data.currency)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm text-gray-600 px-1">
              <span>Descuento</span>
              <span className="tabular-nums">-{formatCurrency(discount, data.currency)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm text-gray-600 px-1">
              <span>IVA {taxRate}%</span>
              <span className="tabular-nums">{formatCurrency(tax, data.currency)}</span>
            </div>
            <div className="border-t border-gray-300 my-1.5" />
            <div className="flex justify-between items-end py-3 bg-gray-900 text-white px-5 rounded-md shadow-sm">
              <span className="text-xs font-bold uppercase tracking-[0.18em]">
                Grand Total
              </span>
              <span className="text-2xl font-black tabular-nums leading-none">
                {formatCurrency(data.grandTotal, data.currency)}{" "}
                <span className="text-[11px] font-semibold opacity-80 align-middle ml-1">
                  {data.currency}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-8" />

        {/* Payment + Notes side by side */}
        <div className="invoice-block grid grid-cols-2 gap-8 mb-8">
          <InvoicePaymentDetails payment={data.payment} />
          <InvoiceNotes
            notes={data.notes}
            projectConditions={data.projectConditions}
            observations={data.observations}
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
