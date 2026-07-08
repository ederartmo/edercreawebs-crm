import type {
  ContextLinkType,
  CrmStatus,
  DomainStatus,
  LeadSource,
  PaymentMethod,
  QuoteStatus,
  ProjectType,
} from "@/types";

// ── CRM Status ────────────────────────────────────────────────

export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  lead_nuevo: "Lead nuevo",
  diagnostico: "Diagnóstico",
  cotizacion_enviada: "Cotización enviada",
  esperando_anticipo: "Esperando anticipo",
  cliente_ganado: "Cliente ganado",
  info_pendiente: "Info pendiente",
  diseno: "Diseño",
  diseno_enviado: "Diseño enviado",
  ajustes_diseno: "Ajustes diseño",
  desarrollo: "Desarrollo",
  revision_cliente: "Revisión cliente",
  segundo_pago_pendiente: "2do pago pendiente",
  publicado: "Publicado",
  entregado: "Entregado",
  mantenimiento: "Mantenimiento",
  perdido: "Perdido",
};

// Tailwind classes para cada estado
export const CRM_STATUS_COLORS: Record<CrmStatus, string> = {
  lead_nuevo: "bg-blue-100 text-blue-800",
  diagnostico: "bg-indigo-100 text-indigo-800",
  cotizacion_enviada: "bg-violet-100 text-violet-800",
  esperando_anticipo: "bg-amber-100 text-amber-800",
  cliente_ganado: "bg-emerald-100 text-emerald-800",
  info_pendiente: "bg-yellow-100 text-yellow-800",
  diseno: "bg-cyan-100 text-cyan-800",
  diseno_enviado: "bg-teal-100 text-teal-800",
  ajustes_diseno: "bg-sky-100 text-sky-800",
  desarrollo: "bg-orange-100 text-orange-800",
  revision_cliente: "bg-lime-100 text-lime-800",
  segundo_pago_pendiente: "bg-rose-100 text-rose-800",
  publicado: "bg-emerald-100 text-emerald-800",
  entregado: "bg-green-100 text-green-800",
  mantenimiento: "bg-slate-100 text-slate-700",
  perdido: "bg-red-100 text-red-700",
};

// Solo los estados relevantes para leads (antes de convertirse en cliente/proyecto)
export const LEAD_STATUSES: CrmStatus[] = [
  "lead_nuevo",
  "diagnostico",
  "cotizacion_enviada",
  "esperando_anticipo",
  "cliente_ganado",
  "info_pendiente",
  "perdido",
];

export const NON_ACTIVE_LEAD_STATUSES: CrmStatus[] = [
  "perdido",
  "cliente_ganado",
];

export const PROJECT_STATUSES: CrmStatus[] = [
  "lead_nuevo",
  "diagnostico",
  "cotizacion_enviada",
  "esperando_anticipo",
  "info_pendiente",
  "diseno",
  "diseno_enviado",
  "ajustes_diseno",
  "desarrollo",
  "revision_cliente",
  "segundo_pago_pendiente",
  "publicado",
  "entregado",
  "mantenimiento",
  "perdido",
];

// Todos los estados CRM (para edición avanzada)
export const ALL_CRM_STATUSES = Object.keys(CRM_STATUS_LABELS) as CrmStatus[];

// ── Lead Source ───────────────────────────────────────────────

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  meta_ads: "Meta Ads",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  referido: "Referido",
  whatsapp: "WhatsApp",
  sitio_web: "Sitio web",
  otro: "Otro",
};

export const ALL_LEAD_SOURCES = Object.keys(
  LEAD_SOURCE_LABELS
) as LeadSource[];

// ── Project Type ──────────────────────────────────────────────

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  landing_page: "Landing page",
  sitio_web_informativo: "Sitio web informativo",
  sitio_web_con_formulario: "Sitio web con formulario",
  sitio_web_con_agenda: "Sitio web con agenda",
  sitio_web_con_chatbot: "Sitio web con chatbot",
  sitio_web_con_pagos: "Sitio web con pagos",
  sistema_con_login: "Sistema con login",
  portal_de_clientes: "Portal de clientes",
  dashboard_administrativo: "Dashboard administrativo",
  automatizacion: "Automatización",
  mantenimiento: "Mantenimiento",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia_bancaria: "Transferencia bancaria",
  efectivo: "Efectivo",
  tarjeta_credito: "Tarjeta crédito",
  tarjeta_debito: "Tarjeta débito",
  cheque: "Cheque",
  otro: "Otro",
};

export const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  "transferencia_bancaria",
  "efectivo",
  "tarjeta_credito",
  "tarjeta_debito",
  "cheque",
  "otro",
];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export const ALL_QUOTE_STATUSES = Object.keys(
  QUOTE_STATUS_LABELS
) as QuoteStatus[];
export const ALL_PROJECT_TYPES = Object.keys(
  PROJECT_TYPE_LABELS
) as ProjectType[];

// ── Domain Status ─────────────────────────────────────────────

export const DOMAIN_STATUS_LABELS: Record<DomainStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  comprado: "Comprado",
  conectado: "Conectado",
};

export const ALL_DOMAIN_STATUSES = Object.keys(
  DOMAIN_STATUS_LABELS
) as DomainStatus[];

export const CONTEXT_LINK_TYPE_LABELS: Record<ContextLinkType, string> = {
  chatgpt: "ChatGPT / diagnóstico",
  drive_folder: "Carpeta Drive",
  md_document: "Resumen .md",
  google_doc: "Google Doc",
  reference: "Referencia",
  quote: "Cotización",
  transcript: "Transcripción",
  brand_assets: "Branding / assets",
  other: "Otro",
};

export const ALL_CONTEXT_LINK_TYPES = Object.keys(
  CONTEXT_LINK_TYPE_LABELS
) as ContextLinkType[];
