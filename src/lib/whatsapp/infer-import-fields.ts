import { guessPhone, type ParsedWhatsAppExport } from "./parse-export";

export type ImportFieldInference = {
  ownerAlias: string;
  contactName: string;
  phone: string;
  businessName: string;
  status: string;
  projectType: string;
  confidence: "alta" | "media" | "baja";
  reasons: string[];
};

const GENERIC_SOCIAL_HANDLES = new Set([
  "home",
  "inicio",
  "profile",
  "pages",
  "share",
  "watch",
  "reel",
  "reels",
]);

const GENERIC_DOMAIN_PARTS = new Set([
  "facebook",
  "instagram",
  "tiktok",
  "whatsapp",
  "wa",
  "google",
  "youtube",
  "youtu",
  "linkedin",
  "x",
  "twitter",
  "drive",
  "docs",
  "meet",
  "canva",
  "hostinger",
  "hostingersite",
]);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function titleFromSlug(value: string) {
  const cleaned = decodeURIComponent(value)
    .replace(/^@/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  return cleaned
    .split(" ")
    .map((part) =>
      part.length <= 3 && /^[a-z]+$/i.test(part)
        ? part.toUpperCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(" ");
}

function phoneFromFilename(filename: string) {
  const match = filename.match(/(?:\+?\d[\d\s().-]{8,}\d)/);
  return guessPhone(match?.[0] ?? null);
}

function detectOwnerAlias(participants: string[], fallback: string) {
  const exact = participants.find((participant) =>
    ["edercreawebs", "eder crea webs", "eder arteaga", "eder"].includes(
      normalize(participant).replace(/[^a-z ]/g, "").trim(),
    ),
  );

  const containingEder = participants.find((participant) =>
    normalize(participant).includes("eder"),
  );

  return exact ?? containingEder ?? fallback;
}

function findUrls(text: string) {
  return text.match(/https?:\/\/[^\s<>]+/gi) ?? [];
}

function stripUrlPunctuation(value: string) {
  return value.replace(/[),.;!?]+$/g, "");
}

function brandCandidateFromUrl(rawUrl: string) {
  try {
    const url = new URL(stripUrlPunctuation(rawUrl));
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (
      hostname.includes("drive.google") ||
      hostname.includes("docs.google") ||
      hostname.includes("meet.google") ||
      hostname.includes("canva.") ||
      hostname.includes("hostingersite")
    ) {
      return null;
    }

    if (hostname.includes("instagram.com")) {
      const handle = pathParts[0];
      if (handle && !GENERIC_SOCIAL_HANDLES.has(handle.toLowerCase())) {
        return { name: titleFromSlug(handle), score: 6 };
      }
    }

    if (hostname.includes("tiktok.com")) {
      const handle = pathParts.find((part) => part.startsWith("@"));
      if (handle) return { name: titleFromSlug(handle), score: 6 };
    }

    if (hostname.includes("facebook.com")) {
      const handle = pathParts.find(
        (part) => !GENERIC_SOCIAL_HANDLES.has(part.toLowerCase()),
      );
      if (handle && !/^profile\.php$/i.test(handle)) {
        return { name: titleFromSlug(handle), score: 6 };
      }
    }

    const domainRoot = hostname.split(".")[0];
    if (domainRoot && !GENERIC_DOMAIN_PARTS.has(domainRoot)) {
      return { name: titleFromSlug(domainRoot), score: 3 };
    }
  } catch {
    return null;
  }

  return null;
}

function bestBrandFromUrls(urls: string[], text: string) {
  const candidates = new Map<string, { name: string; score: number }>();
  const normalizedText = normalize(text);

  for (const url of urls) {
    const candidate = brandCandidateFromUrl(url);
    if (!candidate?.name) continue;

    const key = normalize(candidate.name).replace(/[^a-z0-9]/g, "");
    if (!key) continue;

    const occurrences = normalizedText.split(normalize(candidate.name)).length - 1;
    const existing = candidates.get(key);
    const score = candidate.score + Math.min(occurrences, 5);

    if (!existing || score > existing.score) {
      candidates.set(key, { name: candidate.name, score });
    }
  }

  return Array.from(candidates.values()).sort((a, b) => b.score - a.score)[0]?.name ?? "";
}

function businessFromMediaNames(mediaNames: string[]) {
  const ignored = new Set([
    "img", "vid", "ptt", "aud", "stk", "wa", "audio", "video", "documento",
    "archivo", "reference", "references", "screen", "screens", "presentacion",
    "presentación", "cliente", "cotizacion", "cotización", "webapp", "comprimido",
    "servicios", "productos", "apoyo", "black", "pdf", "zip", "jpg", "jpeg",
    "png", "opus", "mp4", "wa0001", "wa0002", "wa0003", "wa0004", "wa0005",
  ]);

  const candidates = new Map<string, { name: string; score: number }>();

  for (const filename of mediaNames) {
    const basename = filename.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    if (/^(img|vid|ptt|aud|stk|doc)[-_]?\d/i.test(basename)) continue;

    const parts = basename
      .replace(/[-_]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((part) => !/^\d+$/.test(part))
      .filter((part) => !/^(wa)?\d{4,}$/i.test(part))
      .filter((part) => !ignored.has(normalize(part)));

    if (parts.length < 2) continue;

    const name = titleFromSlug(parts.slice(0, 4).join(" "));
    const key = normalize(name).replace(/[^a-z0-9]/g, "");
    if (!key) continue;

    const existing = candidates.get(key);
    const score = 3 + parts.length;
    if (!existing || score > existing.score) {
      candidates.set(key, { name, score });
    }
  }

  return Array.from(candidates.values()).sort((a, b) => b.score - a.score)[0]?.name ?? "";
}

function explicitBusinessName(text: string) {
  const patterns = [
    /(?:mi negocio|mi empresa|mi marca)\s+(?:se llama|es)\s*[:\-]?\s*([^\n,.!?]{2,60})/i,
    /(?:el negocio|la empresa|la marca)\s+(?:se llama|es)\s*[:\-]?\s*([^\n,.!?]{2,60})/i,
    /nombre\s+(?:del negocio|de la empresa|de la marca)\s*[:\-]?\s*([^\n,.!?]{2,60})/i,
    /(?:estoy|estamos)\s+como\s+([^\n,.!?]{2,60})/i,
    /videollamada\s*\|\s*([^\n,.!?]{2,60})/i,
    /\b([A-Z][A-Z0-9 .&-]{1,40}S\.?\s*A\.?\s*(?:DE\s*)?C\.?\s*V\.?)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function businessCategoryFromLeadTemplate(text: string) {
  const match = text.match(
    /sistema\s+web\s+para\s*:\s*([^,\n.]+?)(?=,\s*enfocado|\.\s*Contexto|\n|$)/i,
  );
  return match?.[1]?.trim() ?? "";
}

function scoreKeywords(text: string, keywords: string[]) {
  const normalizedText = normalize(text);

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalize(keyword);

    if (normalizedKeyword.includes(" ")) {
      return score + (normalizedText.includes(normalizedKeyword) ? 1 : 0);
    }

    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    return score + (regex.test(normalizedText) ? 1 : 0);
  }, 0);
}

function inferProjectType(text: string) {
  const courseScore = scoreKeywords(text, [
    "curso",
    "cursos",
    "e-book",
    "ebook",
    "módulo",
    "modulo",
    "alumno",
    "clase grabada",
    "área de alumno",
    "academia",
    "certificado",
  ]);

  const commerceScore = scoreKeywords(text, [
    "stripe",
    "pago en línea",
    "pago online",
    "cobro en línea",
    "checkout",
    "tienda en línea",
    "carrito",
    "reserva",
    "agendar",
    "citas",
    "login",
    "usuario",
    "panel admin",
    "administrador",
    "pedidos",
    "recompensas",
    "membresía",
  ]);

  const informativeScore = scoreKeywords(text, [
    "captar clientes",
    "formulario",
    "portafolio",
    "servicios",
    "catálogo",
    "catalogo",
    "contacto",
    "galería",
    "galeria",
    "presencia profesional",
  ]);

  const explicitCourseIntent = /(digitalizar|vender|subir|crear|plataforma|area|área).{0,30}(curso|cursos|clases)|(?:curso|cursos).{0,30}(digital|online|en linea|en línea|modulos|módulos|alumnos)/i.test(text);

  if (courseScore >= 2 || explicitCourseIntent) {
    return {
      value: "cursos_complejo",
      reason: `Detecté ${courseScore} señales de cursos y ${commerceScore} de cobro/usuarios.`,
    };
  }

  if (commerceScore >= 2) {
    return {
      value: "tienda_cobro_usuarios",
      reason: `Detecté ${commerceScore} señales de cobro, reservas o usuarios.`,
    };
  }

  if (informativeScore >= 1) {
    return {
      value: "informativa",
      reason: `Detecté ${informativeScore} señales de captación o presentación de servicios.`,
    };
  }

  return {
    value: "por_definir",
    reason: "No encontré funciones suficientes para clasificar el proyecto con seguridad.",
  };
}

function inferStatus(parsed: ParsedWhatsAppExport, ownerAlias: string) {
  const inbound = parsed.messages.filter(
    (message) =>
      !message.isSystem &&
      message.sender &&
      normalize(message.sender) !== normalize(ownerAlias),
  );
  const inboundText = inbound.map((message) => message.body).join("\n");
  const allText = parsed.messages.map((message) => message.body).join("\n");
  const normalizedInbound = normalize(inboundText);
  const normalizedAll = normalize(allText);
  const recentInboundText = inbound.slice(-30).map((message) => message.body).join("\n");

  if (/(solo\s+faltaria|solo\s+faltaría|revision\s+final|revisión\s+final|ultimos\s+cambios|últimos\s+cambios|ya\s+esta\s+publicada|ya\s+está\s+publicada)/i.test(recentInboundText)) {
    return {
      value: "revision",
      reason: "Los mensajes recientes indican revisión final o detalles pendientes.",
    };
  }

  if (/(como|cómo|cuanto|cuánto).{0,35}(va|falta).{0,35}(pagina|página|web|app|proyecto)|(?:pagina|página|web|app|proyecto).{0,35}(avance|desarrollo)/i.test(recentInboundText)) {
    return {
      value: "en_desarrollo",
      reason: "Los mensajes recientes indican que el proyecto ya está en desarrollo.",
    };
  }

  const paidPatterns = [
    "ya pague",
    "ya pagué",
    "hice el pago",
    "ya deposite",
    "ya deposité",
    "te transferi",
    "te transferí",
    "te envio el comprobante",
    "te envío el comprobante",
    "ya quedo el anticipo",
    "ya quedó el anticipo",
  ];

  if (paidPatterns.some((pattern) => normalizedInbound.includes(normalize(pattern)))) {
    return {
      value: "anticipo_recibido",
      reason: "El prospecto menciona que realizó un pago o envió comprobante.",
    };
  }

  const scheduledPayment =
    /(primer\s+50|anticipo|deposito|depósito)/i.test(inboundText) &&
    /(te\s+contacto|el\s+\d{1,2}\s+de|mañana|proxima\s+semana|próxima\s+semana)/i.test(
      inboundText,
    );

  if (scheduledPayment) {
    return {
      value: "anticipo_programado",
      reason: "El prospecto comprometió el anticipo para una fecha futura.",
    };
  }

  if (
    /(ya\s+no\s+me\s+interesa|no\s+voy\s+a\s+continuar|cancelamos|descartamos\s+el\s+proyecto)/i.test(
      inboundText,
    )
  ) {
    return {
      value: "perdido",
      reason: "El prospecto indicó explícitamente que no continuará.",
    };
  }

  if (
    /(darle\s+seguimiento|retomar|seguimos\s+en\s+contacto|como\s+va\s+la\s+propuesta|cómo\s+va\s+la\s+propuesta)/i.test(
      inboundText,
    )
  ) {
    return {
      value: "seguimiento",
      reason: "El prospecto retomó la conversación o pidió seguimiento.",
    };
  }

  if (
    /(cuanto\s+cuesta|cuánto\s+cuesta|cual\s+es\s+el\s+costo|cuál\s+es\s+el\s+costo|como\s+son\s+los\s+pagos|cómo\s+son\s+los\s+pagos|cotizacion|cotización)/i.test(
      inboundText,
    ) || /(\$|mxn|usd|50%)/i.test(normalizedAll)
  ) {
    return {
      value: "calificado",
      reason: "La conversación ya llegó a precio, pagos o cotización.",
    };
  }

  if (inbound.length >= 4) {
    return {
      value: "diagnostico",
      reason: "Ya existe conversación suficiente para considerar el diagnóstico iniciado.",
    };
  }

  return {
    value: "nuevo",
    reason: "El chat contiene pocas interacciones y todavía parece un lead nuevo.",
  };
}

export function inferWhatsAppImportFields(args: {
  parsed: ParsedWhatsAppExport;
  zipFilename: string;
  currentOwnerAlias: string;
  mediaNames?: string[];
}): ImportFieldInference {
  const { parsed, zipFilename, currentOwnerAlias, mediaNames = [] } = args;
  const reasons: string[] = [];
  const ownerAlias = detectOwnerAlias(parsed.participants, currentOwnerAlias);

  if (ownerAlias !== currentOwnerAlias) {
    reasons.push(`Detecté que tu nombre en el chat parece ser “${ownerAlias}”.`);
  }

  const contactName =
    parsed.participants.find(
      (participant) => normalize(participant) !== normalize(ownerAlias),
    ) ?? parsed.participants[0] ?? "";

  const detectedPhone = guessPhone(contactName) || phoneFromFilename(zipFilename);
  const provisionalPhone = `importado:${normalize(contactName || zipFilename)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "contacto"}`;
  const phone = detectedPhone || provisionalPhone;
  if (detectedPhone) {
    reasons.push(`Detecté el teléfono ${detectedPhone}.`);
  } else {
    reasons.push("El ZIP no incluye el teléfono; coloqué un identificador provisional para que puedas importarlo.");
  }

  const inboundText = parsed.messages
    .filter(
      (message) =>
        !message.isSystem &&
        message.sender &&
        normalize(message.sender) !== normalize(ownerAlias),
    )
    .map((message) => message.body)
    .join("\n");

  const allText = parsed.messages.map((message) => message.body).join("\n");
  const explicitName = explicitBusinessName(inboundText);
  const urls = findUrls(allText);
  const urlBrand = bestBrandFromUrls(urls, allText);
  const mediaBrand = businessFromMediaNames(mediaNames);
  const templateCategory = businessCategoryFromLeadTemplate(inboundText);
  const businessName = explicitName || urlBrand || mediaBrand || templateCategory;

  if (explicitName) {
    reasons.push(`Encontré el nombre del negocio escrito en la conversación: “${explicitName}”.`);
  } else if (urlBrand) {
    reasons.push(`Inferí el negocio desde una red o dominio compartido: “${urlBrand}”.`);
  } else if (mediaBrand) {
    reasons.push(`Inferí el negocio desde los nombres de archivos adjuntos: “${mediaBrand}”.`);
  } else if (templateCategory) {
    reasons.push(
      `Usé el giro del formulario inicial como nombre provisional: “${templateCategory}”.`,
    );
  }

  const project = inferProjectType(allText);
  reasons.push(project.reason);

  const status = inferStatus(parsed, ownerAlias);
  reasons.push(status.reason);

  const strongFields = [phone, businessName, project.value !== "por_definir", status.value !== "nuevo"].filter(
    Boolean,
  ).length;

  const confidence: ImportFieldInference["confidence"] =
    strongFields >= 4 ? "alta" : strongFields >= 2 ? "media" : "baja";

  return {
    ownerAlias,
    contactName,
    phone,
    businessName,
    status: status.value,
    projectType: project.value,
    confidence,
    reasons,
  };
}
