import type { CrmStatus, LeadSource } from "@/types";

// ── CRM Status ────────────────────────────────────────────────

export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  lead_nuevo: "Lead nuevo",
  diagnostico: "Diagnóstico",
  cotizacion_enviada: "Cotización enviada",
  esperando_anticipo: "Esperando anticipo",
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
  "info_pendiente",
  "perdido",
];

// Todos los estados CRM (para edición avanzada)
export const ALL_CRM_STATUSES = Object.keys(CRM_STATUS_LABELS) as CrmStatus[];

// ── Lead Source ───────────────────────────────────────────────

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  meta_ads: "Meta Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  referido: "Referido",
  whatsapp: "WhatsApp",
  sitio_web: "Sitio web",
  otro: "Otro",
};

export const ALL_LEAD_SOURCES = Object.keys(
  LEAD_SOURCE_LABELS
) as LeadSource[];
