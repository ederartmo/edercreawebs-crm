// Roles de aplicación
export type AppRole = "admin" | "editor" | "viewer";

// Estados del CRM - flujo de trabajo
export type CrmStatus =
  | "lead_nuevo"
  | "diagnostico"
  | "cotizacion_enviada"
  | "esperando_anticipo"
  | "info_pendiente"
  | "diseno"
  | "diseno_enviado"
  | "ajustes_diseno"
  | "desarrollo"
  | "revision_cliente"
  | "segundo_pago_pendiente"
  | "publicado"
  | "entregado"
  | "mantenimiento"
  | "perdido";

// Fuentes de leads
export type LeadSource =
  | "meta_ads"
  | "instagram"
  | "facebook"
  | "referido"
  | "whatsapp"
  | "sitio_web"
  | "otro";

// Tipos de proyectos
export type ProjectType =
  | "landing_page"
  | "sitio_web_informativo"
  | "sitio_web_con_formulario"
  | "sitio_web_con_agenda"
  | "sitio_web_con_chatbot"
  | "sitio_web_con_pagos"
  | "sistema_con_login"
  | "portal_de_clientes"
  | "dashboard_administrativo"
  | "automatizacion"
  | "mantenimiento";

// Estados de tareas
export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

// Estados de pagos
export type PaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

// Estados de dominio
export type DomainStatus = "pendiente" | "confirmado" | "comprado" | "conectado";

// Tipos de links
export type LinkType =
  | "drive"
  | "quote"
  | "design"
  | "test_site"
  | "final_site"
  | "repository"
  | "hosting"
  | "domain"
  | "admin_panel"
  | "other";

// Estados de mantenimiento
export type MaintenanceStatus =
  | "active"
  | "paused"
  | "pending_payment"
  | "cancelled";

// Lead
export interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  business_type: string | null;
  need_summary: string | null;
  status: CrmStatus;
  notes: string | null;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadInsert = Omit<Lead, "id" | "created_at" | "updated_at">;
export type LeadUpdate = Partial<LeadInsert>;

// Cliente
export interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  address: string | null;
  website: string | null;
  social_links: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientInsert = Omit<Client, "id" | "created_at" | "updated_at" | "social_links">;
export type ClientUpdate = Partial<ClientInsert>;

// Usuario autenticado
export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

// Contexto de sesión
export interface AuthSession {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}
