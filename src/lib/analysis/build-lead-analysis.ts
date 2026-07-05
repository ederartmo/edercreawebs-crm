import {
  analyzeWhatsAppCommercially,
  type CommercialChatAnalysis,
} from "@/lib/whatsapp/analyze-commercial";
import type { ParsedWhatsAppExport, ParsedWhatsAppMessage } from "@/lib/whatsapp/parse-export";

type LeadRow = {
  id: string;
  project_type: string | null;
};

type BusinessRow = {
  name: string | null;
};

type ContactRow = {
  full_name: string | null;
  phone: string | null;
};

type MessageRow = {
  id: string;
  direction: string;
  type: string | null;
  sender_name: string | null;
  body: string | null;
  processed_text: string | null;
  transcription: string | null;
  created_at: string;
};

type AssetRow = {
  id: string;
  message_id: string | null;
  category: string | null;
  original_filename: string | null;
  mime_type: string | null;
  extracted_text: string | null;
  transcription: string | null;
  metadata: unknown;
};

type PaymentRow = {
  id: string;
  type: string;
  status: string;
  amount: number | string;
  currency: string;
  paid_at: string | null;
  created_at: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
};

type MeetingRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  starts_at: string | null;
  meeting_url: string | null;
};

type PreviousAnalysisRunRow = {
  id: string;
};

type LeadCommercialAnalysisOutput = {
  what_sells: string;
  main_problem: string;
  main_goal: string;
  requested_features: string[];
  lead_score: number;
  intention_level: CommercialChatAnalysis["intentionLevel"];
  suggested_price: number | null;
  currency: CommercialChatAnalysis["currency"];
  confidence: CommercialChatAnalysis["confidence"];
  reasons: string[];
};

type StoredImageAnalysis = {
  summary: string | null;
  detected_text: string | null;
  confidence: "alta" | "media" | "baja" | null;
};

type StoredPdfAnalysis = {
  summary: string | null;
  detected_text: string | null;
  confidence: "alta" | "media" | "baja" | null;
};

type LeadFullAnalysisInput = {
  schema_version: "lead_full_analysis_v1";
  source: "lead_profile_manual_analysis";
  message_count: number;
  audio_count: number;
  image_count: number;
  pdf_count: number;
  analyzed_asset_count: number;
  pending_asset_count: number;
};

type AssetEvidence = {
  asset_id: string;
  message_id: string | null;
  filename: string;
  type: "audio" | "image" | "pdf";
  summary: string;
  confidence: "alta" | "media" | "baja" | null;
  stored_in_asset_metadata: boolean;
  stored_in_asset_transcription: boolean;
  stored_in_asset_extracted_text: boolean;
};

type PendingAsset = {
  asset_id: string;
  filename: string;
  type: "audio" | "image" | "pdf";
};

type LeadFullAnalysisOutput = {
  schema_version: "lead_full_analysis_v1";
  commercial_analysis: LeadCommercialAnalysisOutput;
  image_analyses: AssetEvidence[];
  pdf_analyses: AssetEvidence[];
  audio_evidence: AssetEvidence[];
  post_payment_context: {
    payment_count: number;
    confirmed_payment_count: number;
    recent_payments: Array<{
      id: string;
      type: string;
      status: string;
      amount: number | null;
      currency: string;
      paid_at: string | null;
    }>;
    task_count: number;
    open_task_count: number;
    open_tasks: Array<{
      id: string;
      title: string;
      status: string;
      due_at: string | null;
    }>;
    meeting_count: number;
    upcoming_meetings: Array<{
      id: string;
      type: string;
      title: string;
      status: string;
      starts_at: string | null;
      has_meeting_url: boolean;
    }>;
  };
  pending_assets: PendingAsset[];
  previous_analysis_run_id: string | null;
};

export type BuildLeadAnalysisArgs = {
  lead: LeadRow;
  business: BusinessRow | null;
  contact: ContactRow | null;
  messages: MessageRow[];
  assets: AssetRow[];
  payments: PaymentRow[];
  tasks: TaskRow[];
  meetings: MeetingRow[];
  previousAnalysisRun: PreviousAnalysisRunRow | null;
  userEmail: string | null;
  userDisplayName: string | null;
};

export type BuiltLeadAnalysis = {
  ownerAlias: string;
  parsed: ParsedWhatsAppExport;
  input: LeadFullAnalysisInput;
  output: LeadFullAnalysisOutput;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function confidenceValue(value: unknown) {
  return value === "alta" || value === "media" || value === "baja" ? value : null;
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeText(value: string) {
  const cleaned = normalizeSpace(value);
  if (!cleaned) return "";
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
}

function inferOwnerAlias(messages: MessageRow[], fallback: string) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const message of messages) {
    if (message.direction !== "outbound") continue;
    const senderName = textValue(message.sender_name);
    if (!senderName) continue;
    const key = senderName.toLocaleLowerCase("es-MX");
    const current = counts.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    counts.set(key, { label: senderName, count: 1 });
  }

  const topSender = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];
  return topSender?.label ?? fallback;
}

function buildMessageBody(message: MessageRow) {
  const segments = uniqueStrings(
    [
      textValue(message.body),
      textValue(message.processed_text),
      textValue(message.transcription)
        ? `[Transcripción de nota de voz]\n${textValue(message.transcription)}`
        : "",
    ].map((item) => item.trim()),
  );

  if (segments.length > 0) {
    return segments.join("\n\n");
  }

  return `[${textValue(message.type) || "text"}]`;
}

function buildParsedExport(args: {
  messages: MessageRow[];
  assets: AssetRow[];
  ownerAlias: string;
  contactName: string;
}) {
  const firstAssetByMessageId = new Map<string, string>();

  for (const asset of args.assets) {
    if (!asset.message_id || firstAssetByMessageId.has(asset.message_id)) continue;
    const filename = textValue(asset.original_filename);
    if (filename) {
      firstAssetByMessageId.set(asset.message_id, filename);
    }
  }

  const parsedMessages: ParsedWhatsAppMessage[] = args.messages.map((message, index) => ({
    index,
    sender:
      message.direction === "outbound"
        ? args.ownerAlias
        : textValue(message.sender_name) || args.contactName,
    body: buildMessageBody(message),
    timestamp: message.created_at,
    attachmentFilename: firstAssetByMessageId.get(message.id) ?? null,
    isSystem: message.type === "system",
  }));

  return {
    messages: parsedMessages,
    participants: uniqueStrings(
      parsedMessages
        .map((message) => message.sender)
        .filter((sender): sender is string => Boolean(sender)),
    ),
    firstMessageAt: parsedMessages[0]?.timestamp ?? null,
    lastMessageAt: parsedMessages.at(-1)?.timestamp ?? null,
  } satisfies ParsedWhatsAppExport;
}

function isPdfAsset(asset: AssetRow) {
  const filename = textValue(asset.original_filename).toLowerCase();
  const mimeType = textValue(asset.mime_type).toLowerCase();
  return asset.category === "document" && (filename.endsWith(".pdf") || mimeType === "application/pdf");
}

function parseImageAnalysis(value: unknown): StoredImageAnalysis | null {
  if (!isRecord(value)) return null;
  const summary = textValue(value.summary);
  const detectedText = textValue(value.detected_text);
  if (!summary && !detectedText) return null;
  return {
    summary: summary || null,
    detected_text: detectedText || null,
    confidence: confidenceValue(value.confidence),
  };
}

function parsePdfAnalysis(value: unknown): StoredPdfAnalysis | null {
  if (!isRecord(value)) return null;
  const summary = textValue(value.summary);
  const detectedText = textValue(value.detected_text);
  if (!summary && !detectedText) return null;
  return {
    summary: summary || null,
    detected_text: detectedText || null,
    confidence: confidenceValue(value.confidence),
  };
}

function assetFilename(asset: AssetRow) {
  return textValue(asset.original_filename) || asset.id;
}

function buildCommercialAnalysisOutput(analysis: CommercialChatAnalysis): LeadCommercialAnalysisOutput {
  return {
    what_sells: analysis.whatSells,
    main_problem: analysis.mainProblem,
    main_goal: analysis.mainGoal,
    requested_features: analysis.requestedFeatures,
    lead_score: analysis.leadScore,
    intention_level: analysis.intentionLevel,
    suggested_price: analysis.suggestedPrice,
    currency: analysis.currency,
    confidence: analysis.confidence,
    reasons: analysis.reasons,
  };
}

export function buildLeadAnalysis(args: BuildLeadAnalysisArgs): BuiltLeadAnalysis {
  const fallbackOwnerAlias =
    textValue(args.userDisplayName) ||
    textValue(args.userEmail).split("@")[0] ||
    "Asesor";
  const ownerAlias = inferOwnerAlias(args.messages, fallbackOwnerAlias);
  const contactName =
    textValue(args.contact?.full_name) || textValue(args.contact?.phone) || "Cliente";
  const parsed = buildParsedExport({
    messages: args.messages,
    assets: args.assets,
    ownerAlias,
    contactName,
  });

  const commercialAnalysis = analyzeWhatsAppCommercially({
    parsed,
    ownerAlias,
    businessName: textValue(args.business?.name),
    projectType: textValue(args.lead.project_type) || "por_definir",
  });

  const imageAnalyses: AssetEvidence[] = [];
  const pdfAnalyses: AssetEvidence[] = [];
  const audioEvidence: AssetEvidence[] = [];
  const pendingAssets: PendingAsset[] = [];
  let analyzedAssetCount = 0;
  let audioCount = 0;
  let imageCount = 0;
  let pdfCount = 0;

  for (const asset of args.assets) {
    const metadata = isRecord(asset.metadata) ? asset.metadata : {};
    const extractedText = textValue(asset.extracted_text);
    const transcription = textValue(asset.transcription);
    const filename = assetFilename(asset);

    if (asset.category === "audio") {
      audioCount += 1;
      if (transcription) {
        analyzedAssetCount += 1;
        audioEvidence.push({
          asset_id: asset.id,
          message_id: asset.message_id,
          filename,
          type: "audio",
          summary: summarizeText(transcription),
          confidence: null,
          stored_in_asset_metadata: false,
          stored_in_asset_transcription: true,
          stored_in_asset_extracted_text: false,
        });
      } else {
        pendingAssets.push({ asset_id: asset.id, filename, type: "audio" });
      }
      continue;
    }

    if (asset.category === "image") {
      imageCount += 1;
      const imageAnalysis = parseImageAnalysis(metadata.image_analysis);
      if (imageAnalysis || extractedText) {
        analyzedAssetCount += 1;
        imageAnalyses.push({
          asset_id: asset.id,
          message_id: asset.message_id,
          filename,
          type: "image",
          summary: summarizeText(
            imageAnalysis?.summary || imageAnalysis?.detected_text || extractedText,
          ),
          confidence: imageAnalysis?.confidence ?? null,
          stored_in_asset_metadata: Boolean(imageAnalysis),
          stored_in_asset_transcription: false,
          stored_in_asset_extracted_text: Boolean(extractedText),
        });
      } else {
        pendingAssets.push({ asset_id: asset.id, filename, type: "image" });
      }
      continue;
    }

    if (isPdfAsset(asset)) {
      pdfCount += 1;
      const pdfAnalysis = parsePdfAnalysis(metadata.pdf_analysis);
      if (pdfAnalysis || extractedText) {
        analyzedAssetCount += 1;
        pdfAnalyses.push({
          asset_id: asset.id,
          message_id: asset.message_id,
          filename,
          type: "pdf",
          summary: summarizeText(
            pdfAnalysis?.summary || pdfAnalysis?.detected_text || extractedText,
          ),
          confidence: pdfAnalysis?.confidence ?? null,
          stored_in_asset_metadata: Boolean(pdfAnalysis),
          stored_in_asset_transcription: false,
          stored_in_asset_extracted_text: Boolean(extractedText),
        });
      } else {
        pendingAssets.push({ asset_id: asset.id, filename, type: "pdf" });
      }
    }
  }

  const recentPayments = [...args.payments]
    .sort((a, b) => {
      const left = a.paid_at ?? a.created_at;
      const right = b.paid_at ?? b.created_at;
      return right.localeCompare(left);
    })
    .slice(0, 5)
    .map((payment) => ({
      id: payment.id,
      type: payment.type,
      status: payment.status,
      amount: numberValue(payment.amount),
      currency: payment.currency,
      paid_at: payment.paid_at,
    }));

  const openTasks = args.tasks
    .filter((task) => task.status !== "done" && task.status !== "completed")
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      due_at: task.due_at,
    }));

  const upcomingMeetings = [...args.meetings]
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))
    .slice(0, 5)
    .map((meeting) => ({
      id: meeting.id,
      type: meeting.type,
      title: meeting.title,
      status: meeting.status,
      starts_at: meeting.starts_at,
      has_meeting_url: Boolean(textValue(meeting.meeting_url)),
    }));

  return {
    ownerAlias,
    parsed,
    input: {
      schema_version: "lead_full_analysis_v1",
      source: "lead_profile_manual_analysis",
      message_count: parsed.messages.length,
      audio_count: audioCount,
      image_count: imageCount,
      pdf_count: pdfCount,
      analyzed_asset_count: analyzedAssetCount,
      pending_asset_count: pendingAssets.length,
    },
    output: {
      schema_version: "lead_full_analysis_v1",
      commercial_analysis: buildCommercialAnalysisOutput(commercialAnalysis),
      image_analyses: imageAnalyses,
      pdf_analyses: pdfAnalyses,
      audio_evidence: audioEvidence,
      post_payment_context: {
        payment_count: args.payments.length,
        confirmed_payment_count: args.payments.filter((payment) => payment.status === "confirmed")
          .length,
        recent_payments: recentPayments,
        task_count: args.tasks.length,
        open_task_count: openTasks.length,
        open_tasks: openTasks,
        meeting_count: args.meetings.length,
        upcoming_meetings: upcomingMeetings,
      },
      pending_assets: pendingAssets,
      previous_analysis_run_id: args.previousAnalysisRun?.id ?? null,
    },
  };
}
