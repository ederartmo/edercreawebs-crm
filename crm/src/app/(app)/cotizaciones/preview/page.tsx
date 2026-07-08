import { InvoiceTemplate } from "@/components/invoices/InvoiceTemplate";
import { PrintButton } from "@/components/invoices/PrintButton";
import { InvoiceData } from "@/types/invoice";

const MOCK_INVOICE: InvoiceData = {
  invoiceNumber: "ECW-2026-001",
  date: "13 May 2026",
  dueDate: "27 May 2026",
  currency: "MXN",
  contact: {
    name: "Eder Arteaga Mora",
    email: "contacto@edercreawebs.com",
    phone: "+52 (55) 1234-5678",
    website: "www.edercreawebs.com",
    address: "México",
  },
  clientName: "Cliente Ejemplo S.A. de C.V.",
  clientEmail: "cliente@ejemplo.com",
  clientReference: "edercreawebs.com/rediseno-corporativo",
  items: [
    {
      id: "1",
      item: "Website Building",
      description: "Sitio Web Corporativo — diseño responsivo, hasta 5 secciones, formulario de contacto, SEO básico y entrega con panel de administración.",
      qty: 1,
      price: 8800,
      total: 8800,
    },
    {
      id: "2",
      item: "Dominio y Hospedaje Web",
      description: "Registro de dominio .com (1 año) + hosting compartido con SSL incluido (1 año).",
      qty: 1,
      price: 1200,
      total: 1200,
    },
  ],
  subtotal: 10000,
  discount: 0,
  tax: 0,
  grandTotal: 10000,
  payment: {
    payableTo: "EderCreaWebs",
    accountHolder: "Eder Arteaga Mora",
    bank: "Banorte",
    clabe: "**** **** **** 0960",
    swift: "MENOMXMTXXX",
    paymentMethod: "Transferencia Bancaria / Western Union",
    location: "Ciudad de Mexico, Mexico",
  },
  notes:
    "El proyecto se paga en dos partes:\n• 50% de anticipo para iniciar el proyecto.\n• 50% restante contra entrega final.",
  projectConditions:
    "El hosting y dominio son anuales y deben renovarse cada año. Los cambios fuera de alcance se cotizan por separado.",
  observations:
    "La presente cotizacion tiene vigencia de 15 dias naturales.",
  serviceDescription:
    "El servicio incluye:\n• Diseño web personalizado basado en identidad de marca.\n• Desarrollo con tecnología moderna (Next.js / React).\n• Sitio responsivo optimizado para móvil, tablet y escritorio.\n• Integración de formulario de contacto con notificaciones por email.\n• Optimización SEO básica (meta tags, Open Graph, sitemap).\n• Panel de administración de contenido (si aplica).\n• Entrega con documentación de accesos y capacitación básica.\n• Soporte técnico 30 días después de la entrega.",
};

export default function InvoicePreviewPage() {
  return (
    <>
      {/* Barra de acción — solo visible en pantalla, oculta al imprimir */}
      <div className="print:hidden flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Vista Previa de Invoice
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Plantilla con datos de ejemplo · No conectada a base de datos
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Template del invoice */}
      <div className="overflow-x-auto pb-4">
        <InvoiceTemplate data={MOCK_INVOICE} />
      </div>
    </>
  );
}
