"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { InvoiceTemplate } from "@/components/invoices/InvoiceTemplate";
import { PrintButton } from "@/components/invoices/PrintButton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  ALL_QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
} from "@/lib/crm-helpers";
import type { Client, Quote, QuoteItem, QuoteStatus } from "@/types";
import { InvoiceData, InvoiceItem } from "@/types/invoice";

interface QuoteFormItem {
  id: string;
  item: string;
  description: string;
  qty: string;
  price: string;
}

interface QuoteFormState {
  invoiceNumber: string;
  date: string;
  status: QuoteStatus;
  clientId: string | null;
  clientName: string;
  clientReference: string;
  discountAmount: string;
  taxRate: string;
  notes: string;
  projectConditions: string;
  observations: string;
  payment: {
    payableTo: string;
    paymentMethod: string;
    bank: string;
    clabe: string;
    swift: string;
    firstName: string;
    lastName: string;
    secondLastName: string;
    country: string;
    state: string;
    city: string;
    location: string;
  };
  items: QuoteFormItem[];
}

interface ClientLookupOption {
  id: string;
  value: string;
  label: string;
}

interface QuoteBuilderProps {
  quoteId?: string;
}

interface StoredPaymentDetails {
  payment?: QuoteFormState["payment"];
  client_reference?: string;
  project_conditions?: string;
  observations?: string;
}

const DEFAULT_CONTACT = {
  name: "Eder Arteaga Mora",
  email: "contacto@edercreawebs.com",
  phone: "+52 (33) 1460-9228",
  website: "www.edercreawebs.com",
  address: "Mexico",
};

function createItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function createEmptyItem(overrides?: Partial<QuoteFormItem>): QuoteFormItem {
  return {
    id: createItemId(),
    item: "",
    description: "",
    qty: "1",
    price: "0",
    ...overrides,
  };
}

const INITIAL_FORM_STATE: QuoteFormState = {
  invoiceNumber: "ECW-2026-002",
  date: "2026-05-13",
  status: "draft",
  clientId: null,
  clientName: "Cliente / Empresa",
  clientReference: "edercreawebs.com/landing-page-premium",
  discountAmount: "0",
  taxRate: "16",
  notes:
    "50% de anticipo para iniciar el proyecto.\n50% restante contra entrega final.",
  projectConditions:
    "La cotizacion tiene vigencia de 15 dias. Los cambios fuera de alcance se cotizan por separado.",
  observations: "Hosting y dominio se renuevan de forma anual.",
  payment: {
    payableTo: "EderCreaWebs",
    paymentMethod: "Western Union",
    bank: "Banco Mercantil del Norte (Banorte)",
    clabe: "072320013047400960",
    swift: "MENOMXMTXXX",
    firstName: "Eder",
    lastName: "Arteaga",
    secondLastName: "Mora",
    country: "Mexico",
    state: "Jalisco",
    city: "Guadalajara",
    location: "Guadalajara, Jalisco, Mexico",
  },
  items: [
    {
      id: "item-1",
      item: "Website Building",
      description:
        "Sitio web corporativo responsivo con hasta 5 secciones, formulario de contacto y SEO basico.",
      qty: "1",
      price: "8800",
    },
    {
      id: "item-2",
      item: "Dominio y hosting anual",
      description:
        "Dominio .com por 12 meses, hosting compartido y certificado SSL incluido.",
      qty: "1",
      price: "1200",
    },
  ],
};

function parseAmount(value: string): number {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function clampPositive(amount: number): number {
  return Math.max(amount, 0);
}

function calculateItemTotal(item: QuoteFormItem): number {
  return roundCurrency(parseAmount(item.qty) * parseAmount(item.price));
}

function formatPreviewDate(value: string): string {
  if (!value) {
    return "13 May 2026";
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function buildPreviewItems(items: QuoteFormItem[]): InvoiceItem[] {
  return items.map((item) => ({
    id: item.id,
    item: item.item || "Service item",
    description:
      item.description ||
      "Add the detailed scope, deliverables, revisions or service notes for this item.",
    qty: parseAmount(item.qty),
    price: roundCurrency(parseAmount(item.price)),
    total: calculateItemTotal(item),
  }));
}

function buildClientLabel(client: Pick<Client, "name" | "company">): string {
  const company = client.company?.trim() ?? "";
  const name = client.name?.trim() ?? "";

  if (company && name) {
    return `${company} - ${name}`;
  }
  if (company) {
    return company;
  }
  if (name) {
    return name;
  }

  return "Cliente sin nombre";
}

function buildInvoiceData(form: QuoteFormState): InvoiceData {
  const items = buildPreviewItems(form.items);
  const subtotal = roundCurrency(
    items.reduce((total, item) => total + item.total, 0)
  );
  const discount = roundCurrency(clampPositive(parseAmount(form.discountAmount)));
  const taxRate = roundCurrency(clampPositive(parseAmount(form.taxRate)));
  const taxableBase = roundCurrency(Math.max(subtotal - discount, 0));
  const tax = roundCurrency((taxableBase * taxRate) / 100);
  const grandTotal = roundCurrency(taxableBase + tax);

  return {
    invoiceNumber: form.invoiceNumber || "ECW-2026-002",
    date: formatPreviewDate(form.date),
    currency: "MXN",
    contact: DEFAULT_CONTACT,
    clientName: form.clientName || "Cliente / Empresa",
    clientReference:
      form.clientReference || "Website, landing page or internal project reference",
    items,
    subtotal,
    discount,
    taxRate,
    tax,
    grandTotal,
    payment: {
      payableTo: form.payment.payableTo || "EderCreaWebs",
      paymentMethod: form.payment.paymentMethod || "Western Union",
      bank: form.payment.bank || "Banco por definir",
      clabe: form.payment.clabe || "072320013047400960",
      swift: form.payment.swift || "MENOMXMTXXX",
      firstName: form.payment.firstName || "Eder",
      lastName: form.payment.lastName || "Arteaga",
      secondLastName: form.payment.secondLastName || "Mora",
      country: form.payment.country || "Mexico",
      state: form.payment.state || "Jalisco",
      city: form.payment.city || "Guadalajara",
      location: form.payment.location || "Ciudad, Estado, Pais",
    },
    notes:
      form.notes ||
      "Add payment milestones, deposit terms or transfer instructions for the client.",
    projectConditions:
      form.projectConditions ||
      "Add the project conditions, revision policy and delivery terms for this quote.",
    observations:
      form.observations ||
      "Add any extra observations relevant to the quote.",
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

function toStoredPaymentDetails(form: QuoteFormState): StoredPaymentDetails {
  return {
    payment: form.payment,
    client_reference: form.clientReference,
    project_conditions: form.projectConditions,
    observations: form.observations,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStoredPaymentDetails(paymentDetails: unknown): StoredPaymentDetails {
  if (!isRecord(paymentDetails)) {
    return {};
  }

  const parsed: StoredPaymentDetails = {};

  if (isRecord(paymentDetails.payment)) {
    const payment = paymentDetails.payment;
    parsed.payment = {
      payableTo: String(payment.payableTo ?? ""),
      paymentMethod: String(payment.paymentMethod ?? ""),
      bank: String(payment.bank ?? ""),
      clabe: String(payment.clabe ?? ""),
      swift: String(payment.swift ?? ""),
      firstName: String(payment.firstName ?? ""),
      lastName: String(payment.lastName ?? ""),
      secondLastName: String(payment.secondLastName ?? ""),
      country: String(payment.country ?? ""),
      state: String(payment.state ?? ""),
      city: String(payment.city ?? ""),
      location: String(payment.location ?? ""),
    };
  }

  if (typeof paymentDetails.client_reference === "string") {
    parsed.client_reference = paymentDetails.client_reference;
  }
  if (typeof paymentDetails.project_conditions === "string") {
    parsed.project_conditions = paymentDetails.project_conditions;
  }
  if (typeof paymentDetails.observations === "string") {
    parsed.observations = paymentDetails.observations;
  }

  return parsed;
}

function mapQuoteItemsToForm(items: QuoteItem[]): QuoteFormItem[] {
  if (items.length === 0) {
    return [createEmptyItem()];
  }

  return items.map((item) => ({
    id: item.id,
    item: item.description,
    description: item.details ?? "",
    qty: String(item.quantity),
    price: String(item.unit_price),
  }));
}

export function QuoteBuilder({ quoteId }: QuoteBuilderProps) {
  const router = useRouter();
  const [form, setForm] = useState<QuoteFormState>(INITIAL_FORM_STATE);
  const [clientOptions, setClientOptions] = useState<ClientLookupOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientLoadError, setClientLoadError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(Boolean(quoteId));
  const [quoteLoadError, setQuoteLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const isEditMode = Boolean(quoteId);

  const previewData = buildInvoiceData(form);
  const itemTotals = form.items.map((item) => calculateItemTotal(item));
  const invoiceTaxRate = previewData.taxRate ?? 0;

  useEffect(() => {
    async function fetchClients() {
      if (!supabase) {
        setClientLoadError("Supabase no esta configurado. Puedes escribir cliente manualmente.");
        return;
      }

      setLoadingClients(true);
      setClientLoadError(null);

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company")
        .order("created_at", { ascending: false });

      if (error) {
        setClientLoadError(error.message);
        setLoadingClients(false);
        return;
      }

      const normalizedOptions = ((data ?? []) as Pick<Client, "id" | "name" | "company">[])
        .map((client) => ({
          id: client.id,
          value: buildClientLabel(client),
          label: buildClientLabel(client),
        }))
        .filter((client, index, all) => all.findIndex((entry) => entry.value === client.value) === index);

      setClientOptions(normalizedOptions);
      setLoadingClients(false);
    }

    fetchClients();
  }, [supabase]);

  useEffect(() => {
    async function fetchQuote() {
      if (!quoteId) {
        setLoadingQuote(false);
        return;
      }
      if (!supabase) {
        setQuoteLoadError("Supabase no está configurado.");
        setLoadingQuote(false);
        return;
      }

      setLoadingQuote(true);
      setQuoteLoadError(null);

      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (quoteError || !quoteData) {
        setQuoteLoadError(quoteError?.message || "No se encontró la cotización.");
        setLoadingQuote(false);
        return;
      }

      const { data: itemRows, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        setQuoteLoadError(itemsError.message);
        setLoadingQuote(false);
        return;
      }

      const quote = quoteData as Quote;
      const quoteItems = (itemRows as QuoteItem[]) ?? [];
      const storedDetails = readStoredPaymentDetails(quote.payment_details);

      setForm({
        invoiceNumber: quote.quote_number,
        date: quote.issue_date ?? "",
        status: quote.status,
        clientId: quote.client_id,
        clientName: quote.client_name ?? "",
        clientReference: storedDetails.client_reference ?? "",
        discountAmount: String(quote.discount_amount),
        taxRate: String(quote.tax_rate),
        notes: quote.notes ?? "",
        projectConditions: storedDetails.project_conditions ?? "",
        observations: storedDetails.observations ?? "",
        payment: storedDetails.payment ?? INITIAL_FORM_STATE.payment,
        items: mapQuoteItemsToForm(quoteItems),
      });

      setLoadingQuote(false);
    }

    fetchQuote();
  }, [quoteId, supabase]);

  function handleFieldChange<K extends keyof QuoteFormState>(
    field: K,
    value: QuoteFormState[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleClientNameChange(value: string) {
    const normalizedValue = value.trim();
    const selectedOption = clientOptions.find(
      (client) => client.value === normalizedValue
    );

    setForm((currentForm) => ({
      ...currentForm,
      clientName: value,
      clientId: selectedOption?.id ?? null,
    }));
  }

  function handlePaymentChange<K extends keyof QuoteFormState["payment"]>(
    field: K,
    value: QuoteFormState["payment"][K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      payment: {
        ...currentForm.payment,
        [field]: value,
      },
    }));
  }

  function handleItemChange<K extends keyof QuoteFormItem>(
    itemId: string,
    field: K,
    value: QuoteFormItem[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  }

  function handleAddItem() {
    setForm((currentForm) => ({
      ...currentForm,
      items: [...currentForm.items, createEmptyItem()],
    }));
  }

  function handleRemoveItem(itemId: string) {
    setForm((currentForm) => {
      if (currentForm.items.length === 1) {
        return currentForm;
      }

      return {
        ...currentForm,
        items: currentForm.items.filter((item) => item.id !== itemId),
      };
    });
  }

  async function handleSaveQuote() {
    if (!supabase) {
      setSaveNotice("Supabase no está configurado.");
      return;
    }

    setSaving(true);
    setSaveNotice(null);

    try {
      const quotePayload = {
        quote_number: form.invoiceNumber.trim() || "ECW-2026-002",
        client_id: form.clientId,
        project_id: null,
        client_name: form.clientName.trim() || null,
        issue_date: form.date || null,
        status: form.status,
        subtotal: previewData.subtotal ?? 0,
        discount_amount: previewData.discount ?? 0,
        tax_rate: previewData.taxRate ?? 16,
        tax_amount: previewData.tax ?? 0,
        grand_total: previewData.grandTotal,
        notes: form.notes.trim() || null,
        payment_details: toStoredPaymentDetails(form),
      };

      let persistedQuoteId = quoteId;

      if (persistedQuoteId) {
        const { error: updateError } = await supabase
          .from("quotes")
          .update(quotePayload)
          .eq("id", persistedQuoteId);

        if (updateError) throw new Error(updateError.message);

        const { error: deleteItemsError } = await supabase
          .from("quote_items")
          .delete()
          .eq("quote_id", persistedQuoteId);

        if (deleteItemsError) throw new Error(deleteItemsError.message);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("quotes")
          .insert([quotePayload])
          .select("id")
          .single();

        if (insertError) throw new Error(insertError.message);
        persistedQuoteId = (inserted as { id: string }).id;
      }

      if (!persistedQuoteId) {
        throw new Error("No se pudo obtener el id de la cotización guardada.");
      }

      const quoteItemsPayload = form.items.map((item, index) => ({
        quote_id: persistedQuoteId,
        description: item.item.trim() || `Item ${index + 1}`,
        details: item.description.trim() || null,
        quantity: roundCurrency(clampPositive(parseAmount(item.qty))),
        unit_price: roundCurrency(clampPositive(parseAmount(item.price))),
        total: calculateItemTotal(item),
        sort_order: index,
      }));

      const { error: itemsInsertError } = await supabase
        .from("quote_items")
        .insert(quoteItemsPayload);

      if (itemsInsertError) throw new Error(itemsInsertError.message);

      setSaveNotice("Cotización guardada correctamente.");

      if (!quoteId) {
        router.push(`/cotizaciones/${persistedQuoteId}`);
      }
    } catch (err) {
      setSaveNotice(
        err instanceof Error
          ? `No se pudo guardar la cotización: ${err.message}`
          : "No se pudo guardar la cotización."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingQuote) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (quoteLoadError) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
        Error al cargar cotización: {quoteLoadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEditMode ? "Editar cotización" : "Nueva cotizacion"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Captura datos y guarda cotizaciones en Supabase manteniendo la preview en vivo.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Button
            type="button"
            onClick={handleSaveQuote}
            disabled={saving}
            className="shrink-0"
          >
            {saving
              ? "Guardando..."
              : isEditMode
              ? "Guardar cambios"
              : "Guardar borrador"}
          </Button>
          <PrintButton />
        </div>
      </div>

      {saveNotice && (
        <div
          className={`text-sm rounded-md px-4 py-3 border ${
            saveNotice.startsWith("No se pudo")
              ? "text-red-700 bg-red-50 border-red-200"
              : "text-green-700 bg-green-50 border-green-200"
          }`}
        >
          {saveNotice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] print:block">
        <div className="space-y-5 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle>Datos generales</CardTitle>
              <CardDescription>
                Define la informacion principal que vera el cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-number">Numero de cotizacion</Label>
                  <Input
                    id="invoice-number"
                    value={form.invoiceNumber}
                    onChange={(event) =>
                      handleFieldChange("invoiceNumber", event.target.value)
                    }
                    placeholder="ECW-2026-002"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-date">Fecha</Label>
                  <Input
                    id="invoice-date"
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      handleFieldChange("date", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    handleFieldChange("status", value as QuoteStatus)
                  }
                >
                  <SelectTrigger id="quote-status">
                    <SelectValue>{QUOTE_STATUS_LABELS[form.status]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_QUOTE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {QUOTE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-name">Cliente / empresa</Label>
                <Input
                  id="client-name"
                  list="clients-lookup-list"
                  value={form.clientName}
                  onChange={(event) => handleClientNameChange(event.target.value)}
                  placeholder="Nombre comercial o razon social"
                />
                <datalist id="clients-lookup-list">
                  {clientOptions.map((client) => (
                    <option key={client.id} value={client.value}>
                      {client.label}
                    </option>
                  ))}
                </datalist>
                <p className="text-xs text-gray-500">
                  Escribe libremente o selecciona un cliente guardado.
                </p>
                {loadingClients && (
                  <p className="text-xs text-gray-400">Cargando clientes guardados...</p>
                )}
                {clientLoadError && (
                  <p className="text-xs text-amber-700">{clientLoadError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-reference">
                  Sitio web o referencia del proyecto
                </Label>
                <Input
                  id="client-reference"
                  value={form.clientReference}
                  onChange={(event) =>
                    handleFieldChange("clientReference", event.target.value)
                  }
                  placeholder="https://empresa.com o descripcion del proyecto"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                Agrega conceptos, detalle de servicio, cantidad y precio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {form.items.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Item {index + 1}
                      </p>
                      <p className="text-xs text-gray-500">
                        El total se calcula automaticamente.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={form.items.length === 1}
                      className="text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`item-name-${item.id}`}>Descripcion del item</Label>
                      <Input
                        id={`item-name-${item.id}`}
                        value={item.item}
                        onChange={(event) =>
                          handleItemChange(item.id, "item", event.target.value)
                        }
                        placeholder="Website Building"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`item-description-${item.id}`}>
                        Detalle largo del servicio
                      </Label>
                      <Textarea
                        id={`item-description-${item.id}`}
                        value={item.description}
                        onChange={(event) =>
                          handleItemChange(
                            item.id,
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Entregables, alcance, revisiones, tiempos o notas del servicio"
                        rows={4}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`item-qty-${item.id}`}>Cantidad</Label>
                        <Input
                          id={`item-qty-${item.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.qty}
                          onChange={(event) =>
                            handleItemChange(item.id, "qty", event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`item-price-${item.id}`}>Precio</Label>
                        <Input
                          id={`item-price-${item.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(event) =>
                            handleItemChange(item.id, "price", event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`item-total-${item.id}`}>Total calculado</Label>
                        <Input
                          id={`item-total-${item.id}`}
                          value={formatCurrency(itemTotals[index] ?? 0)}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={handleAddItem}>
                <Plus className="h-4 w-4" />
                Agregar item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totales</CardTitle>
              <CardDescription>
                Subtotal automatico con descuento en MXN e IVA por porcentaje.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input
                    id="subtotal"
                    value={formatCurrency(previewData.subtotal ?? 0)}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Descuento MXN</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountAmount}
                    onChange={(event) =>
                      handleFieldChange("discountAmount", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">IVA %</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.taxRate}
                    onChange={(event) =>
                      handleFieldChange("taxRate", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                  <span>Base IVA</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(roundCurrency(Math.max((previewData.subtotal ?? 0) - (previewData.discount ?? 0), 0)))}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm text-gray-600">
                  <span>IVA {invoiceTaxRate}%</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(previewData.tax ?? 0)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  Grand Total
                </p>
                <p className="mt-2 text-2xl font-black text-gray-900">
                  {formatCurrency(previewData.grandTotal)}
                  <span className="ml-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    MXN
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
              <CardDescription>
                Define notas de pago, condiciones y observaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notas de pago</Label>
                <Textarea
                  id="payment-notes"
                  value={form.notes}
                  onChange={(event) =>
                    handleFieldChange("notes", event.target.value)
                  }
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-conditions">Condiciones del proyecto</Label>
                <Textarea
                  id="project-conditions"
                  value={form.projectConditions}
                  onChange={(event) =>
                    handleFieldChange("projectConditions", event.target.value)
                  }
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observations">Observaciones</Label>
                <Textarea
                  id="observations"
                  value={form.observations}
                  onChange={(event) =>
                    handleFieldChange("observations", event.target.value)
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos de pago</CardTitle>
              <CardDescription>
                Muestra datos de cobro completos para que el cliente pueda pagar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payable-to">Payable To</Label>
                  <Input
                    id="payable-to"
                    value={form.payment.payableTo}
                    onChange={(event) =>
                      handlePaymentChange("payableTo", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Input
                    id="payment-method"
                    value={form.payment.paymentMethod}
                    onChange={(event) =>
                      handlePaymentChange("paymentMethod", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank">Banco</Label>
                  <Input
                    id="bank"
                    value={form.payment.bank}
                    onChange={(event) =>
                      handlePaymentChange("bank", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-location">Ubicacion</Label>
                  <Input
                    id="payment-location"
                    value={form.payment.location}
                    onChange={(event) =>
                      handlePaymentChange("location", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clabe">CLABE</Label>
                  <Input
                    id="clabe"
                    value={form.payment.clabe}
                    onChange={(event) =>
                      handlePaymentChange("clabe", event.target.value)
                    }
                    placeholder="072320013047400960"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="swift">SWIFT</Label>
                  <Input
                    id="swift"
                    value={form.payment.swift}
                    onChange={(event) =>
                      handlePaymentChange("swift", event.target.value)
                    }
                    placeholder="MENOMXMTXXX"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="payment-first-name">First Name</Label>
                  <Input
                    id="payment-first-name"
                    value={form.payment.firstName}
                    onChange={(event) =>
                      handlePaymentChange("firstName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-last-name">Last Name</Label>
                  <Input
                    id="payment-last-name"
                    value={form.payment.lastName}
                    onChange={(event) =>
                      handlePaymentChange("lastName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-second-last-name">Second Last Name</Label>
                  <Input
                    id="payment-second-last-name"
                    value={form.payment.secondLastName}
                    onChange={(event) =>
                      handlePaymentChange("secondLastName", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="payment-country">Country</Label>
                  <Input
                    id="payment-country"
                    value={form.payment.country}
                    onChange={(event) =>
                      handlePaymentChange("country", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-state">State</Label>
                  <Input
                    id="payment-state"
                    value={form.payment.state}
                    onChange={(event) =>
                      handlePaymentChange("state", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-city">City</Label>
                  <Input
                    id="payment-city"
                    value={form.payment.city}
                    onChange={(event) =>
                      handlePaymentChange("city", event.target.value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          <div className="print:hidden mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Preview en vivo
            </p>
            <p className="mt-1 text-sm text-gray-500">
              La plantilla se actualiza conforme capturas datos en el formulario.
            </p>
          </div>
          <div className="preview-frame overflow-auto rounded-2xl border border-gray-200 bg-gray-100/65 p-3 md:p-4">
            <div className="min-w-[820px] px-1 pb-2">
              <InvoiceTemplate data={previewData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
