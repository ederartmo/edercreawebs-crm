// Roles de aplicación
export type AppRole = "admin" | "editor" | "viewer";

// Estados del CRM - flujo de trabajo
export type CrmStatus =
  | "lead_nuevo"
  | "diagnostico"
  | "cotizacion_enviada"
  | "esperando_anticipo"
  | "cliente_ganado"
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
  | "tiktok"
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

// Métodos de pago
export type PaymentMethod =
  | "transferencia_bancaria"
  | "efectivo"
  | "tarjeta_credito"
  | "tarjeta_debito"
  | "cheque"
  | "otro";

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

export type ContextLinkType =
  | "chatgpt"
  | "drive_folder"
  | "md_document"
  | "google_doc"
  | "reference"
  | "quote"
  | "transcript"
  | "brand_assets"
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
  converted_client_id: string | null;
  converted_at: string | null;
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

// Proyecto
export interface Project {
  id: string;
  client_id: string;
  lead_id: string | null;
  title: string;
  project_type: ProjectType[];
  status: CrmStatus;
  total_price: number;
  deposit_amount: number;
  deposit_paid: boolean;
  final_payment_amount: number;
  final_payment_paid: boolean;
  domain_status: DomainStatus;
  drive_url: string | null;
  quote_url: string | null;
  test_url: string | null;
  final_url: string | null;
  start_date: string | null;
  due_date: string | null;
  next_action: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectInsert = Omit<Project, "id" | "created_at" | "updated_at">;
export type ProjectUpdate = Partial<ProjectInsert>;

export interface ProjectWithClient extends Project {
  clients: Pick<Client, "id" | "name" | "company" | "email" | "phone"> | null;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  sort_order: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectTaskInsert = Omit<ProjectTask, "id" | "created_at" | "updated_at">;
export type ProjectTaskUpdate = Partial<ProjectTaskInsert>;

// Nota de proyecto
export interface ProjectNote {
  id: string;
  project_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export type ProjectNoteInsert = Omit<ProjectNote, "id" | "created_at" | "updated_at">;

// Pago de proyecto
export interface Payment {
  id: string;
  project_id: string;
  concept: string;
  amount: number;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentInsert = Omit<Payment, "id" | "created_at" | "updated_at">;
export type PaymentUpdate = Partial<PaymentInsert>;

// Link de proyecto
export interface ProjectLink {
  id: string;
  project_id: string;
  label: string;
  url: string;
  type: LinkType;
  created_at: string;
  updated_at: string;
}

export type ProjectLinkInsert = Omit<ProjectLink, "id" | "created_at" | "updated_at">;
export type ProjectLinkUpdate = Partial<ProjectLinkInsert>;

export interface LeadLink {
  id: string;
  lead_id: string;
  label: string;
  url: string;
  type: ContextLinkType;
  created_at: string;
  updated_at: string;
}

export type LeadLinkInsert = Omit<LeadLink, "id" | "created_at" | "updated_at">;

export interface ClientLink {
  id: string;
  client_id: string;
  label: string;
  url: string;
  type: ContextLinkType;
  created_at: string;
  updated_at: string;
}

export type ClientLinkInsert = Omit<ClientLink, "id" | "created_at" | "updated_at">;

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
