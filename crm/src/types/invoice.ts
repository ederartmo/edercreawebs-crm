export interface InvoiceItem {
  id: string;
  item: string;
  description: string;
  qty: number;
  price: number;
  total: number;
}

export interface InvoiceContactInfo {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export interface InvoicePaymentDetails {
  payableTo: string;
  bank: string;
  clabe: string;
  swift: string;
  paymentMethod: string;
  accountHolder: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  currency: string;
  contact: InvoiceContactInfo;
  clientName: string;
  clientEmail?: string;
  items: InvoiceItem[];
  grandTotal: number;
  payment: InvoicePaymentDetails;
  notes: string;
  serviceDescription: string;
}
