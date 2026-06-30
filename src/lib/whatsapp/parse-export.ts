export type ParsedWhatsAppMessage = {
  index: number;
  sender: string | null;
  body: string;
  timestamp: string;
  attachmentFilename: string | null;
  isSystem: boolean;
};

export type ParsedWhatsAppExport = {
  messages: ParsedWhatsAppMessage[];
  participants: string[];
  firstMessageAt: string | null;
  lastMessageAt: string | null;
};

const ATTACHMENT_PATTERN = /([^\\/\n]+?\.(?:jpe?g|png|webp|gif|heic|opus|ogg|mp3|m4a|wav|mp4|mov|mkv|pdf|docx?|xlsx?|pptx?|zip))/i;

function cleanInvisible(value: string) {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .trim();
}

function parseTime(datePart: string, timePart: string) {
  const [dayText, monthText, yearText] = datePart.split("/");
  const day = Number(dayText);
  const month = Number(monthText) - 1;
  const rawYear = Number(yearText);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  const normalized = timePart
    .toLowerCase()
    .replace(/[\u00a0\u202f\s]/g, "")
    .replace(/\./g, "");

  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) {
    throw new Error(`No pude interpretar la hora: ${timePart}`);
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  const meridiem = match[4];

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return new Date(year, month, day, hour, minute, second).toISOString();
}

function parsePrefix(line: string) {
  const cleaned = cleanInvisible(line);

  const bracketed = cleaned.match(
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)?)\]\s*(.*)$/i,
  );

  if (bracketed) {
    return {
      timestamp: parseTime(bracketed[1], bracketed[2]),
      content: bracketed[3],
    };
  }

  const dashed = cleaned.match(
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)?)\s+-\s+(.*)$/i,
  );

  if (!dashed) return null;

  return {
    timestamp: parseTime(dashed[1], dashed[2]),
    content: dashed[3],
  };
}

function splitSender(content: string) {
  const separator = content.indexOf(": ");
  if (separator === -1) {
    return { sender: null, body: content, isSystem: true };
  }

  return {
    sender: cleanInvisible(content.slice(0, separator)),
    body: content.slice(separator + 2).trim(),
    isSystem: false,
  };
}

function attachmentFromBody(body: string) {
  const match = cleanInvisible(body).match(ATTACHMENT_PATTERN);
  return match?.[1] ?? null;
}

export function parseWhatsAppExport(text: string): ParsedWhatsAppExport {
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalizedText.split("\n");
  const drafts: Array<{
    timestamp: string;
    sender: string | null;
    body: string;
    isSystem: boolean;
  }> = [];

  for (const rawLine of lines) {
    const parsedPrefix = parsePrefix(rawLine);

    if (parsedPrefix) {
      const split = splitSender(parsedPrefix.content);
      drafts.push({
        timestamp: parsedPrefix.timestamp,
        sender: split.sender,
        body: split.body,
        isSystem: split.isSystem,
      });
      continue;
    }

    if (drafts.length > 0) {
      drafts[drafts.length - 1].body += `\n${rawLine}`;
    }
  }

  const messages = drafts.map((draft, index) => ({
    index,
    sender: draft.sender,
    body: draft.body.trim(),
    timestamp: draft.timestamp,
    attachmentFilename: attachmentFromBody(draft.body),
    isSystem: draft.isSystem,
  }));

  const participants = Array.from(
    new Set(
      messages
        .map((message) => message.sender)
        .filter((sender): sender is string => Boolean(sender)),
    ),
  );

  return {
    messages,
    participants,
    firstMessageAt: messages[0]?.timestamp ?? null,
    lastMessageAt: messages.at(-1)?.timestamp ?? null,
  };
}

export function guessPhone(value: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? `+${digits}` : "";
}

export function inferMessageType(filename: string | null, body: string) {
  const extension = filename?.split(".").pop()?.toLowerCase();

  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(extension ?? "")) {
    return "image";
  }
  if (["opus", "ogg", "mp3", "m4a", "wav"].includes(extension ?? "")) {
    return "audio";
  }
  if (["mp4", "mov", "mkv"].includes(extension ?? "")) {
    return "video";
  }
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip"].includes(extension ?? "")) {
    return "document";
  }
  if (body.includes("<Multimedia omitido>")) return "unknown";
  return "text";
}
