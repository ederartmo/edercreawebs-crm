import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminOfWhatsAppHandoff } from "@/lib/whatsapp/admin-alert";
import { transcribeWhatsAppAudio } from "@/lib/whatsapp/audio";
import {
  runWhatsAppSalesAgent,
  type WhatsAppAgentMessage,
} from "@/lib/whatsapp/sales-agent";
import {
  isWhatsAppSendConfigured,
  sendWhatsAppText,
  verifyMetaWebhookSignature,
} from "@/lib/whatsapp/cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type IncomingWhatsAppMessage = {
  id: string;
  from: string;
  senderName: string | null;
  kind: "text" | "audio";
  body: string | null;
  mediaId: string | null;
  mimeType: string | null;
  receivedAt: string;
  phoneNumberId: string | null;
  rawMessage: unknown;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
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
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function extractIncomingMessages(payload: unknown): IncomingWhatsAppMessage[] {
  const root = asRecord(payload);
  if (!root) return [];
  const extracted: IncomingWhatsAppMessage[] = [];

  for (const entryValue of asArray(root.entry)) {
    const entry = asRecord(entryValue);
    if (!entry) continue;

    for (const changeValue of asArray(entry.changes)) {
      const change = asRecord(changeValue);
      const value = asRecord(change?.value);
      if (!value) continue;

      const metadata = asRecord(value.metadata);
      const phoneNumberId = asString(metadata?.phone_number_id) || null;
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
        if (!id || !from) continue;

        if (type === "text") {
          const text = asRecord(message.text);
          const body = asString(text?.body);
          if (!body) continue;

          extracted.push({
            id,
            from,
            senderName: contactNames.get(from) ?? null,
            kind: "text",
            body,
            mediaId: null,
            mimeType: null,
            receivedAt: timestampToIso(message.timestamp),
            phoneNumberId,
            rawMessage: message,
          });
          continue;
        }

        if (type === "audio") {
          const audio = asRecord(message.audio);
          const mediaId = asString(audio?.id);
          const mimeType = asString(audio?.mime_type) || null;
          if (!mediaId) continue;

          extracted.push({
            id,
            from,
            senderName: contactNames.get(from) ?? null,
            kind: "audio",
            body: null,
            mediaId,
            mimeType,
            receivedAt: timestampToIso(message.timestamp),
            phoneNumberId,
            rawMessage: message,
          });
        }
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
      return { ...existing, full_name: args.senderName };
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
    .select("id,bot_paused,unread_count")
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
    .select("id,bot_paused,unread_count")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Could not create WhatsApp conversation");
  }
  return created;
}

async function sendAndPersistReply(args: {
  ownerId: string;
  conversationId: string;
  leadId: string;
  to: string;
  body: string;
}) {
  const supabase = createAdminClient();
  const sentAt = new Date().toISOString();
  const outboundProviderMessageId = await sendWhatsAppText(args.to, args.body);

  const { error: outboundInsertError } = await supabase.from("messages").insert({
    owner_id: args.ownerId,
    conversation_id: args.conversationId,
    lead_id: args.leadId,
    provider_message_id: outboundProviderMessageId,
    direction: "outbound",
    type: "text",
    sender_name: "Eder Crea Webs",
    body: args.body,
    processed_text: args.body,
    final_reply: args.body,
    review_status: "not_required",
    sent_at: sentAt,
  });
  if (outboundInsertError) throw outboundInsertError;

  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({ last_message_at: sentAt, last_outbound_at: sentAt })
    .eq("id", args.conversationId);
  if (conversationUpdateError) throw conversationUpdateError;
}

async function getAgentContext(args: {
  leadId: string;
  conversationId: string;
  contactName: string | null;
}) {
  const supabase = createAdminClient();
  const [leadResult, timelineResult] = await Promise.all([
    supabase
      .from("leads")
      .select("original_message,what_sells,how_sells")
      .eq("id", args.leadId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("body,direction,created_at")
      .eq("conversation_id", args.conversationId)
      .in("direction", ["inbound", "outbound"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (leadResult.error) throw leadResult.error;
  if (timelineResult.error) throw timelineResult.error;

  const messages: WhatsAppAgentMessage[] = (timelineResult.data ?? [])
    .slice()
    .reverse()
    .filter((item) => typeof item.body === "string" && item.body.trim())
    .map((item) => ({
      role: item.direction === "outbound" ? "assistant" : "user",
      content: item.body.trim(),
    }));

  return {
    lead: {
      leadId: args.leadId,
      contactName: args.contactName,
      originalMessage: leadResult.data?.original_message?.trim() || null,
      whatSells: leadResult.data?.what_sells?.trim() || null,
      howSells: leadResult.data?.how_sells?.trim() || null,
    },
    messages,
  };
}

async function finishWhatsAppAgentHandoff(args: {
  ownerId: string;
  leadId: string;
  previousLeadStatus: string;
  conversationId: string;
  agentSummary: string | null;
  handoffReason: string | null;
}) {
  const supabase = createAdminClient();
  const { data: leadData, error: leadReadError } = await supabase
    .from("leads")
    .select("what_sells,how_sells")
    .eq("id", args.leadId)
    .maybeSingle();
  if (leadReadError) throw leadReadError;

  const now = new Date().toISOString();
  const summary = [
    "WhatsApp Agent V2 — listo para Eder",
    args.agentSummary ? `Resumen del agente: ${args.agentSummary}` : null,
    `Negocio/adquisición: ${leadData?.what_sells?.trim() || "Pendiente"}`,
    `Proceso comercial: ${leadData?.how_sells?.trim() || "Pendiente"}`,
    args.handoffReason ? `Motivo del handoff: ${args.handoffReason}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({
      status: "calificado",
      human_required: true,
      human_reason: "whatsapp_agent_v2_ready_for_handoff",
      conversation_summary: summary,
      updated_at: now,
    })
    .eq("id", args.leadId);
  if (leadUpdateError) throw leadUpdateError;

  if (args.previousLeadStatus !== "calificado") {
    const { error: historyError } = await supabase.from("lead_status_history").insert({
      owner_id: args.ownerId,
      lead_id: args.leadId,
      from_status: args.previousLeadStatus,
      to_status: "calificado",
      changed_by_type: "system",
      reason: "WhatsApp Agent V2 requested human handoff",
    });
    if (historyError) throw historyError;
  }

  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({ bot_paused: true, updated_at: now })
    .eq("id", args.conversationId);
  if (conversationUpdateError) throw conversationUpdateError;
}

async function processIncomingMessage(message: IncomingWhatsAppMessage) {
  const ownerId = requiredEnv("CRM_OWNER_ID");
  const expectedPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (
    expectedPhoneNumberId &&
    message.phoneNumberId &&
    message.phoneNumberId !== expectedPhoneNumberId
  ) {
    console.warn(
      `WhatsApp webhook ignored for unexpected phone_number_id: ${message.phoneNumberId}`,
    );
    return { duplicate: false, replied: false, handoff: false, ignored: true };
  }

  const supabase = createAdminClient();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("messages")
    .select("id")
    .eq("provider_message_id", message.id)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) {
    return { duplicate: true, replied: false, handoff: false, ignored: false };
  }

  let body = message.body?.trim() || "";
  let transcription: string | null = null;
  let transcriptionFailed = false;

  if (message.kind === "audio") {
    try {
      transcription = await transcribeWhatsAppAudio(message.mediaId!);
      body = transcription;
    } catch (error) {
      transcriptionFailed = true;
      body = "[Audio recibido; no se pudo transcribir automáticamente]";
      console.error("WhatsApp audio transcription error", error);
    }
  }

  const contact = await getOrCreateContact({
    ownerId,
    phone: message.from,
    senderName: message.senderName,
  });
  const lead = await getOrCreateLead({
    ownerId,
    contactId: contact.id,
    originalMessage: body,
  });
  const conversation = await getOrCreateConversation({
    ownerId,
    leadId: lead.id,
    phone: message.from,
    receivedAt: message.receivedAt,
  });

  const { error: insertError } = await supabase.from("messages").insert({
    owner_id: ownerId,
    conversation_id: conversation.id,
    lead_id: lead.id,
    provider_message_id: message.id,
    direction: "inbound",
    type: message.kind,
    sender_phone: message.from,
    sender_name: message.senderName,
    body,
    processed_text: body,
    transcription,
    raw_payload: message.rawMessage,
    received_at: message.receivedAt,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { duplicate: true, replied: false, handoff: false, ignored: false };
    }
    throw insertError;
  }

  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({
      last_message_at: message.receivedAt,
      last_inbound_at: message.receivedAt,
      unread_count: (conversation.unread_count ?? 0) + 1,
    })
    .eq("id", conversation.id);
  if (conversationUpdateError) throw conversationUpdateError;

  if (conversation.bot_paused) {
    return { duplicate: false, replied: false, handoff: false, ignored: false };
  }

  if (!isWhatsAppSendConfigured()) {
    console.warn("WhatsApp send skipped: outbound credentials are not configured yet");
    return { duplicate: false, replied: false, handoff: false, ignored: false };
  }

  if (transcriptionFailed) {
    await sendAndPersistReply({
      ownerId,
      conversationId: conversation.id,
      leadId: lead.id,
      to: message.from,
      body: "Sí recibí tu audio 👍 pero no logré transcribirlo bien esta vez. ¿Me lo puedes reenviar o escribir lo principal?",
    });
    return { duplicate: false, replied: true, handoff: false, ignored: false };
  }

  const agentContext = await getAgentContext({
    leadId: lead.id,
    conversationId: conversation.id,
    contactName: contact.full_name ?? message.senderName,
  });

  let agentResult;
  try {
    agentResult = await runWhatsAppSalesAgent(agentContext);
  } catch (error) {
    console.error("WhatsApp sales agent error", error);
    await sendAndPersistReply({
      ownerId,
      conversationId: conversation.id,
      leadId: lead.id,
      to: message.from,
      body: "Te sigo 👍 Se me cruzó un problema técnico un segundo. ¿Me repites el último mensaje? Prefiero preguntarte otra vez a responderte cualquier cosa.",
    });
    return { duplicate: false, replied: true, handoff: false, ignored: false };
  }

  if (agentResult.handoffRequested) {
    await finishWhatsAppAgentHandoff({
      ownerId,
      leadId: lead.id,
      previousLeadStatus: lead.status,
      conversationId: conversation.id,
      agentSummary: agentResult.handoffSummary,
      handoffReason: agentResult.handoffReason,
    });
  }

  await sendAndPersistReply({
    ownerId,
    conversationId: conversation.id,
    leadId: lead.id,
    to: message.from,
    body: agentResult.reply,
  });

  if (agentResult.handoffRequested) {
    await notifyAdminOfWhatsAppHandoff({
      leadId: lead.id,
      leadPhone: message.from,
      leadName: contact.full_name ?? message.senderName,
    });
  }

  return {
    duplicate: false,
    replied: true,
    handoff: agentResult.handoffRequested,
    ignored: false,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
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
    const messages = extractIncomingMessages(payload);
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
      handoffs: results.filter((result) => result.handoff).length,
      duplicates: results.filter((result) => result.duplicate).length,
      ignored: results.filter((result) => result.ignored).length,
    });
  } catch (error) {
    console.error("WhatsApp webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
