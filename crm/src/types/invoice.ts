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
  accountHolder?: string;
  location?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  currency: string;
  contact: InvoiceContactInfo;
  clientName: string;
  clientEmail?: string;
  clientReference?: string;
  items: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
  payment: InvoicePaymentDetails;
  notes: string;
  projectConditions?: string;
  observations?: string;
  serviceDescription?: string;
}
