import { PageHeader } from "@/components/page-header";
import { WhatsAppImporter } from "./whatsapp-importer";

export default function ImportWhatsAppPage() {
  return (
    <>
      <PageHeader
        eyebrow="Importación"
        title="Importar chat de WhatsApp"
        description="Sube el ZIP exportado por WhatsApp. Podrás revisar el contacto, la etapa y los archivos antes de guardarlos en el CRM."
      />
      <WhatsAppImporter />
    </>
  );
}
