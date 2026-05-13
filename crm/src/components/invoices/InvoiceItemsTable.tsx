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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-900 text-white">
            <th className="py-3 px-4 text-left font-semibold tracking-wide uppercase text-xs">
              Item
            </th>
            <th className="py-3 px-4 text-left font-semibold tracking-wide uppercase text-xs">
              Description
            </th>
            <th className="py-3 px-4 text-center font-semibold tracking-wide uppercase text-xs w-16">
              Qty
            </th>
            <th className="py-3 px-4 text-right font-semibold tracking-wide uppercase text-xs w-28">
              Price
            </th>
            <th className="py-3 px-4 text-right font-semibold tracking-wide uppercase text-xs w-28">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="py-3 px-4 font-medium text-gray-800 align-top">
                {item.item}
              </td>
              <td className="py-3 px-4 text-gray-600 align-top">
                {item.description}
              </td>
              <td className="py-3 px-4 text-center text-gray-700 align-top">
                {item.qty}
              </td>
              <td className="py-3 px-4 text-right text-gray-700 align-top">
                {formatCurrency(item.price, currency)}
              </td>
              <td className="py-3 px-4 text-right font-medium text-gray-800 align-top">
                {formatCurrency(item.total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
