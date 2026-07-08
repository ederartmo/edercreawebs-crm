"use client";

import { useParams } from "next/navigation";
import { QuoteBuilder } from "@/components/invoices/QuoteBuilder";

export default function QuoteDetailPage() {
  const params = useParams();
  const quoteId = params.id as string;
  return <QuoteBuilder quoteId={quoteId} />;
}
