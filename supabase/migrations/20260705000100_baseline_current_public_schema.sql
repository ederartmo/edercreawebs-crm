-- Baseline generated from supabase/public_schema_dump.sql
-- Sanitized for local migrations by removing dump-only metadata:
-- top-level SET statements, owner changes, comment on schema, grants, and default privileges.

CREATE SCHEMA IF NOT EXISTS "public";







CREATE TYPE "public"."lead_status" AS ENUM (
    'nuevo',
    'diagnostico',
    'calificado',
    'no_listo',
    'activos_solicitados',
    'activos_recibidos',
    'propuesta_visual',
    'cotizacion_pendiente_aprobacion',
    'cotizacion_enviada',
    'seguimiento',
    'anticipo_programado',
    'anticipo_recibido',
    'onboarding',
    'en_desarrollo',
    'revision',
    'entregado',
    'perdido'
);




CREATE TYPE "public"."message_direction" AS ENUM (
    'inbound',
    'outbound'
);




CREATE TYPE "public"."message_type" AS ENUM (
    'text',
    'audio',
    'image',
    'video',
    'document',
    'location',
    'contact',
    'reaction',
    'system',
    'unknown'
);




CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'confirmed',
    'failed',
    'refunded'
);




CREATE TYPE "public"."project_type" AS ENUM (
    'informativa',
    'tienda_cobro_usuarios',
    'cursos_complejo',
    'por_definir'
);




CREATE TYPE "public"."quote_status" AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'accepted',
    'rejected',
    'expired'
);




CREATE TYPE "public"."review_status" AS ENUM (
    'not_required',
    'pending',
    'approved',
    'edited',
    'rejected'
);




CREATE TYPE "public"."task_status" AS ENUM (
    'pending',
    'in_progress',
    'done',
    'cancelled'
);




CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;






CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "category" "text",
    "source" "text",
    "original_filename" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "storage_bucket" "text",
    "storage_path" "text",
    "external_url" "text",
    "extracted_text" "text",
    "transcription" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_client_facing" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."automation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "lead_id" "uuid",
    "workflow_name" "text" NOT NULL,
    "external_execution_id" "text",
    "status" "text" NOT NULL,
    "input" "jsonb",
    "output" "jsonb",
    "error" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone
);




CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text",
    "legal_name" "text",
    "industry" "text",
    "description" "text",
    "city" "text",
    "state" "text",
    "country" "text" DEFAULT 'MX'::"text",
    "phone" "text",
    "whatsapp" "text",
    "email" "text",
    "website" "text",
    "instagram_url" "text",
    "facebook_url" "text",
    "tiktok_url" "text",
    "google_business_url" "text",
    "logo_url" "text",
    "brand_colors" "jsonb" DEFAULT '[]'::"jsonb",
    "services" "jsonb" DEFAULT '[]'::"jsonb",
    "products" "jsonb" DEFAULT '[]'::"jsonb",
    "public_data" "jsonb" DEFAULT '{}'::"jsonb",
    "confirmed_data" "jsonb" DEFAULT '{}'::"jsonb",
    "missing_data" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "business_id" "uuid",
    "full_name" "text",
    "phone" "text" NOT NULL,
    "email" "text",
    "role" "text",
    "is_decision_maker" boolean,
    "is_payer" boolean,
    "is_intermediary" boolean,
    "preferred_channel" "text" DEFAULT 'whatsapp'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "provider_conversation_id" "text",
    "phone" "text",
    "is_open" boolean DEFAULT true NOT NULL,
    "bot_paused" boolean DEFAULT false NOT NULL,
    "last_message_at" timestamp with time zone,
    "last_inbound_at" timestamp with time zone,
    "last_outbound_at" timestamp with time zone,
    "unread_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "business_id" "uuid",
    "source" "text",
    "original_message" "text",
    "status" "public"."lead_status" DEFAULT 'nuevo'::"public"."lead_status" NOT NULL,
    "project_type" "public"."project_type" DEFAULT 'por_definir'::"public"."project_type" NOT NULL,
    "what_sells" "text",
    "how_sells" "text",
    "currently_selling" boolean,
    "business_maturity" "text",
    "runs_ads" boolean,
    "ad_platforms" "jsonb" DEFAULT '[]'::"jsonb",
    "ad_destination" "text",
    "main_problem" "text",
    "main_goal" "text",
    "requested_features" "jsonb" DEFAULT '[]'::"jsonb",
    "suggested_price" numeric(12,2),
    "approved_price" numeric(12,2),
    "currency" "text" DEFAULT 'MXN'::"text",
    "iva_rate" numeric(5,4) DEFAULT 0.16,
    "hosting_domain_price" numeric(12,2) DEFAULT 1200,
    "lead_score" integer DEFAULT 0 NOT NULL,
    "intention_level" "text",
    "likely_start_date" "date",
    "next_followup_at" timestamp with time zone,
    "decision_maker_name" "text",
    "payer_name" "text",
    "final_client_name" "text",
    "is_intermediary" boolean,
    "bot_mode" "text" DEFAULT 'copilot'::"text" NOT NULL,
    "human_required" boolean DEFAULT false NOT NULL,
    "human_reason" "text",
    "conversation_summary" "text",
    "internal_notes" "text",
    "lost_reason" "text",
    "drive_folder_url" "text",
    "current_quote_id" "uuid",
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE OR REPLACE VIEW "public"."crm_inbox" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "conversation_id",
    "l"."id" AS "lead_id",
    "co"."full_name" AS "contact_name",
    "co"."phone",
    "b"."name" AS "business_name",
    "l"."status",
    "l"."lead_score",
    "l"."intention_level",
    "l"."human_required",
    "l"."human_reason",
    "c"."bot_paused",
    "c"."unread_count",
    "c"."last_message_at",
    "l"."next_followup_at"
   FROM ((("public"."conversations" "c"
     JOIN "public"."leads" "l" ON (("l"."id" = "c"."lead_id")))
     JOIN "public"."contacts" "co" ON (("co"."id" = "l"."contact_id")))
     LEFT JOIN "public"."businesses" "b" ON (("b"."id" = "l"."business_id")))
  WHERE ("c"."is_open" = true);




CREATE TABLE IF NOT EXISTS "public"."crm_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "iva_rate" numeric(5,4) DEFAULT 0.16 NOT NULL,
    "hosting_domain_price" numeric(12,2) DEFAULT 1200 NOT NULL,
    "informative_price" numeric(12,2) DEFAULT 10000 NOT NULL,
    "commerce_min_price" numeric(12,2) DEFAULT 15000 NOT NULL,
    "commerce_max_price" numeric(12,2) DEFAULT 17000 NOT NULL,
    "course_base_price" numeric(12,2) DEFAULT 20000 NOT NULL,
    "deposit_percent" numeric(5,2) DEFAULT 50 NOT NULL,
    "delivery_days" integer DEFAULT 14 NOT NULL,
    "default_bot_mode" "text" DEFAULT 'copilot'::"text" NOT NULL,
    "prompt_version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."lead_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "from_status" "public"."lead_status",
    "to_status" "public"."lead_status" NOT NULL,
    "changed_by" "uuid",
    "changed_by_type" "text" DEFAULT 'system'::"text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "timezone" "text" DEFAULT 'America/Mexico_City'::"text",
    "calendar_event_id" "text",
    "meeting_url" "text",
    "status" "text" DEFAULT 'proposed'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "provider_message_id" "text",
    "direction" "public"."message_direction" NOT NULL,
    "type" "public"."message_type" DEFAULT 'text'::"public"."message_type" NOT NULL,
    "sender_phone" "text",
    "sender_name" "text",
    "body" "text",
    "processed_text" "text",
    "transcription" "text",
    "reply_to_provider_message_id" "text",
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_output" "jsonb",
    "ai_suggested_reply" "text",
    "final_reply" "text",
    "review_status" "public"."review_status" DEFAULT 'not_required'::"public"."review_status" NOT NULL,
    "review_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "type" "text" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'MXN'::"text" NOT NULL,
    "method" "text",
    "reference" "text",
    "proof_asset_id" "uuid",
    "paid_at" timestamp with time zone,
    "confirmed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(12,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "is_optional" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" "public"."quote_status" DEFAULT 'draft'::"public"."quote_status" NOT NULL,
    "title" "text",
    "scope_summary" "text",
    "currency" "text" DEFAULT 'MXN'::"text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(5,4) DEFAULT 0.16 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "hosting_domain_amount" numeric(12,2) DEFAULT 1200 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "deposit_percent" numeric(5,2) DEFAULT 50 NOT NULL,
    "deposit_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "balance_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "delivery_days" integer DEFAULT 14,
    "validity_days" integer DEFAULT 15,
    "valid_until" "date",
    "pdf_asset_id" "uuid",
    "drive_url" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."task_status" DEFAULT 'pending'::"public"."task_status" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "automation_key" "text",
    "created_by_type" "text" DEFAULT 'system'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."visual_proposal_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "section_type" "text" NOT NULL,
    "title" "text",
    "brief" "text" NOT NULL,
    "asset_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."visual_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "project_type" "public"."project_type" NOT NULL,
    "direction_notes" "text",
    "client_feedback" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_owner_id_phone_key" UNIQUE ("owner_id", "phone");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_settings"
    ADD CONSTRAINT "crm_settings_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."crm_settings"
    ADD CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_lead_id_version_key" UNIQUE ("lead_id", "version");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visual_proposal_sections"
    ADD CONSTRAINT "visual_proposal_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visual_proposal_sections"
    ADD CONSTRAINT "visual_proposal_sections_proposal_id_position_key" UNIQUE ("proposal_id", "position");



ALTER TABLE ONLY "public"."visual_proposals"
    ADD CONSTRAINT "visual_proposals_lead_id_version_key" UNIQUE ("lead_id", "version");



ALTER TABLE ONLY "public"."visual_proposals"
    ADD CONSTRAINT "visual_proposals_pkey" PRIMARY KEY ("id");



CREATE INDEX "assets_lead_idx" ON "public"."assets" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "conversations_last_message_idx" ON "public"."conversations" USING "btree" ("owner_id", "last_message_at" DESC);



CREATE INDEX "conversations_lead_idx" ON "public"."conversations" USING "btree" ("lead_id");



CREATE INDEX "leads_followup_idx" ON "public"."leads" USING "btree" ("owner_id", "next_followup_at");



CREATE INDEX "leads_owner_status_idx" ON "public"."leads" USING "btree" ("owner_id", "status");



CREATE INDEX "leads_score_idx" ON "public"."leads" USING "btree" ("owner_id", "lead_score" DESC);



CREATE INDEX "messages_conversation_time_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE UNIQUE INDEX "messages_provider_id_unique" ON "public"."messages" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE INDEX "payments_lead_idx" ON "public"."payments" USING "btree" ("lead_id", "created_at" DESC);



CREATE UNIQUE INDEX "tasks_automation_unique" ON "public"."tasks" USING "btree" ("lead_id", "automation_key") WHERE (("automation_key" IS NOT NULL) AND ("status" <> 'cancelled'::"public"."task_status"));



CREATE INDEX "tasks_due_idx" ON "public"."tasks" USING "btree" ("owner_id", "status", "due_at");



CREATE OR REPLACE TRIGGER "businesses_updated_at" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "crm_settings_updated_at" BEFORE UPDATE ON "public"."crm_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "meetings_updated_at" BEFORE UPDATE ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "quotes_updated_at" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_settings"
    ADD CONSTRAINT "crm_settings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_current_quote_fk" FOREIGN KEY ("current_quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_proof_asset_id_fkey" FOREIGN KEY ("proof_asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pdf_asset_id_fkey" FOREIGN KEY ("pdf_asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visual_proposal_sections"
    ADD CONSTRAINT "visual_proposal_sections_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visual_proposal_sections"
    ADD CONSTRAINT "visual_proposal_sections_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."visual_proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visual_proposals"
    ADD CONSTRAINT "visual_proposals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visual_proposals"
    ADD CONSTRAINT "visual_proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visual_proposals"
    ADD CONSTRAINT "visual_proposals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_all" ON "public"."assets" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."automation_runs" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."businesses" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."contacts" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."conversations" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."crm_settings" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."lead_status_history" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."leads" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."meetings" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."messages" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."payments" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."quotes" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."tasks" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."visual_proposals" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_section_owner" ON "public"."visual_proposal_sections" USING ((EXISTS ( SELECT 1
   FROM "public"."visual_proposals" "p"
  WHERE (("p"."id" = "visual_proposal_sections"."proposal_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."visual_proposals" "p"
  WHERE (("p"."id" = "visual_proposal_sections"."proposal_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "quote_item_owner" ON "public"."quote_items" USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quote_items"."quote_id") AND ("q"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quote_items"."quote_id") AND ("q"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."quote_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visual_proposal_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visual_proposals" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.businesses,
  public.contacts,
  public.leads,
  public.conversations,
  public.messages,
  public.assets,
  public.tasks,
  public.visual_proposals,
  public.visual_proposal_sections,
  public.quotes,
  public.quote_items,
  public.payments,
  public.meetings,
  public.lead_status_history,
  public.automation_runs,
  public.crm_settings
TO authenticated;

GRANT SELECT ON public.crm_inbox TO authenticated;
