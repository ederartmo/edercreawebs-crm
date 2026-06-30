import type { ParsedWhatsAppExport } from "./parse-export";

export type CommercialChatAnalysis = {
  whatSells: string;
  howSells: string;
  currentlySelling: boolean | null;
  runsAds: boolean | null;
  adPlatforms: string[];
  adDestination: string;
  mainProblem: string;
  mainGoal: string;
  requestedFeatures: string[];
  leadScore: number;
  intentionLevel: "baja" | "posible" | "buena" | "alta";
  suggestedPrice: number | null;
  currency: "MXN" | "USD";
  summary: string;
  confidence: "alta" | "media" | "baja";
  reasons: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clean(value?: string | null) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:,-]+|[\s:,-]+$/g, "")
    .trim();
}

function firstCapture(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function inboundText(parsed: ParsedWhatsAppExport, ownerAlias: string) {
  return parsed.messages
    .filter(
      (message) =>
        !message.isSystem &&
        message.sender &&
        normalize(message.sender) !== normalize(ownerAlias),
    )
    .map((message) => message.body)
    .join("\n");
}

function extractWhatSells(text: string, businessName: string) {
  const explicit = firstCapture(text, [
    /sistema\s+web\s+para\s*:\s*([^,\n.]+?)(?=,\s*enfocado|\.\s*contexto|\n|$)/i,
    /(?:que|qué)\s+vendes\s*[:\-]?\s*([^\n.]{3,120})/i,
    /(?:vendo|vendemos|ofrezco|ofrecemos|nos dedicamos a|somos una)\s+([^\n.]{3,120})/i,
    /(?:mi negocio|mi empresa)\s+(?:es|ofrece)\s+([^\n.]{3,120})/i,
  ]);

  return explicit || businessName || "";
}

function extractHowSells(text: string) {
  const explicit = firstCapture(text, [
    /contexto\s+actual\s*:\s*([^\n.]{2,140})/i,
    /(?:como|cómo)\s+lo\s+vendes\s+(?:actualmente)?\s*[:\-]?\s*([^\n.]{2,140})/i,
    /(?:vendo|vendemos)\s+(?:por|mediante|a través de)\s+([^\n.]{2,140})/i,
  ]);

  if (explicit) return explicit;

  const channels: string[] = [];
  const normalized = normalize(text);

  if (/\bwhatsapp\b/.test(normalized)) channels.push("WhatsApp");
  if (/\binstagram\b/.test(normalized)) channels.push("Instagram");
  if (/\bfacebook\b/.test(normalized)) channels.push("Facebook");
  if (/\btiktok\b/.test(normalized)) channels.push("TikTok");
  if (/\bviator\b/.test(normalized)) channels.push("Viator");
  if (/\bmercado\s*libre\b/.test(normalized)) channels.push("Mercado Libre");
  if (/\bamazon\b/.test(normalized)) channels.push("Amazon");
  if (/\btienda\s+fisica\b|\blocal\s+fisico\b|\bagencia\s+fisica\b/.test(normalized)) {
    channels.push("Punto físico");
  }
  if (/\brecomendacion(?:es)?\b|\bboca\s+a\s+boca\b/.test(normalized)) {
    channels.push("Recomendaciones");
  }
  if (/\bsitio\s+web\b|\bpagina\s+web\b|\bwix\b|\bshopify\b/.test(normalized)) {
    channels.push("Sitio web");
  }

  return unique(channels).join(", ");
}

function detectCurrentlySelling(text: string) {
  const normalized = normalize(text);

  if (
    hasAny(normalized, [
      /\barrancando\s+operaciones\b/,
      /\bapenas\s+(?:voy|vamos|estoy|estamos)\s+(?:a\s+)?empezar\b/,
      /\btodavia\s+no\s+vendo\b/,
      /\bno\s+he\s+vendido\b/,
      /\bsolo\s+es\s+una\s+idea\b/,
      /\baun\s+no\s+tengo\s+clientes\b/,
    ])
  ) {
    return false;
  }

  if (
    hasAny(normalized, [
      /\bclientes\b/,
      /\bventas\b/,
      /\bvendemos\b/,
      /\bvendo\b/,
      /\btienda\s+fisica\b/,
      /\bagencia\s+fisica\b/,
      /\bcurso\s+presencial\b/,
      /\btaller(?:es)?\s+presencial(?:es)?\b/,
      /\brecomendacion(?:es)?\b/,
      /\bboca\s+a\s+boca\b/,
      /\bpedidos\b/,
      /\breservas\b/,
      /\bme\s+escribian\s+clientes\b/,
    ])
  ) {
    return true;
  }

  return null;
}

function detectAds(text: string) {
  const normalized = normalize(text);

  if (
    hasAny(normalized, [
      /\bno\s+(?:hago|usamos|uso|invertimos|invierto)\s+(?:en\s+)?(?:anuncios|ads|publicidad)\b/,
      /\bsin\s+anuncios\b/,
    ])
  ) {
    return { runsAds: false as const, platforms: [] as string[] };
  }

  const platforms: string[] = [];
  if (/\bmeta\b|\bfacebook\s+ads\b|\binstagram\s+ads\b|\bcampanas?\s+de\s+facebook\b/.test(normalized)) {
    platforms.push("Meta");
  }
  if (/\bgoogle\s+ads\b|\badwords\b/.test(normalized)) platforms.push("Google");
  if (/\btiktok\s+ads\b/.test(normalized)) platforms.push("TikTok");

  const genericAds =
    /\banuncios\b|\bads\b|\bpauta\b|\bpublicidad\s+pagada\b|\bcampanas?\b/.test(
      normalized,
    );

  return {
    runsAds: platforms.length > 0 || genericAds ? true : null,
    platforms: unique(platforms),
  };
}

function detectAdDestination(text: string, runsAds: boolean | null) {
  if (!runsAds) return "";
  const normalized = normalize(text);

  if (/\banuncios?.{0,80}\bwhatsapp\b|\bwhatsapp\b.{0,80}\banuncios?\b/.test(normalized)) {
    return "WhatsApp";
  }
  if (/\banuncios?.{0,80}\bformulario\b|\bformulario\b.{0,80}\banuncios?\b/.test(normalized)) {
    return "Formulario";
  }
  if (/\banuncios?.{0,80}\btienda\b|\btienda\b.{0,80}\banuncios?\b/.test(normalized)) {
    return "Tienda";
  }
  if (/\banuncios?.{0,80}\bpagina\b|\blanding\b/.test(normalized)) {
    return "Página web";
  }

  return "";
}

function extractProblem(text: string) {
  const block = firstCapture(text, [
    /problemas?\s+que\s+quiero\s+resolver\s*:\s*([\s\S]{3,500}?)(?=\n\s*(?:pregunta|duda|me\s+gustaria|me\s+gustaría)|$)/i,
    /(?:lo\s+que\s+mas|lo\s+que\s+más)\s+se\s+me\s+complica\s+(?:es|hoy)?\s*[:\-]?\s*([^\n.]{3,180})/i,
    /(?:mi\s+problema|el\s+problema)\s+(?:es|actualmente\s+es)\s*[:\-]?\s*([^\n.]{3,180})/i,
  ]);

  if (block) {
    return clean(
      block
        .replace(/\s*,\s*/g, "; ")
        .replace(/\n+/g, "; "),
    );
  }

  const normalized = normalize(text);
  const candidates: Array<[RegExp, string]> = [
    [/todo\s+se\s+me\s+perdia|se\s+me\s+pierden\s+(?:los\s+)?(?:clientes|mensajes|leads)/, "Los prospectos y conversaciones se pierden en WhatsApp."],
    [/cobrar\s+se\s+volvio\s+mas\s+complicado|problemas?\s+para\s+cobrar/, "Cobrar y confirmar pagos es demasiado manual."],
    [/todo\s+dependia\s+de\s+mi|depende\s+de\s+mi/, "La operación depende demasiado de una sola persona."],
    [/no\s+tengo\s+tiempo|falta\s+de\s+tiempo/, "No tiene tiempo para construir o administrar el sistema por su cuenta."],
    [/no\s+se\s+conectar.*stripe|conectar.*stripe/, "No sabe cómo integrar Stripe y los pagos en línea."],
    [/no\s+me\s+esta\s+funcionando.*web|web\s+actual\s+no\s+funciona/, "La web actual no está generando los resultados esperados."],
    [/agenda\s+manual|agendar.*whatsapp|citas.*whatsapp/, "La agenda y las citas se administran manualmente."],
    [/no\s+se\s+de\s+donde\s+llegan|no\s+puedo\s+medir/, "No puede medir correctamente de dónde llegan los clientes."],
  ];

  return candidates.find(([pattern]) => pattern.test(normalized))?.[1] ?? "";
}

function extractGoal(text: string) {
  const explicit = firstCapture(text, [
    /enfocado\s+en\s*:\s*([^\n.]{2,180})/i,
    /(?:quiero|queremos|busco|buscamos)\s+(?:que\s+la\s+web\s+)?([^\n.]{3,180})/i,
    /objetivo\s*:\s*([^\n.]{3,180})/i,
  ]);

  return explicit;
}

function detectFeatures(text: string, projectType: string) {
  const normalized = normalize(text);
  const featuresDetected: string[] = [];
  const features: Array<[RegExp, string]> = [
    [/\bstripe\b|\bpago\s+en\s+linea\b|\bcobro\s+en\s+linea\b|\bcheckout\b/, "Pagos en línea"],
    [/\btienda\s+en\s+linea\b|\bcarrito\b|\be-?commerce\b/, "Tienda en línea"],
    [/\breserva(?:s)?\b|\bagenda\b|\bagendar\b|\bcitas\b/, "Agenda y reservas"],
    [/\blogin\b|\biniciar\s+sesion\b|\bcuenta\s+de\s+usuario\b/, "Login y cuentas de usuario"],
    [/\bpanel\s+(?:de\s+)?admin\b|\badministrador\b|\bdashboard\b/, "Panel de administración"],
    [/\bcurso(?:s)?\b|\bclases?\s+grabadas?\b|\bmodulos?\b/, "Cursos y módulos"],
    [/\be-?books?\b|\bpdfs?\s+descargables?\b/, "E-books y descargables"],
    [/\bprogreso\b|\bavance\s+del\s+curso\b/, "Progreso del alumno"],
    [/\bcertificado(?:s)?\b/, "Certificados"],
    [/\bbundle(?:s)?\b|\bpaquete(?:s)?\s+de\s+cursos\b/, "Bundles de cursos"],
    [/\brecompensas?\b|\bpuntos\b|\blealtad\b/, "Programa de recompensas"],
    [/\bformulario(?:s)?\b|\bcaptar\s+clientes\b/, "Formulario de captación"],
    [/\bwhatsapp\b/, "Integración con WhatsApp"],
    [/\bpixel\b|\bcapi\b|\bconversion\s+api\b|\bseguimiento\s+de\s+conversiones\b/, "Pixel y medición de conversiones"],
    [/\bcrm\b|\bseguimiento\s+de\s+leads\b/, "CRM y seguimiento"],
    [/\bseo\b|\bposicionamiento\b|\bblog\b/, "SEO y contenido"],
    [/\bportafolio\b|\bgaleria\b|\bproyectos\b/, "Portafolio o galería"],
    [/\bmapa\b|\bgoogle\s+maps\b|\bubicacion\b/, "Mapa y ubicación"],
    [/\bnotificaciones?\b|\bcorreo\s+automatico\b|\bemail\s+automatico\b/, "Notificaciones automáticas"],
    [/\bmembresia\b|\bsuscripcion\b/, "Membresía o suscripción"],
    [/\bcatalogo\b|\bservicios\b/, "Catálogo de servicios o productos"],
  ];

  for (const [pattern, label] of features) {
    if (pattern.test(normalized)) featuresDetected.push(label);
  }

  if (projectType === "informativa" && featuresDetected.length === 0) {
    featuresDetected.push("Hero", "Servicios", "Formulario de contacto", "WhatsApp");
  }
  if (projectType === "cursos_complejo") {
    featuresDetected.push("Área del alumno", "Cursos y módulos", "Pagos en línea");
  }

  return unique(featuresDetected);
}

function extractExplicitPrice(text: string) {
  const patterns = [
    /(?:seria|sería|costo|precio|inversion|inversión|cotizacion|cotización)[^\n]{0,45}?\$?\s*([\d,.]+)\s*(mil|k)?\s*(mxn|usd|dolares|dólares)?/gi,
    /\$?\s*([\d,.]+)\s*(mil|k)?\s*(mxn|usd|dolares|dólares)\b/gi,
  ];

  const results: Array<{ amount: number; currency: "MXN" | "USD" }> = [];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      let amount = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(amount)) continue;
      if (match[2]) amount *= 1000;
      if (amount < 500) continue;

      const currencyText = normalize(match[3] ?? "");
      const currency = /usd|dolar/.test(currencyText) ? "USD" : "MXN";
      results.push({ amount, currency });
    }
  }

  return results.at(-1) ?? null;
}

function suggestedPriceFromRules(projectType: string, features: string[]) {
  if (projectType === "informativa") return 10000;
  if (projectType === "cursos_complejo") return 20000;
  if (projectType === "tienda_cobro_usuarios") {
    const complex = features.filter((feature) =>
      [
        "Login y cuentas de usuario",
        "Panel de administración",
        "Agenda y reservas",
        "Programa de recompensas",
        "Membresía o suscripción",
        "CRM y seguimiento",
      ].includes(feature),
    ).length;
    return complex >= 2 ? 17000 : 15000;
  }
  return null;
}

function computeLeadScore(args: {
  currentlySelling: boolean | null;
  runsAds: boolean | null;
  hasSocialUrls: boolean;
  mainProblem: string;
  text: string;
}) {
  let score = 0;
  const normalized = normalize(args.text);

  if (args.currentlySelling === true) score += 3;
  if (args.currentlySelling === false) score -= 3;
  if (args.runsAds === true) score += 3;
  if (args.hasSocialUrls) score += 1;
  if (args.mainProblem) score += 2;

  if (
    /\b(?:quiero|queremos)\s+(?:iniciar|empezar|arrancar)\b|\bcuando\s+podemos\s+iniciar\b|\besta\s+semana\b|\beste\s+mes\b|\bel\s+\d{1,2}\s+de\b/.test(
      normalized,
    )
  ) {
    score += 3;
  }

  if (
    /\bcomo\s+son\s+los\s+pagos\b|\bcuanto\s+cuesta\b|\bcual\s+es\s+el\s+costo\b|\bme\s+parece\s+perfecto\b|\bsi\s+la\s+quiero\b|\bhago\s+el\s+pago\b/.test(
      normalized,
    )
  ) {
    score += 2;
  }

  if (/\barrancando\s+operaciones\b|\bsolo\s+es\s+una\s+idea\b/.test(normalized)) {
    score -= 2;
  }

  if (/\bpagar\s+todo\s+al\s+final\b|\bcubrir.*al\s+finalizar\b/.test(normalized)) {
    score -= 1;
  }

  return Math.max(0, Math.min(15, score));
}

function intentionFromScore(score: number): CommercialChatAnalysis["intentionLevel"] {
  if (score >= 10) return "alta";
  if (score >= 7) return "buena";
  if (score >= 3) return "posible";
  return "baja";
}

function buildSummary(args: {
  businessName: string;
  whatSells: string;
  howSells: string;
  currentlySelling: boolean | null;
  runsAds: boolean | null;
  mainProblem: string;
  mainGoal: string;
  projectType: string;
  requestedFeatures: string[];
}) {
  const subject = args.businessName || "El prospecto";
  const parts: string[] = [];

  if (args.whatSells) parts.push(`${subject} ofrece ${args.whatSells}.`);
  if (args.howSells) parts.push(`Actualmente vende mediante ${args.howSells}.`);
  if (args.currentlySelling === false) parts.push("El negocio todavía no ha validado ventas.");
  if (args.runsAds === true) parts.push("Ya invierte en publicidad digital.");
  if (args.runsAds === false) parts.push("No reporta inversión actual en anuncios.");
  if (args.mainProblem) parts.push(`Problema principal: ${args.mainProblem}`);
  if (args.mainGoal) parts.push(`Objetivo: ${args.mainGoal}`);
  if (args.requestedFeatures.length > 0) {
    parts.push(`Funciones detectadas: ${args.requestedFeatures.slice(0, 6).join(", ")}.`);
  }
  if (args.projectType && args.projectType !== "por_definir") {
    parts.push(`Tipo de proyecto sugerido: ${args.projectType.replaceAll("_", " ")}.`);
  }

  return parts.join(" ");
}

export function analyzeWhatsAppCommercially(args: {
  parsed: ParsedWhatsAppExport;
  ownerAlias: string;
  businessName: string;
  projectType: string;
}): CommercialChatAnalysis {
  const inbound = inboundText(args.parsed, args.ownerAlias);
  const allText = args.parsed.messages.map((message) => message.body).join("\n");
  const urls = allText.match(/https?:\/\/[^\s<>]+/gi) ?? [];

  const whatSells = extractWhatSells(inbound, args.businessName);
  const howSells = extractHowSells(inbound);
  const currentlySelling = detectCurrentlySelling(inbound);
  const ads = detectAds(inbound);
  const adDestination = detectAdDestination(inbound, ads.runsAds);
  const mainProblem = extractProblem(inbound);
  const mainGoal = extractGoal(inbound);
  const requestedFeatures = detectFeatures(allText, args.projectType);
  const explicitPrice = extractExplicitPrice(allText);
  const suggestedPrice =
    explicitPrice?.amount ?? suggestedPriceFromRules(args.projectType, requestedFeatures);
  const currency = explicitPrice?.currency ?? "MXN";
  const leadScore = computeLeadScore({
    currentlySelling,
    runsAds: ads.runsAds,
    hasSocialUrls: urls.length > 0,
    mainProblem,
    text: inbound,
  });
  const intentionLevel = intentionFromScore(leadScore);
  const summary = buildSummary({
    businessName: args.businessName,
    whatSells,
    howSells,
    currentlySelling,
    runsAds: ads.runsAds,
    mainProblem,
    mainGoal,
    projectType: args.projectType,
    requestedFeatures,
  });

  const populated = [
    whatSells,
    howSells,
    currentlySelling !== null,
    ads.runsAds !== null,
    mainProblem,
    mainGoal,
    requestedFeatures.length > 0,
    suggestedPrice !== null,
  ].filter(Boolean).length;

  const confidence: CommercialChatAnalysis["confidence"] =
    populated >= 6 ? "alta" : populated >= 3 ? "media" : "baja";

  const reasons: string[] = [];
  if (whatSells) reasons.push(`Detecté qué vende: “${whatSells}”.`);
  if (howSells) reasons.push(`Detecté su canal actual: “${howSells}”.`);
  if (currentlySelling !== null) {
    reasons.push(
      currentlySelling
        ? "Encontré señales de que el negocio ya vende."
        : "Encontré señales de que el negocio todavía está comenzando.",
    );
  }
  if (ads.runsAds !== null) {
    reasons.push(
      ads.runsAds
        ? `Detecté publicidad${ads.platforms.length ? ` en ${ads.platforms.join(", ")}` : ""}.`
        : "El prospecto indicó que no usa anuncios.",
    );
  }
  if (mainProblem) reasons.push("Encontré un problema comercial concreto.");
  if (requestedFeatures.length) {
    reasons.push(`Detecté ${requestedFeatures.length} funciones probables.`);
  }
  if (suggestedPrice !== null) {
    reasons.push(
      explicitPrice
        ? `Encontré una cifra mencionada en el chat: ${suggestedPrice} ${currency}.`
        : `Calculé un precio base según el tipo y complejidad del proyecto.`,
    );
  }

  return {
    whatSells,
    howSells,
    currentlySelling,
    runsAds: ads.runsAds,
    adPlatforms: ads.platforms,
    adDestination,
    mainProblem,
    mainGoal,
    requestedFeatures,
    leadScore,
    intentionLevel,
    suggestedPrice,
    currency,
    summary,
    confidence,
    reasons,
  };
}
