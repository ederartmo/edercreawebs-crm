import { InvoicePaymentDetails as PaymentDetailsType } from "@/types/invoice";

interface InvoicePaymentDetailsProps {
  payment: PaymentDetailsType;
}

function maskAccountValue(value: string): string {
  const compactValue = value.replace(/\s+/g, "");
  if (!compactValue) {
    return "N/A";
  }
  if (compactValue.includes("*") || compactValue.toUpperCase().includes("X")) {
    return value;
  }
  if (compactValue.length <= 4) {
    return "••••";
  }

  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export function InvoicePaymentDetails({ payment }: InvoicePaymentDetailsProps) {
  return (
    <div className="border border-gray-200 rounded-md p-5 bg-gray-50/75">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 mb-4">
        Payment Details
      </h3>
      <div className="space-y-4 text-sm">
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-2">
            Payable To
          </p>
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">Business:</span>
              <span className="font-semibold text-gray-900">{payment.payableTo}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">Account Holder:</span>
              <span className="text-gray-800">{payment.accountHolder}</span>
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-2">
            Transfer Details
          </p>
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">Method:</span>
              <span className="text-gray-800">{payment.paymentMethod}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">Bank:</span>
              <span className="text-gray-800">{payment.bank}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">CLABE:</span>
              <span className="text-gray-800 font-mono tracking-wide">
                {maskAccountValue(payment.clabe)}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">SWIFT / BIC:</span>
              <span className="text-gray-800 font-mono tracking-wide">
                {maskAccountValue(payment.swift)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
