import { InvoicePaymentDetails as PaymentDetailsType } from "@/types/invoice";

interface InvoicePaymentDetailsProps {
  payment: PaymentDetailsType;
}

export function InvoicePaymentDetails({ payment }: InvoicePaymentDetailsProps) {
  return (
    <div className="border border-gray-200 rounded-sm p-5 bg-gray-50">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
        Payment Details
      </h3>
      <div className="space-y-1.5 text-sm">
        <div className="flex gap-2">
          <span className="text-gray-500 w-36 shrink-0">Payable to:</span>
          <span className="font-semibold text-gray-800">{payment.payableTo}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-36 shrink-0">Account Holder:</span>
          <span className="text-gray-800">{payment.accountHolder}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-36 shrink-0">Bank:</span>
          <span className="text-gray-800">{payment.bank}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-36 shrink-0">CLABE:</span>
          <span className="text-gray-800 font-mono">{payment.clabe}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-36 shrink-0">SWIFT / BIC:</span>
          <span className="text-gray-800 font-mono">{payment.swift}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-36 shrink-0">Payment Method:</span>
          <span className="text-gray-800">{payment.paymentMethod}</span>
        </div>
      </div>
    </div>
  );
}
