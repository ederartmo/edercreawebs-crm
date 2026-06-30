import type { ParsedWhatsAppExport } from "./parse-export";

export type PaymentProofInsight = {
  filename: string;
  amount: number;
  currency: "MXN" | "USD";
  bankName: string;
  beneficiary: string;
  reference: string;
  confidence: "alta" | "media" | "baja";
  messageIndex: number | null;
};

export type PostPaymentInference = {
  paymentProofs: PaymentProofInsight[];
  hasPaymentProof: boolean;
  paymentConfirmed: boolean;
  confirmationMessage: string;
  depositAmount: number | null;
  currency: "MXN" | "USD";
  estimatedBalance: number | null;
  onboardingDate: string | null;
  onboardingDateLabel: string;
  onboardingHasExactTime: boolean;
  meetingUrl: string;
  recommendedStatus: "onboarding" | "anticipo_recibido" | null;
  taskSuggestions: Array<{
    key: string;
    title: string;
    description: string;
    type: string;
    priority: "high" | "normal";
    dueAt: string | null;
  }>;
  reasons: string[];
};

type ImageAnalysisLike = {
  is_payment_proof?: boolean;
  amount?: number | null;
  currency?: "MXN" | "USD" | null;
  bank_name?: string;
  beneficiary?: string;
  reference?: string;
  confidence?: "alta" | "media" | "baja";
};

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function atLocalTime(value: Date, hour: number, minute = 0) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    hour,
    minute,
    0,
    0,
  );
}

function parseClock(text: string) {
  const match = text.match(
    /(?:^|\s)(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?(?:\s|$)/i,
  );
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = normalize(match[3] ?? "").replace(/[^apm]/g, "");

  if (meridiem.startsWith("p") && hour < 12) hour += 12;
  if (meridiem.startsWith("a") && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  return { hour, minute };
}

function chooseYear(day: number, month: number, explicitYear: number | null, reference: Date) {
  if (explicitYear) return explicitYear < 100 ? 2000 + explicitYear : explicitYear;

  let year = reference.getFullYear();
  const candidate = new Date(year, month, day);
  const referenceDay = startOfDay(reference);

  if (candidate.getTime() < addDays(referenceDay, -45).getTime()) {
    year += 1;
  }

  return year;
}

function parseMeetingDate(text: string, referenceIso: string) {
  const reference = new Date(referenceIso);
  if (Number.isNaN(reference.getTime())) return null;

  const normalized = normalize(text);
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  const numeric = normalized.match(
    /(?:^|\D)(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?(?:\D|$)/,
  );
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]) - 1;
    year = numeric[3] ? Number(numeric[3]) : null;
  }

  if (day === null || month === null) {
    const written = normalized.match(
      /(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)?\s*,?\s*(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{2,4}))?/,
    );
    if (written) {
      day = Number(written[1]);
      month = MONTHS[written[2]];
      year = written[3] ? Number(written[3]) : null;
    }
  }

  if (day === null || month === null || month < 0 || month > 11) return null;

  const resolvedYear = chooseYear(day, month, year, reference);
  const clock = parseClock(text);
  const date = new Date(
    resolvedYear,
    month,
    day,
    clock?.hour ?? 9,
    clock?.minute ?? 0,
    0,
    0,
  );

  if (Number.isNaN(date.getTime())) return null;

  return {
    date,
    hasExactTime: Boolean(clock),
  };
}

function findOnboarding(parsed: ParsedWhatsAppExport) {
  const candidates = parsed.messages.filter((message) => {
    const text = normalize(message.body);
    return (
      /onboarding|kickoff|reunion\s+de\s+arranque|reunion\s+inicial|fecha\s+de\s+inicio|fecha\s+en\s+que\s+vamos\s+a\s+iniciar|videollamada/.test(
        text,
      ) || /meet\.google\.com/.test(text)
    );
  });

  for (const message of [...candidates].reverse()) {
    const parsedDate = parseMeetingDate(message.body, message.timestamp);
    if (parsedDate) {
      const meetingUrl =
        message.body.match(/https?:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0] ?? "";
      return {
        date: parsedDate.date,
        hasExactTime: parsedDate.hasExactTime,
        meetingUrl,
        source: message.body,
      };
    }
  }

  const meetingUrl =
    parsed.messages
      .map((message) => message.body)
      .join("\n")
      .match(/https?:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0] ?? "";

  return {
    date: null,
    hasExactTime: false,
    meetingUrl,
    source: "",
  };
}

function findPaymentConfirmation(
  parsed: ParsedWhatsAppExport,
  ownerAlias: string,
  firstProofIndex: number | null,
) {
  const owner = normalize(ownerAlias);
  const confirmationRegex =
    /(confirmo\s+de\s+recibido|confirmo\s+recibido|pago\s+confirmado|anticipo\s+confirmado|excelente,?\s+confirmo|ya\s+me\s+aparece|ya\s+quedo\s+recibido|recibido,?\s+gracias)/i;

  const candidates = parsed.messages.filter((message) => {
    if (message.isSystem || !message.sender) return false;
    if (normalize(message.sender) !== owner) return false;
    if (firstProofIndex !== null && message.index < firstProofIndex) return false;
    return confirmationRegex.test(message.body);
  });

  return candidates[0]?.body ?? "";
}

function formatDateLabel(value: Date, hasExactTime: boolean) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    ...(hasExactTime ? { timeStyle: "short" as const } : {}),
  }).format(value);
}

function nextBusinessMorning(referenceIso: string | null) {
  const reference = referenceIso ? new Date(referenceIso) : new Date();
  let next = addDays(startOfDay(reference), 1);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next = addDays(next, 1);
  }
  return atLocalTime(next, 10).toISOString();
}

export function inferPostPaymentWorkflow(args: {
  parsed: ParsedWhatsAppExport;
  ownerAlias: string;
  imageAnalyses: Record<string, ImageAnalysisLike>;
  suggestedPrice: number | null;
  fallbackCurrency: "MXN" | "USD";
}): PostPaymentInference {
  const proofCandidates: PaymentProofInsight[] = [];
  const seen = new Set<string>();

  for (const [filename, analysis] of Object.entries(args.imageAnalyses)) {
    if (!analysis.is_payment_proof || typeof analysis.amount !== "number") continue;
    if (!Number.isFinite(analysis.amount) || analysis.amount <= 0) continue;

    const message = args.parsed.messages.find(
      (item) => item.attachmentFilename?.toLowerCase() === filename.toLowerCase(),
    );
    const currency = analysis.currency || args.fallbackCurrency;
    const dedupeKey = `${analysis.reference || "sin-ref"}:${analysis.amount}:${currency}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    proofCandidates.push({
      filename,
      amount: analysis.amount,
      currency,
      bankName: analysis.bank_name || "",
      beneficiary: analysis.beneficiary || "",
      reference: analysis.reference || "",
      confidence: analysis.confidence || "media",
      messageIndex: message?.index ?? null,
    });
  }

  proofCandidates.sort(
    (a, b) => (a.messageIndex ?? Number.MAX_SAFE_INTEGER) - (b.messageIndex ?? Number.MAX_SAFE_INTEGER),
  );

  const firstProofIndex = proofCandidates[0]?.messageIndex ?? null;
  const confirmationMessage = findPaymentConfirmation(
    args.parsed,
    args.ownerAlias,
    firstProofIndex,
  );
  const paymentConfirmed = Boolean(confirmationMessage);
  const onboarding = findOnboarding(args.parsed);
  const deposit = proofCandidates[0] ?? null;
  const depositAmount = deposit?.amount ?? null;
  const currency = deposit?.currency ?? args.fallbackCurrency;
  const estimatedBalance =
    depositAmount !== null &&
    args.suggestedPrice !== null &&
    args.suggestedPrice > depositAmount &&
    currency === args.fallbackCurrency
      ? args.suggestedPrice - depositAmount
      : null;

  const recommendedStatus =
    paymentConfirmed && onboarding.date
      ? "onboarding"
      : paymentConfirmed
        ? "anticipo_recibido"
        : null;

  const tasks: PostPaymentInference["taskSuggestions"] = [];
  const lastMessage = args.parsed.lastMessageAt;
  const nextMorning = nextBusinessMorning(lastMessage);

  if (proofCandidates.length > 0 && !paymentConfirmed) {
    tasks.push({
      key: "postpayment-review-proof",
      title: "Revisar comprobante y confirmar anticipo",
      description:
        "Se detectó un comprobante en las imágenes, pero no una confirmación explícita de recibido.",
      type: "pago",
      priority: "high",
      dueAt: nextMorning,
    });
  }

  if (paymentConfirmed) {
    tasks.push({
      key: "postpayment-request-content",
      title: "Solicitar información y materiales del proyecto",
      description:
        "El anticipo fue confirmado. Enviar o revisar la carpeta de contenido, accesos, textos, imágenes y datos pendientes.",
      type: "onboarding",
      priority: "high",
      dueAt: nextMorning,
    });

    tasks.push({
      key: "postpayment-confirm-scope-balance",
      title: "Confirmar alcance, saldo y fecha de entrega",
      description:
        estimatedBalance !== null
          ? `Saldo provisional detectado: ${currency} ${estimatedBalance.toLocaleString("es-MX")}. Confirmar contra la cotización final.`
          : "Confirmar el alcance contratado, el saldo pendiente y desde qué fecha comienza el plazo de entrega.",
      type: "onboarding",
      priority: "normal",
      dueAt: nextMorning,
    });

    if (onboarding.date) {
      const prepDay = atLocalTime(addDays(startOfDay(onboarding.date), -1), 10);
      tasks.push({
        key: "postpayment-prepare-onboarding",
        title: onboarding.hasExactTime
          ? "Preparar reunión de onboarding"
          : "Confirmar hora y preparar onboarding",
        description: `${formatDateLabel(onboarding.date, onboarding.hasExactTime)}${
          onboarding.meetingUrl ? ` · ${onboarding.meetingUrl}` : ""
        }`,
        type: "reunion",
        priority: "high",
        dueAt: prepDay.toISOString(),
      });
    } else {
      tasks.push({
        key: "postpayment-schedule-onboarding",
        title: "Agendar reunión de onboarding",
        description:
          "El anticipo fue confirmado, pero no se encontró una fecha clara de reunión inicial.",
        type: "reunion",
        priority: "high",
        dueAt: nextMorning,
      });
    }
  }

  const reasons: string[] = [];
  if (deposit) {
    reasons.push(
      `Detecté un comprobante por ${deposit.currency} ${deposit.amount.toLocaleString("es-MX")}.`,
    );
  }
  if (paymentConfirmed) {
    reasons.push(`Encontré confirmación de recibido: “${confirmationMessage}”.`);
  } else if (proofCandidates.length > 0) {
    reasons.push("Hay comprobante, pero falta confirmar que el pago fue recibido.");
  }
  if (onboarding.date) {
    reasons.push(
      `Detecté onboarding para ${formatDateLabel(onboarding.date, onboarding.hasExactTime)}.`,
    );
  }
  if (onboarding.meetingUrl) reasons.push("Encontré un enlace de Google Meet.");

  return {
    paymentProofs: proofCandidates,
    hasPaymentProof: proofCandidates.length > 0,
    paymentConfirmed,
    confirmationMessage,
    depositAmount,
    currency,
    estimatedBalance,
    onboardingDate: onboarding.date?.toISOString() ?? null,
    onboardingDateLabel: onboarding.date
      ? formatDateLabel(onboarding.date, onboarding.hasExactTime)
      : "",
    onboardingHasExactTime: onboarding.hasExactTime,
    meetingUrl: onboarding.meetingUrl,
    recommendedStatus,
    taskSuggestions: tasks,
    reasons,
  };
}
