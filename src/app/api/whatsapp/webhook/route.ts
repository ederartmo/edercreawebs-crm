import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWhatsAppSendConfigured,
  sendWhatsAppText,
  verifyMetaWebhookSignature,
} from "@/lib/whatsapp/cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIRST_REPLY =
  "Hola 😁 Cuéntame un poco de tu negocio: ¿qué vendes y cómo suelen llegarte actualmente tus clientes?";

const ACTIVE_LEAD_STATUSES = [
  "nuevo",
  "diagnostico",
  "calificado",
  "no_listo",
  "activos_solicitados",
  "activos_recibidos",
  "propuesta_visual",
  "cotizacion_pendiente_aprobacion",
  "cotizacion_enviada",
  "seguimiento",
  "anticipo_programado",
  "anticipo_recibido",
  "onboarding",
  "en_desarrollo",
  "revision",
] as const;

type IncomingTextMessage = {
  id: string;
  from: string;
  senderName: string | null;
  body: string;
  receivedAt: string;
  rawMessage: unknown;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function timestampToIso(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date().toISOString();
  }
  return new Date(seconds * 1000).toISOString();
}

function extractIncomingTextMessages(payload: unknown): IncomingTextMessage[] {
  const root = asRecord(payload);
  if (!root) return [];

  const extracted: IncomingTextMessage[] = [];

  for (const entryValue of asArray(root.entry)) {
    const entry = asRecord(entryValue);
    if (!entry) continue;

    for (const changeValue of asArray(entry.changes)) {
      const change = asRecord(changeValue);
      const value = asRecord(change?.value);
      if (!value) continue;

      const contactNames = new Map<string, string>();
      for (const contactValue of asArray(value.contacts)) {
        const contact = asRecord(contactValue);
        const waId = asString(contact?.wa_id);
        const profile = asRecord(contact?.profile);
        const name = asString(profile?.name);
        if (waId && name) contactNames.set(waId, name);
      }

      for (const messageValue of asArray(value.messages)) {
        const message = asRecord(messageValue);
        if (!message) continue;

        const id = asString(message.id);
        const from = asString(message.from);
        const type = asString(message.type);
        const text = asRecord(message.text);
        const body = asString(text?.body);

        if (!id || !from || type !== "text" || !body) continue;

        extracted.push({
          id,
          from,
          senderName: contactNames.get(from) ?? null,
          body,
          receivedAt: timestampToIso(message.timestamp),
          rawMessage: message,
        });
      }
    }
  }

  return extracted;
}

async function getOrCreateContact(args: {
  ownerId: string;
  phone: string;
  senderName: string | null;
}) {
  const supabase = createAdminClient();
  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("id,full_name,phone")
    .eq("owner_id", args.ownerId)
    .eq("phone", args.phone)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    if (!existing.full_name && args.senderName) {
      await supabase
        .from("contacts")
        .update({ full_name: args.senderName })
        .eq("id", existing.id);
    }
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("contacts")
    .insert({
      owner_id: args.ownerId,
      phone: args.phone,
      full_name: args.senderName,
      preferred_channel: "whatsapp",
    })
    .select("id,full_name,phone")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Could not create WhatsApp contact");
  }

  return created;
}

async function getOrCreateLead(args: {
  ownerId: string;
  contactId: string;
  originalMessage: string;
}) {
  const supabase = createAdminClient();
  const { data: activeLead, error: findError } = await supabase
    .from("leads")
    .select("id,status")
    .eq("owner_id", args.ownerId)
    .eq("contact_id", args.contactId)
    .in("status", [...ACTIVE_LEAD_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (activeLead) return activeLead;

  const { data: created, error: createError } = await supabase
    .from("leads")
    .insert({
      owner_id: args.ownerId,
      contact_id: args.contactId,
      source: "whatsapp_cloud",
      original_message: args.originalMessage,
      status: "nuevo",
    })
    .select("id,status")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Could not create WhatsApp lead");
  }

  return created;
}

async function getOrCreateConversation(args: {
  ownerId: string;
  leadId: string;
  phone: string;
  receivedAt: string;
}) {
  const supabase = createAdminClient();
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id,bot_paused")
    .eq("owner_id", args.ownerId)
    .eq("lead_id", args.leadId)
    .eq("provider", "whatsapp")
    .eq("is_open", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      owner_id: args.ownerId,
      lead_id: args.leadId,
      provider: "whatsapp",
      provider_conversation_id: args.phone,
      phone: args.phone,
      is_open: true,
      bot_paused: false,
      unread_count: 0,
      last_message_at: args.receivedAt,
      last_inbound_at: args.receivedAt,
    })
    .select("id,bot_paused")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Could not create WhatsApp conversation");
  }

  return created;
}

async function processIncomingMessage(message: IncomingTextMessage) {
  const ownerId = requiredEnv("CRM_OWNER_ID");
  const supabase = createAdminClient();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("messages")
    .select("id")
    .eq("provider_message_id", message.id)
    .maybeSingle();

  if (duplicateError) throw duplicateError;
  if (duplicate) return { duplicate: true, replied: false };

  const contact = await getOrCreateContact({
    ownerId,
    phone: message.from,
    senderName: message.senderName,
  });
  const lead = await getOrCreateLead({
    ownerId,
    contactId: contact.id,
    originalMessage: message.body,
  });
  const conversation = await getOrCreateConversation({
    ownerId,
    leadId: lead.id,
    phone: message.from,
    receivedAt: message.receivedAt,
  });

  const { count: previousMessageCount, error: countError } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversation.id);

  if (countError) throw countError;

  const { error: insertError } = await supabase.from("messages").insert({
    owner_id: ownerId,
    conversation_id: conversation.id,
    lead_id: lead.id,
    provider_message_id: message.id,
    direction: "inbound",
    type: "text",
    sender_phone: message.from,
    sender_name: message.senderName,
    body: message.body,
    processed_text: message.body,
    raw_payload: message.rawMessage,
    received_at: message.receivedAt,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { duplicate: true, replied: false };
    }
    throw insertError;
  }

  await supabase
    .from("conversations")
    .update({
      last_message_at: message.receivedAt,
      last_inbound_at: message.receivedAt,
      unread_count: (previousMessageCount ?? 0) + 1,
    })
    .eq("id", conversation.id);

  const isFirstConversationMessage = (previousMessageCount ?? 0) === 0;
  if (!isFirstConversationMessage || conversation.bot_paused) {
    return { duplicate: false, replied: false };
  }

  // Business verification can delay access to a permanent WhatsApp token.
  // Receive-only mode lets us validate Meta -> webhook -> Supabase now and
  // automatically starts replying once the send credentials are configured.
  if (!isWhatsAppSendConfigured()) {
    console.warn("WhatsApp send skipped: outbound credentials are not configured yet");
    return { duplicate: false, replied: false };
  }

  const sentAt = new Date().toISOString();
  const outboundProviderMessageId = await sendWhatsAppText(
    message.from,
    FIRST_REPLY,
  );

  const { error: outboundInsertError } = await supabase.from("messages").insert({
    owner_id: ownerId,
    conversation_id: conversation.id,
    lead_id: lead.id,
    provider_message_id: outboundProviderMessageId,
    direction: "outbound",
    type: "text",
    sender_name: "Eder Crea Webs",
    body: FIRST_REPLY,
    processed_text: FIRST_REPLY,
    final_reply: FIRST_REPLY,
    review_status: "not_required",
    sent_at: sentAt,
  });

  if (outboundInsertError) throw outboundInsertError;

  await supabase
    .from("conversations")
    .update({
      last_message_at: sentAt,
      last_outbound_at: sentAt,
    })
    .eq("id", conversation.id);

  return { duplicate: false, replied: true };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (
    mode === "subscribe" &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    if (!verifyMetaWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as unknown;
    const messages = extractIncomingTextMessages(payload);

    // Meta also posts delivery/read statuses to this endpoint. They are
    // acknowledged here but ignored by this first MVP.
    if (messages.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const results = [];
    for (const message of messages) {
      results.push(await processIncomingMessage(message));
    }

    return NextResponse.json({
      ok: true,
      processed: messages.length,
      replied: results.filter((result) => result.replied).length,
      duplicates: results.filter((result) => result.duplicate).length,
    });
  } catch (error) {
    console.error("WhatsApp webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
