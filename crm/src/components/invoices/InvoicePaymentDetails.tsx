import { InvoicePaymentDetails as PaymentDetailsType } from "@/types/invoice";

interface InvoicePaymentDetailsProps {
  payment: PaymentDetailsType;
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
            {payment.firstName && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">First Name:</span>
                <span className="text-gray-800">{payment.firstName}</span>
              </div>
            )}
            {payment.lastName && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">Last Name:</span>
                <span className="text-gray-800">{payment.lastName}</span>
              </div>
            )}
            {payment.secondLastName && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">Second Last Name:</span>
                <span className="text-gray-800">{payment.secondLastName}</span>
              </div>
            )}
            {payment.accountHolder && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">Account Holder:</span>
                <span className="text-gray-800">{payment.accountHolder}</span>
              </div>
            )}
            {payment.country && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">Country:</span>
                <span className="text-gray-800">{payment.country}</span>
              </div>
            )}
            {payment.state && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">State:</span>
                <span className="text-gray-800">{payment.state}</span>
              </div>
            )}
            {payment.city && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">City:</span>
                <span className="text-gray-800">{payment.city}</span>
              </div>
            )}
            {payment.location && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32 shrink-0">Location:</span>
                <span className="text-gray-800">{payment.location}</span>
              </div>
            )}
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
                {payment.clabe || "N/A"}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32 shrink-0">SWIFT / BIC:</span>
              <span className="text-gray-800 font-mono tracking-wide">
                {payment.swift || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
