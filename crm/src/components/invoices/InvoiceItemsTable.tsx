import { InvoiceItem } from "@/types/invoice";

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  currency: string;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function InvoiceItemsTable({ items, currency }: InvoiceItemsTableProps) {
  return (
    <div className="w-full">
      <table className="invoice-items-table w-full border-collapse text-sm leading-6">
        <thead>
          <tr className="bg-gray-100 text-gray-700 border-b border-gray-300">
            <th className="py-3.5 px-5 text-left font-semibold tracking-[0.14em] uppercase text-[11px] w-[20%]">
              Item
            </th>
            <th className="py-3.5 px-5 text-left font-semibold tracking-[0.14em] uppercase text-[11px] w-[40%]">
              Description
            </th>
            <th className="py-3.5 px-4 text-center font-semibold tracking-[0.14em] uppercase text-[11px] w-[9%]">
              Qty
            </th>
            <th className="py-3.5 px-5 text-right font-semibold tracking-[0.14em] uppercase text-[11px] w-[15%]">
              Price
            </th>
            <th className="py-3.5 px-5 text-right font-semibold tracking-[0.14em] uppercase text-[11px] w-[16%]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id}
              className={index % 2 === 0 ? "bg-white border-b border-gray-100" : "bg-gray-50/55 border-b border-gray-100"}
            >
              <td className="py-4 px-5 font-semibold text-gray-900 align-top">
                {item.item}
              </td>
              <td className="py-4 px-5 text-gray-700 align-top whitespace-pre-line break-words leading-relaxed">
                {item.description}
              </td>
              <td className="py-4 px-4 text-center text-gray-700 align-top tabular-nums">
                {item.qty}
              </td>
              <td className="py-4 px-5 text-right text-gray-700 align-top tabular-nums">
                {formatCurrency(item.price, currency)}
              </td>
              <td className="py-4 px-5 text-right font-semibold text-gray-900 align-top tabular-nums">
                {formatCurrency(item.total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
