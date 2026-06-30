"use client";

import { createClient } from "@/lib/supabase/client";
import { inferWhatsAppImportFields, type ImportFieldInference } from "@/lib/whatsapp/infer-import-fields";
import { analyzeWhatsAppCommercially, type CommercialChatAnalysis } from "@/lib/whatsapp/analyze-commercial";
import { inferPostPaymentWorkflow } from "@/lib/whatsapp/infer-post-payment";
import {
  inferMessageType,
  parseWhatsAppExport,
  type ParsedWhatsAppExport,
} from "@/lib/whatsapp/parse-export";
import JSZip from "jszip";
import { Archive, CalendarCheck2, CheckCircle2, CircleDollarSign, FileAudio2, FileImage, FileText, Files, Loader2, Mic2, RefreshCw, Sparkles, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

const statusOptions = [
  ["nuevo", "Nuevo"],
  ["diagnostico", "Diagnóstico"],
  ["calificado", "Calificado"],
  ["activos_recibidos", "Activos recibidos"],
  ["seguimiento", "Seguimiento"],
  ["anticipo_programado", "Anticipo programado"],
  ["anticipo_recibido", "Anticipo recibido"],
  ["onboarding", "Onboarding"],
  ["en_desarrollo", "En desarrollo"],
  ["revision", "Revisión"],
  ["entregado", "Entregado"],
  ["perdido", "Perdido"],
] as const;

const projectOptions = [
  ["por_definir", "Por definir"],
  ["informativa", "Web informativa"],
  ["tienda_cobro_usuarios", "Cobro, tienda o usuarios"],
  ["cursos_complejo", "Cursos o sistema complejo"],
] as const;

function safeFilename(filename: string) {
  const extension = filename.includes(".") ? `.${filename.split(".").pop()}` : "";
  const base = extension ? filename.slice(0, -extension.length) : filename;
  return `${base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")}${extension.toLowerCase()}`;
}

function mimeFromFilename(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    opus: "audio/ogg",
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    mp4: "video/mp4",
    mov: "video/quicktime",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
  };
  return map[extension ?? ""] ?? "application/octet-stream";
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}


function isAudioFilename(filename: string) {
  return /\.(?:opus|ogg|mp3|m4a|wav|webm|mpga|mpeg)$/i.test(filename);
}

function isImageFilename(filename: string) {
  return /\.(?:jpg|jpeg|png|webp|gif|heic)$/i.test(filename);
}


function isPdfFilename(filename: string) {
  return /\.pdf$/i.test(filename);
}

type PdfAnalysis = {
  document_type: string;
  document_role: string;
  title: string;
  summary: string;
  business_name: string;
  industry: string;
  what_sells: string;
  provider_deliverables: string[];
  services: string[];
  products: string[];
  locations: string[];
  phones: string[];
  emails: string[];
  website: string;
  years_experience: string;
  certifications: string[];
  clients_or_projects: string[];
  key_facts: string[];
  detected_text: string;
  confidence: "alta" | "media" | "baja";
};

function uniqueText(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}


function normalizeLoose(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function whatSellsLooksWeak(value: string, currentBusinessName: string) {
  const normalized = normalizeLoose(value);
  const business = normalizeLoose(currentBusinessName);

  if (!normalized) return true;
  if (business && normalized === business) return true;
  if (normalized.split(" ").length <= 2) return true;
  if (/^(negocio|empresa|servicios|productos|por definir)$/.test(normalized)) {
    return true;
  }

  return false;
}

function looksLikeProviderDeliverable(value: string) {
  const normalized = normalizeLoose(value);
  return /(desarrollo web|pagina web|sistema web|diseno web|carga de propiedades por vendedores|integracion stripe|area de usuario|panel administrador|cursos en linea como modulo de plataforma)/.test(
    normalized,
  );
}

function offerFromBusinessContext(name: string, industry: string) {
  const normalized = normalizeLoose(`${name} ${industry}`);

  if (/(venta de casa|venta de casas|propiedad|propiedades|inmobiliaria|bienes raices)/.test(normalized)) {
    return "Venta y publicación de casas y propiedades inmobiliarias sin intermediarios";
  }
  if (/(marketing|agencia)/.test(normalized)) {
    return "Servicios de marketing y publicidad";
  }
  if (/(construccion|terrazo|arquitectura|remodelacion)/.test(normalized)) {
    return "Servicios y productos para construcción, arquitectura y acabados";
  }

  return industry.trim();
}

function resolvedPdfOffer(item: PdfAnalysis, fallbackBusinessName: string) {
  const direct = item.what_sells.trim();
  if (
    direct &&
    item.confidence !== "baja" &&
    !looksLikeProviderDeliverable(direct)
  ) {
    return direct;
  }

  const serviceCandidate = uniqueText([...item.services, ...item.products])
    .filter((value) => !looksLikeProviderDeliverable(value))
    .slice(0, 8)
    .join(", ");
  if (serviceCandidate) return serviceCandidate;

  return offerFromBusinessContext(
    item.business_name || fallbackBusinessName,
    item.industry,
  );
}

type ImageAnalysis = {
  kind:
    | "payment_proof"
    | "logo_or_brand"
    | "social_or_web_screenshot"
    | "document_photo"
    | "product_or_service"
    | "other";
  summary: string;
  business_name: string;
  detected_text: string;
  is_payment_proof: boolean;
  amount: number | null;
  currency: "MXN" | "USD" | null;
  bank_name: string;
  beneficiary: string;
  reference: string;
  confidence: "alta" | "media" | "baja";
};

function conversationSuggestsConfirmedPayment(
  parsed: ParsedWhatsAppExport,
  ownerAlias: string,
) {
  const ownMessages = parsed.messages
    .filter(
      (message) =>
        !message.isSystem &&
        message.sender &&
        message.sender.trim().toLowerCase() === ownerAlias.trim().toLowerCase(),
    )
    .map((message) => message.body)
    .join("\n");

  return /(confirmo\s+de\s+recibido|confirmo\s+recibido|ya\s+te\s+quedo|ya\s+quedo|excelente,?\s+confirmo|confirmado|listo\s+quedo)/i.test(
    ownMessages,
  );
}

function transcriptionUploadFilename(filename: string) {
  if (/\.opus$/i.test(filename)) {
    return filename.replace(/\.opus$/i, ".ogg");
  }
  return filename;
}

function parsedWithTranscriptions(
  parsed: ParsedWhatsAppExport,
  transcriptions: Record<string, string>,
): ParsedWhatsAppExport {
  return {
    ...parsed,
    messages: parsed.messages.map((message) => {
      const filename = message.attachmentFilename;
      const transcription = filename ? transcriptions[filename.toLowerCase()] : "";

      if (!transcription) return message;

      return {
        ...message,
        body: `${message.body}\n\n[Transcripción de nota de voz]\n${transcription}`,
      };
    }),
  };
}

export function WhatsAppImporter() {
  const router = useRouter();
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zip, setZip] = useState<JSZip | null>(null);
  const [parsed, setParsed] = useState<ParsedWhatsAppExport | null>(null);
  const [chatFilename, setChatFilename] = useState("");
  const [mediaNames, setMediaNames] = useState<string[]>([]);
  const [ownerAlias, setOwnerAlias] = useState("EderCreaWebs");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [status, setStatus] = useState("nuevo");
  const [projectType, setProjectType] = useState("por_definir");
  const [loadingZip, setLoadingZip] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [inference, setInference] = useState<ImportFieldInference | null>(null);
  const [commercialAnalysis, setCommercialAnalysis] = useState<CommercialChatAnalysis | null>(null);
  const [whatSells, setWhatSells] = useState("");
  const [howSells, setHowSells] = useState("");
  const [currentlySelling, setCurrentlySelling] = useState<"" | "yes" | "no">("");
  const [runsAds, setRunsAds] = useState<"" | "yes" | "no">("");
  const [adPlatforms, setAdPlatforms] = useState("");
  const [adDestination, setAdDestination] = useState("");
  const [mainProblem, setMainProblem] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [requestedFeatures, setRequestedFeatures] = useState("");
  const [leadScore, setLeadScore] = useState(0);
  const [intentionLevel, setIntentionLevel] = useState("baja");
  const [suggestedPrice, setSuggestedPrice] = useState("");
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [conversationSummary, setConversationSummary] = useState("");

  const [audioTranscriptions, setAudioTranscriptions] = useState<Record<string, string>>({});
  const [transcribingAudios, setTranscribingAudios] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState("");
  const [transcriptionErrors, setTranscriptionErrors] = useState<string[]>([]);


  const [imageAnalyses, setImageAnalyses] = useState<Record<string, ImageAnalysis>>({});
  const [analyzingImages, setAnalyzingImages] = useState(false);
  const [imageAnalysisProgress, setImageAnalysisProgress] = useState("");
  const [imageAnalysisErrors, setImageAnalysisErrors] = useState<string[]>([]);


  const [pdfAnalyses, setPdfAnalyses] = useState<Record<string, PdfAnalysis>>({});
  const [analyzingPdfs, setAnalyzingPdfs] = useState(false);
  const [pdfAnalysisProgress, setPdfAnalysisProgress] = useState("");
  const [pdfAnalysisErrors, setPdfAnalysisErrors] = useState<string[]>([]);


  const nonSystemMessages = useMemo(
    () => parsed?.messages.filter((message) => !message.isSystem) ?? [],
    [parsed],
  );


  const audioNames = useMemo(
    () => mediaNames.filter(isAudioFilename),
    [mediaNames],
  );

  const transcribedAudioCount = useMemo(
    () =>
      audioNames.filter((filename) =>
        Boolean(audioTranscriptions[filename.toLowerCase()]),
      ).length,
    [audioNames, audioTranscriptions],
  );


  const imageNames = useMemo(
    () => mediaNames.filter(isImageFilename),
    [mediaNames],
  );

  const analyzedImageCount = useMemo(
    () =>
      imageNames.filter((filename) =>
        Boolean(imageAnalyses[filename.toLowerCase()]),
      ).length,
    [imageNames, imageAnalyses],
  );


  const pdfNames = useMemo(
    () => mediaNames.filter(isPdfFilename),
    [mediaNames],
  );

  const analyzedPdfCount = useMemo(
    () =>
      pdfNames.filter((filename) => Boolean(pdfAnalyses[filename.toLowerCase()]))
        .length,
    [pdfNames, pdfAnalyses],
  );

  const combinedPdfInsights = useMemo(() => {
    const analyses = Object.values(pdfAnalyses);
    return {
      businessName:
        analyses.find(
          (item) => item.business_name.trim() && item.confidence !== "baja",
        )?.business_name ?? "",
      industry: analyses.find((item) => item.industry.trim())?.industry ?? "",
      whatSells:
        analyses.find((item) => item.what_sells.trim())?.what_sells ?? "",
      services: uniqueText(analyses.flatMap((item) => item.services)),
      products: uniqueText(analyses.flatMap((item) => item.products)),
      locations: uniqueText(analyses.flatMap((item) => item.locations)),
      phones: uniqueText(analyses.flatMap((item) => item.phones)),
      emails: uniqueText(analyses.flatMap((item) => item.emails)),
      website: analyses.find((item) => item.website.trim())?.website ?? "",
      yearsExperience:
        analyses.find((item) => item.years_experience.trim())?.years_experience ?? "",
      certifications: uniqueText(
        analyses.flatMap((item) => item.certifications),
      ),
      clientsOrProjects: uniqueText(
        analyses.flatMap((item) => item.clients_or_projects),
      ),
      keyFacts: uniqueText(analyses.flatMap((item) => item.key_facts)),
      summaries: uniqueText(analyses.map((item) => item.summary)),
    };
  }, [pdfAnalyses]);


  const postPaymentInference = useMemo(() => {
    if (!parsed) return null;

    const price = suggestedPrice ? Number(suggestedPrice) : null;
    return inferPostPaymentWorkflow({
      parsed,
      ownerAlias,
      imageAnalyses,
      suggestedPrice: Number.isFinite(price) ? price : null,
      fallbackCurrency: currency,
    });
  }, [
    parsed,
    ownerAlias,
    imageAnalyses,
    suggestedPrice,
    currency,
  ]);

  async function handleZip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setErrorMessage("");
    setWarnings([]);
    setParsed(null);
    setZip(null);
    setMediaNames([]);
    setChatFilename("");
    setInference(null);
    setCommercialAnalysis(null);
    setWhatSells("");
    setHowSells("");
    setCurrentlySelling("");
    setRunsAds("");
    setAdPlatforms("");
    setAdDestination("");
    setMainProblem("");
    setMainGoal("");
    setRequestedFeatures("");
    setLeadScore(0);
    setIntentionLevel("baja");
    setSuggestedPrice("");
    setCurrency("MXN");
    setConversationSummary("");
    setAudioTranscriptions({});
    setTranscribingAudios(false);
    setTranscriptionProgress("");
    setTranscriptionErrors([]);
    setImageAnalyses({});
    setAnalyzingImages(false);
    setImageAnalysisProgress("");
    setImageAnalysisErrors([]);
    setPdfAnalyses({});
    setAnalyzingPdfs(false);
    setPdfAnalysisProgress("");
    setPdfAnalysisErrors([]);
    setZipFile(file);

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setErrorMessage("Selecciona el ZIP que genera WhatsApp al exportar el chat.");
      return;
    }

    setLoadingZip(true);
    setProgress("Abriendo ZIP…");

    try {
      const openedZip = await JSZip.loadAsync(file);
      const entries = Object.values(openedZip.files).filter(
        (entry) => !entry.dir && !entry.name.startsWith("__MACOSX/"),
      );
      const txtEntry = entries.find((entry) => entry.name.toLowerCase().endsWith(".txt"));

      if (!txtEntry) {
        throw new Error("El ZIP no contiene el archivo .txt de la conversación.");
      }

      const text = await txtEntry.async("string");
      const parsedExport = parseWhatsAppExport(text);

      if (parsedExport.messages.length === 0) {
        throw new Error("No pude detectar mensajes en el archivo de WhatsApp.");
      }

      const media = entries
        .filter((entry) => entry.name !== txtEntry.name)
        .map((entry) => entry.name);

      const detected = inferWhatsAppImportFields({
        parsed: parsedExport,
        zipFilename: file.name,
        currentOwnerAlias: ownerAlias,
        mediaNames: media,
      });

      setZip(openedZip);
      setParsed(parsedExport);
      setChatFilename(txtEntry.name);
      setMediaNames(media);
      setOwnerAlias(detected.ownerAlias);
      setContactName(detected.contactName);
      setPhone(detected.phone);
      setBusinessName(detected.businessName);
      const analysis = analyzeWhatsAppCommercially({
        parsed: parsedExport,
        ownerAlias: detected.ownerAlias,
        businessName: detected.businessName,
        projectType: detected.projectType,
      });

      setStatus(detected.status);
      setProjectType(detected.projectType);
      setInference(detected);
      setCommercialAnalysis(analysis);
      setWhatSells(analysis.whatSells);
      setHowSells(analysis.howSells);
      setCurrentlySelling(
        analysis.currentlySelling === null ? "" : analysis.currentlySelling ? "yes" : "no",
      );
      setRunsAds(analysis.runsAds === null ? "" : analysis.runsAds ? "yes" : "no");
      setAdPlatforms(analysis.adPlatforms.join(", "));
      setAdDestination(analysis.adDestination);
      setMainProblem(analysis.mainProblem);
      setMainGoal(analysis.mainGoal);
      setRequestedFeatures(analysis.requestedFeatures.join(", "));
      setLeadScore(analysis.leadScore);
      setIntentionLevel(analysis.intentionLevel);
      setSuggestedPrice(
        analysis.suggestedPrice === null ? "" : String(analysis.suggestedPrice),
      );
      setCurrency(analysis.currency);
      setConversationSummary(analysis.summary);
      setProgress("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pude leer el ZIP.");
    } finally {
      setLoadingZip(false);
    }
  }


  function applyCommercialAnalysis(
    sourceParsed: ParsedWhatsAppExport,
    nextOwnerAlias = ownerAlias,
    nextBusinessName = businessName,
    nextProjectType = projectType,
  ) {
    const analysis = analyzeWhatsAppCommercially({
      parsed: sourceParsed,
      ownerAlias: nextOwnerAlias,
      businessName: nextBusinessName,
      projectType: nextProjectType,
    });

    setCommercialAnalysis(analysis);
    setWhatSells(analysis.whatSells);
    setHowSells(analysis.howSells);
    setCurrentlySelling(
      analysis.currentlySelling === null
        ? ""
        : analysis.currentlySelling
          ? "yes"
          : "no",
    );
    setRunsAds(
      analysis.runsAds === null ? "" : analysis.runsAds ? "yes" : "no",
    );
    setAdPlatforms(analysis.adPlatforms.join(", "));
    setAdDestination(analysis.adDestination);
    setMainProblem(analysis.mainProblem);
    setMainGoal(analysis.mainGoal);
    setRequestedFeatures(analysis.requestedFeatures.join(", "));
    setLeadScore(analysis.leadScore);
    setIntentionLevel(analysis.intentionLevel);
    setSuggestedPrice(
      analysis.suggestedPrice === null ? "" : String(analysis.suggestedPrice),
    );
    setCurrency(analysis.currency);
    setConversationSummary(analysis.summary);
  }

  async function handleTranscribeAudios() {
    if (!zip || !parsed || audioNames.length === 0) return;

    setTranscribingAudios(true);
    setTranscriptionErrors([]);
    setErrorMessage("");

    const nextTranscriptions = { ...audioTranscriptions };
    const errors: string[] = [];

    try {
      for (let index = 0; index < audioNames.length; index += 1) {
        const audioName = audioNames[index];
        const key = audioName.toLowerCase();

        if (nextTranscriptions[key]) {
          continue;
        }

        setTranscriptionProgress(
          `Transcribiendo ${index + 1} de ${audioNames.length}: ${audioName}`,
        );

        try {
          const entry = zip.file(audioName);
          if (!entry) {
            throw new Error("No encontré el audio dentro del ZIP.");
          }

          const blob = await entry.async("blob");
          if (blob.size > 25 * 1024 * 1024) {
            throw new Error("Supera el límite de 25 MB.");
          }

          const uploadName = transcriptionUploadFilename(
            audioName.split("/").pop() ?? audioName,
          );
          const file = new File([blob], uploadName, {
            type: mimeFromFilename(audioName),
          });

          const formData = new FormData();
          formData.append("file", file);
          formData.append(
            "context",
            [
              businessName ? `Negocio: ${businessName}` : "",
              whatSells ? `Qué vende: ${whatSells}` : "",
              mainGoal ? `Objetivo: ${mainGoal}` : "",
            ]
              .filter(Boolean)
              .join(". "),
          );

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          const result = (await response.json()) as {
            text?: string;
            error?: string;
          };

          if (!response.ok || !result.text) {
            throw new Error(result.error || "No se pudo transcribir.");
          }

          nextTranscriptions[key] = result.text;
          setAudioTranscriptions({ ...nextTranscriptions });
        } catch (audioError) {
          errors.push(
            `${audioName}: ${
              audioError instanceof Error
                ? audioError.message
                : "error desconocido"
            }`,
          );
        }
      }

      setAudioTranscriptions({ ...nextTranscriptions });
      setTranscriptionErrors(errors);

      const enriched = parsedWithTranscriptions(parsed, nextTranscriptions);
      applyCommercialAnalysis(
        enriched,
        ownerAlias,
        businessName,
        projectType,
      );
    } finally {
      setTranscribingAudios(false);
      setTranscriptionProgress("");
    }
  }


  function applyImageInsights(nextAnalyses: Record<string, ImageAnalysis>) {
    const analyses = Object.values(nextAnalyses);
    if (analyses.length === 0) return;

    if (!businessName.trim()) {
      const candidate = analyses.find(
        (item) => item.business_name.trim() && item.confidence !== "baja",
      )?.business_name;
      if (candidate) {
        setBusinessName(candidate.trim());
      }
    }

    const paymentProofs = analyses.filter(
      (item) => item.is_payment_proof && (item.amount ?? 0) > 0,
    );

    if (parsed) {
      const price = suggestedPrice ? Number(suggestedPrice) : null;
      const postPayment = inferPostPaymentWorkflow({
        parsed,
        ownerAlias,
        imageAnalyses: nextAnalyses,
        suggestedPrice: Number.isFinite(price) ? price : null,
        fallbackCurrency: currency,
      });

      if (postPayment.recommendedStatus) {
        setStatus(postPayment.recommendedStatus);
      }
    }
  }

  async function handleAnalyzeImages() {
    if (!zip || imageNames.length === 0) return;

    setAnalyzingImages(true);
    setImageAnalysisErrors([]);
    setErrorMessage("");

    const nextAnalyses = { ...imageAnalyses };
    const errors: string[] = [];

    try {
      for (let index = 0; index < imageNames.length; index += 1) {
        const imageName = imageNames[index];
        const key = imageName.toLowerCase();

        if (nextAnalyses[key]) continue;

        setImageAnalysisProgress(
          `Analizando imagen ${index + 1} de ${imageNames.length}: ${imageName}`,
        );

        try {
          const entry = zip.file(imageName);
          if (!entry) throw new Error("No encontré la imagen dentro del ZIP.");

          const blob = await entry.async("blob");
          if (blob.size > 15 * 1024 * 1024) {
            throw new Error("Supera el límite de 15 MB.");
          }

          const file = new File([blob], imageName.split("/").pop() ?? imageName, {
            type: mimeFromFilename(imageName),
          });

          const formData = new FormData();
          formData.append("file", file);
          formData.append(
            "context",
            [
              businessName ? `Negocio actual: ${businessName}` : "",
              whatSells ? `Qué vende: ${whatSells}` : "",
              conversationSummary ? `Resumen: ${conversationSummary}` : "",
            ]
              .filter(Boolean)
              .join(". "),
          );

          const response = await fetch("/api/analyze-image", {
            method: "POST",
            body: formData,
          });
          const result = (await response.json()) as ImageAnalysis & {
            error?: string;
          };

          if (!response.ok || !result.summary) {
            throw new Error(result.error || "No se pudo analizar la imagen.");
          }

          nextAnalyses[key] = result;
          setImageAnalyses({ ...nextAnalyses });
        } catch (imageError) {
          errors.push(
            `${imageName}: ${
              imageError instanceof Error
                ? imageError.message
                : "error desconocido"
            }`,
          );
        }
      }

      setImageAnalyses({ ...nextAnalyses });
      setImageAnalysisErrors(errors);
      applyImageInsights(nextAnalyses);
    } finally {
      setAnalyzingImages(false);
      setImageAnalysisProgress("");
    }
  }


  function applyPdfInsights(nextAnalyses: Record<string, PdfAnalysis>) {
    const analyses = Object.values(nextAnalyses);
    if (analyses.length === 0) return;

    const businessCandidate = analyses.find(
      (item) => item.business_name.trim() && item.confidence !== "baja",
    )?.business_name;
    const nextBusinessName = businessName.trim() || businessCandidate?.trim() || "";

    if (!businessName.trim() && businessCandidate) {
      setBusinessName(businessCandidate.trim());
    }

    const sellCandidate = analyses
      .map((item) => resolvedPdfOffer(item, nextBusinessName))
      .find(Boolean);

    if (
      sellCandidate &&
      whatSellsLooksWeak(whatSells, nextBusinessName)
    ) {
      setWhatSells(sellCandidate);
    }

    const summaries = uniqueText(analyses.map((item) => item.summary));
    if (summaries.length > 0) {
      const pdfSummary = `Información recuperada de PDFs: ${summaries.join(" ")}`;
      setConversationSummary((current) => {
        if (current.includes("Información recuperada de PDFs:")) return current;
        return [current.trim(), pdfSummary].filter(Boolean).join("\n\n");
      });
    }
  }

  async function handleAnalyzePdfs() {
    if (!zip || pdfNames.length === 0) return;

    setAnalyzingPdfs(true);
    setPdfAnalysisErrors([]);
    setErrorMessage("");

    const nextAnalyses = { ...pdfAnalyses };
    const errors: string[] = [];

    try {
      for (let index = 0; index < pdfNames.length; index += 1) {
        const pdfName = pdfNames[index];
        const key = pdfName.toLowerCase();
        if (nextAnalyses[key]) continue;

        setPdfAnalysisProgress(
          `Analizando PDF ${index + 1} de ${pdfNames.length}: ${pdfName}`,
        );

        try {
          const entry = zip.file(pdfName);
          if (!entry) throw new Error("No encontré el PDF dentro del ZIP.");

          const blob = await entry.async("blob");
          if (blob.size > 30 * 1024 * 1024) {
            throw new Error("Supera el límite de 30 MB de esta versión.");
          }

          const file = new File([blob], pdfName.split("/").pop() ?? pdfName, {
            type: "application/pdf",
          });
          const formData = new FormData();
          formData.append("file", file);
          formData.append(
            "context",
            [
              businessName ? `Negocio actual: ${businessName}` : "",
              whatSells ? `Qué vende según el chat: ${whatSells}` : "",
              mainGoal ? `Objetivo del proyecto: ${mainGoal}` : "",
              conversationSummary ? `Resumen: ${conversationSummary}` : "",
            ]
              .filter(Boolean)
              .join(". "),
          );

          const response = await fetch("/api/analyze-pdf", {
            method: "POST",
            body: formData,
          });
          const result = (await response.json()) as PdfAnalysis & {
            error?: string;
          };

          if (!response.ok || !result.summary) {
            throw new Error(result.error || "No se pudo analizar el PDF.");
          }

          nextAnalyses[key] = result;
          setPdfAnalyses({ ...nextAnalyses });
        } catch (pdfError) {
          errors.push(
            `${pdfName}: ${
              pdfError instanceof Error ? pdfError.message : "error desconocido"
            }`,
          );
        }
      }

      setPdfAnalyses({ ...nextAnalyses });
      setPdfAnalysisErrors(errors);
      applyPdfInsights(nextAnalyses);
    } finally {
      setAnalyzingPdfs(false);
      setPdfAnalysisProgress("");
    }
  }

  function redetectFields() {
    if (!parsed || !zipFile) return;

    const detected = inferWhatsAppImportFields({
      parsed,
      zipFilename: zipFile.name,
      currentOwnerAlias: ownerAlias,
      mediaNames,
    });

    setOwnerAlias(detected.ownerAlias);
    setContactName(detected.contactName);
    setPhone(detected.phone);
    setBusinessName(detected.businessName);
    const enrichedParsed = parsedWithTranscriptions(
      parsed,
      audioTranscriptions,
    );
    const analysis = analyzeWhatsAppCommercially({
      parsed: enrichedParsed,
      ownerAlias: detected.ownerAlias,
      businessName: detected.businessName,
      projectType: detected.projectType,
    });

    setStatus(detected.status);
    setProjectType(detected.projectType);
    setInference(detected);
    setCommercialAnalysis(analysis);
    setWhatSells(analysis.whatSells);
    setHowSells(analysis.howSells);
    setCurrentlySelling(
      analysis.currentlySelling === null ? "" : analysis.currentlySelling ? "yes" : "no",
    );
    setRunsAds(analysis.runsAds === null ? "" : analysis.runsAds ? "yes" : "no");
    setAdPlatforms(analysis.adPlatforms.join(", "));
    setAdDestination(analysis.adDestination);
    setMainProblem(analysis.mainProblem);
    setMainGoal(analysis.mainGoal);
    setRequestedFeatures(analysis.requestedFeatures.join(", "));
    setLeadScore(analysis.leadScore);
    setIntentionLevel(analysis.intentionLevel);
    setSuggestedPrice(
      analysis.suggestedPrice === null ? "" : String(analysis.suggestedPrice),
    );
    setCurrency(analysis.currency);
    setConversationSummary(analysis.summary);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setWarnings([]);

    if (!zip || !zipFile || !parsed) {
      setErrorMessage("Primero selecciona y revisa un ZIP.");
      return;
    }
    if (!contactName.trim()) {
      setErrorMessage("Escribe el nombre del contacto.");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("Escribe el teléfono. Puede ser el número que aparece en el nombre del chat.");
      return;
    }

    setImporting(true);
    const importWarnings: string[] = [];

    try {
      const supabase = createClient();
      setProgress("Validando sesión…");
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");

      let businessId: string | null = null;
      const trimmedBusiness = businessName.trim();

      if (trimmedBusiness) {
        setProgress("Creando o localizando negocio…");
        const { data: existingBusiness } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", user.id)
          .ilike("name", trimmedBusiness)
          .limit(1)
          .maybeSingle();

        if (existingBusiness?.id) {
          businessId = existingBusiness.id;
          const { error: updateBusinessError } = await supabase
            .from("businesses")
            .update({
              industry: combinedPdfInsights.industry || whatSells || null,
              description: conversationSummary || null,
              phone: combinedPdfInsights.phones[0] || null,
              email: combinedPdfInsights.emails[0] || null,
              website: combinedPdfInsights.website || null,
              services: combinedPdfInsights.services,
              products: combinedPdfInsights.products,
              public_data: {
                pdf_analysis: {
                  locations: combinedPdfInsights.locations,
                  years_experience: combinedPdfInsights.yearsExperience,
                  certifications: combinedPdfInsights.certifications,
                  clients_or_projects: combinedPdfInsights.clientsOrProjects,
                  key_facts: combinedPdfInsights.keyFacts,
                },
              },
            })
            .eq("id", businessId);
          if (updateBusinessError) throw updateBusinessError;
        } else {
          const { data: createdBusiness, error: businessError } = await supabase
            .from("businesses")
            .insert({
              owner_id: user.id,
              name: trimmedBusiness,
              industry: combinedPdfInsights.industry || whatSells || null,
              description: conversationSummary || null,
              phone: combinedPdfInsights.phones[0] || null,
              email: combinedPdfInsights.emails[0] || null,
              website: combinedPdfInsights.website || null,
              services: combinedPdfInsights.services,
              products: combinedPdfInsights.products,
              public_data: {
                pdf_analysis: {
                  locations: combinedPdfInsights.locations,
                  years_experience: combinedPdfInsights.yearsExperience,
                  certifications: combinedPdfInsights.certifications,
                  clients_or_projects: combinedPdfInsights.clientsOrProjects,
                  key_facts: combinedPdfInsights.keyFacts,
                },
              },
            })
            .select("id")
            .single();
          if (businessError) throw businessError;
          businessId = createdBusiness.id;
        }
      }

      setProgress("Creando o localizando contacto…");
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("owner_id", user.id)
        .eq("phone", phone.trim())
        .maybeSingle();

      let contactId: string;
      if (existingContact?.id) {
        contactId = existingContact.id;
        const { error: updateContactError } = await supabase
          .from("contacts")
          .update({
            full_name: contactName.trim(),
            business_id: businessId,
          })
          .eq("id", contactId);
        if (updateContactError) throw updateContactError;
      } else {
        const { data: createdContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            owner_id: user.id,
            business_id: businessId,
            full_name: contactName.trim(),
            phone: phone.trim(),
          })
          .select("id")
          .single();
        if (contactError) throw contactError;
        contactId = createdContact.id;
      }

      const importPostPayment = inferPostPaymentWorkflow({
        parsed,
        ownerAlias,
        imageAnalyses,
        suggestedPrice: suggestedPrice ? Number(suggestedPrice) : null,
        fallbackCurrency: currency,
      });
      const effectiveStatus = importPostPayment.recommendedStatus ?? status;

      setProgress("Creando lead…");
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          owner_id: user.id,
          contact_id: contactId,
          business_id: businessId,
          source: "Importación WhatsApp ZIP",
          original_message: nonSystemMessages[0]?.body ?? "Chat importado",
          status: effectiveStatus,
          project_type: projectType,
          what_sells: whatSells.trim() || null,
          how_sells: howSells.trim() || null,
          currently_selling:
            currentlySelling === "" ? null : currentlySelling === "yes",
          runs_ads: runsAds === "" ? null : runsAds === "yes",
          ad_platforms: adPlatforms
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          ad_destination: adDestination.trim() || null,
          main_problem: mainProblem.trim() || null,
          main_goal: mainGoal.trim() || null,
          requested_features: requestedFeatures
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          suggested_price: suggestedPrice ? Number(suggestedPrice) : null,
          currency,
          lead_score: Number.isFinite(leadScore) ? leadScore : 0,
          intention_level: intentionLevel,
          likely_start_date: importPostPayment.onboardingDate
            ? importPostPayment.onboardingDate.slice(0, 10)
            : null,
          bot_mode: "copilot",
          conversation_summary:
            conversationSummary.trim() ||
            `Chat histórico importado desde ${zipFile.name}. ${nonSystemMessages.length} mensajes y ${mediaNames.length} archivos.`,
          internal_notes: `Análisis automático V1 con confianza ${
            commercialAnalysis?.confidence ?? "no disponible"
          }. Revisar antes de cotizar.`,
        })
        .select("id")
        .single();
      if (leadError) throw leadError;

      const isOpen = !["perdido", "entregado"].includes(effectiveStatus);
      setProgress("Creando conversación…");
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          owner_id: user.id,
          lead_id: lead.id,
          provider: "whatsapp_import",
          provider_conversation_id: `zip:${zipFile.name}:${Date.now()}`,
          phone: phone.trim(),
          is_open: isOpen,
          bot_paused: true,
          last_message_at: parsed.lastMessageAt,
          last_inbound_at:
            [...nonSystemMessages]
              .reverse()
              .find(
                (message) =>
                  message.sender?.toLowerCase() !== ownerAlias.trim().toLowerCase(),
              )?.timestamp ?? null,
          last_outbound_at:
            [...nonSystemMessages]
              .reverse()
              .find(
                (message) =>
                  message.sender?.toLowerCase() === ownerAlias.trim().toLowerCase(),
              )?.timestamp ?? null,
        })
        .select("id")
        .single();
      if (conversationError) throw conversationError;

      setProgress(`Guardando ${parsed.messages.length} mensajes…`);
      const rows = parsed.messages.map((message) => {
        const outbound =
          !message.isSystem &&
          message.sender?.trim().toLowerCase() === ownerAlias.trim().toLowerCase();
        const providerMessageId = `whatsapp-import:${conversation.id}:${message.index}`;

        return {
          owner_id: user.id,
          conversation_id: conversation.id,
          lead_id: lead.id,
          provider_message_id: providerMessageId,
          direction: outbound ? "outbound" : "inbound",
          type: message.isSystem
            ? "system"
            : inferMessageType(message.attachmentFilename, message.body),
          sender_name: message.sender,
          sender_phone: outbound ? null : phone.trim(),
          body: message.body,
          transcription: message.attachmentFilename
            ? audioTranscriptions[
                message.attachmentFilename.toLowerCase()
              ] ?? null
            : null,
          processed_text: message.attachmentFilename &&
            audioTranscriptions[message.attachmentFilename.toLowerCase()]
              ? `${message.body}\n\n[Transcripción de nota de voz]\n${
                  audioTranscriptions[
                    message.attachmentFilename.toLowerCase()
                  ]
                }`
              : message.body,
          raw_payload: {
            imported: true,
            chat_filename: chatFilename,
            attachment_filename: message.attachmentFilename,
          },
          sent_at: outbound ? message.timestamp : null,
          received_at: outbound ? null : message.timestamp,
          created_at: message.timestamp,
        };
      });

      const messageIdByProvider = new Map<string, string>();
      for (const messageChunk of chunk(rows, 100)) {
        const { data: insertedMessages, error: messagesError } = await supabase
          .from("messages")
          .insert(messageChunk)
          .select("id,provider_message_id");
        if (messagesError) throw messagesError;
        for (const insertedMessage of insertedMessages ?? []) {
          if (insertedMessage.provider_message_id) {
            messageIdByProvider.set(insertedMessage.provider_message_id, insertedMessage.id);
          }
        }
      }

      const entries = Object.values(zip.files).filter(
        (entry) =>
          !entry.dir &&
          !entry.name.startsWith("__MACOSX/") &&
          entry.name !== chatFilename,
      );

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        setProgress(`Subiendo archivo ${index + 1} de ${entries.length}: ${entry.name}`);

        try {
          const originalName = entry.name.split("/").pop() ?? entry.name;
          const sanitized = safeFilename(originalName) || `archivo-${index + 1}`;
          const storagePath = `${user.id}/${lead.id}/${Date.now()}-${index}-${sanitized}`;
          const blob = await entry.async("blob");
          const mimeType = mimeFromFilename(originalName);

          const { error: uploadError } = await supabase.storage
            .from("whatsapp-imports")
            .upload(storagePath, blob, {
              contentType: mimeType,
              upsert: false,
            });
          if (uploadError) throw uploadError;

          const matchedMessage = parsed.messages.find(
            (message) =>
              message.attachmentFilename?.toLowerCase() === originalName.toLowerCase(),
          );
          const matchedProviderId = matchedMessage
            ? `whatsapp-import:${conversation.id}:${matchedMessage.index}`
            : null;

          const imageAnalysis = imageAnalyses[originalName.toLowerCase()] ?? null;
          const pdfAnalysis = pdfAnalyses[originalName.toLowerCase()] ?? null;

          const { data: createdAsset, error: assetError } = await supabase
            .from("assets")
            .insert({
              owner_id: user.id,
              lead_id: lead.id,
              message_id: matchedProviderId
                ? messageIdByProvider.get(matchedProviderId) ?? null
                : null,
              category: inferMessageType(originalName, ""),
              source: "whatsapp_zip",
              original_filename: originalName,
              mime_type: mimeType,
              size_bytes: blob.size,
              storage_bucket: "whatsapp-imports",
              storage_path: storagePath,
              extracted_text:
                imageAnalysis?.detected_text ||
                pdfAnalysis?.detected_text ||
                pdfAnalysis?.summary ||
                null,
              transcription:
                audioTranscriptions[originalName.toLowerCase()] ?? null,
              metadata: {
                zip_filename: zipFile.name,
                transcribed: Boolean(
                  audioTranscriptions[originalName.toLowerCase()],
                ),
                image_analysis: imageAnalysis,
                pdf_analysis: pdfAnalysis,
              },
            })
            .select("id")
            .single();
          if (assetError) throw assetError;

          if (
            imageAnalysis?.is_payment_proof &&
            createdAsset?.id &&
            typeof imageAnalysis.amount === "number" &&
            !Number.isNaN(imageAnalysis.amount)
          ) {
            const paymentConfirmed =
              ["anticipo_recibido", "onboarding"].includes(effectiveStatus) ||
              (parsed && conversationSuggestsConfirmedPayment(parsed, ownerAlias));

            const { error: paymentError } = await supabase.from("payments").insert({
              owner_id: user.id,
              lead_id: lead.id,
              type: "anticipo",
              status: paymentConfirmed ? "confirmed" : "pending",
              amount: imageAnalysis.amount,
              currency: imageAnalysis.currency || currency,
              method: imageAnalysis.bank_name ? "transferencia" : "deposito",
              reference: imageAnalysis.reference || null,
              proof_asset_id: createdAsset.id,
              paid_at: matchedMessage?.timestamp ?? null,
              confirmed_by: paymentConfirmed ? user.id : null,
              notes: [
                `Detectado automáticamente desde ${originalName}.`,
                imageAnalysis.bank_name ? `Banco: ${imageAnalysis.bank_name}.` : "",
                imageAnalysis.beneficiary
                  ? `Beneficiario: ${imageAnalysis.beneficiary}.`
                  : "",
                imageAnalysis.summary,
              ]
                .filter(Boolean)
                .join("\n"),
            });
            if (paymentError) throw paymentError;
          }
        } catch (fileError) {
          importWarnings.push(
            `${entry.name}: ${fileError instanceof Error ? fileError.message : "error desconocido"}`,
          );
        }
      }

      setProgress("Creando tareas posteriores al anticipo…");

      for (const task of importPostPayment.taskSuggestions) {
        const { error: taskError } = await supabase.from("tasks").insert({
          owner_id: user.id,
          lead_id: lead.id,
          type: task.type,
          title: task.title,
          description: task.description,
          status: "pending",
          priority: task.priority,
          due_at: task.dueAt,
          automation_key: task.key,
          created_by_type: "system",
          metadata: {
            source: "whatsapp_postpayment_v1",
            deposit_amount: importPostPayment.depositAmount,
            currency: importPostPayment.currency,
            onboarding_date: importPostPayment.onboardingDate,
          },
        });
        if (taskError) {
          importWarnings.push(`${task.title}: ${taskError.message}`);
        }
      }

      if (
        importPostPayment.paymentConfirmed &&
        importPostPayment.onboardingDate &&
        importPostPayment.onboardingHasExactTime
      ) {
        const startsAt = new Date(importPostPayment.onboardingDate);
        const endsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);
        const { error: meetingError } = await supabase.from("meetings").insert({
          owner_id: user.id,
          lead_id: lead.id,
          type: "kickoff",
          title: `${trimmedBusiness || contactName.trim()} - Onboarding`,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          timezone: "America/Mexico_City",
          meeting_url: importPostPayment.meetingUrl || null,
          status: "proposed",
          notes: "Fecha y hora detectadas automáticamente desde el chat importado. Revisar antes de confirmar.",
        });
        if (meetingError) importWarnings.push(`Reunión: ${meetingError.message}`);
      }

      setWarnings(importWarnings);
      setProgress("Importación terminada. Abriendo el lead…");
      router.push(`/leads/${lead.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pude completar la importación.");
      setWarnings(importWarnings);
    } finally {
      setImporting(false);
      setProgress("");
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
      <form
        onSubmit={handleImport}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-6 text-center">
          <UploadCloud className="mx-auto text-blue-600" size={34} />
          <p className="mt-3 font-semibold">Selecciona el ZIP exportado por WhatsApp</p>
          <p className="mt-1 text-sm text-gray-500">
            Debe incluir el archivo .txt y, si elegiste incluir archivos, sus imágenes, audios y PDFs.
          </p>
          <label className="mt-5 inline-flex cursor-pointer rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            Elegir ZIP
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={handleZip}
              className="hidden"
              disabled={importing}
            />
          </label>
          {zipFile ? <p className="mt-3 text-xs text-gray-500">{zipFile.name}</p> : null}
        </div>

        {parsed && audioNames.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 text-emerald-700 shadow-sm">
                  <Mic2 size={20} />
                </div>
                <div>
                  <p className="font-bold text-emerald-950">
                    Notas de voz detectadas
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    {transcribedAudioCount} de {audioNames.length} transcritas.
                    Al terminar, el análisis comercial se vuelve a calcular con
                    lo que dijeron en los audios.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTranscribeAudios}
                disabled={
                  transcribingAudios ||
                  transcribedAudioCount === audioNames.length
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {transcribingAudios ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <FileAudio2 size={17} />
                )}
                {transcribingAudios
                  ? "Transcribiendo…"
                  : transcribedAudioCount === audioNames.length
                    ? "Audios listos"
                    : "Transcribir audios"}
              </button>
            </div>

            {transcriptionProgress ? (
              <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-xs font-medium text-emerald-900">
                {transcriptionProgress}
              </p>
            ) : null}

            {transcriptionErrors.length > 0 ? (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p className="font-bold">
                  {transcriptionErrors.length} audios no se pudieron transcribir:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {transcriptionErrors.slice(0, 5).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {transcribedAudioCount > 0 ? (
              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                {audioNames
                  .filter((name) =>
                    Boolean(audioTranscriptions[name.toLowerCase()]),
                  )
                  .map((name) => (
                    <div
                      key={name}
                      className="rounded-xl border border-emerald-100 bg-white p-3"
                    >
                      <p className="text-xs font-bold text-emerald-800">
                        {name.split("/").pop()}
                      </p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-gray-600">
                        {audioTranscriptions[name.toLowerCase()]}
                      </p>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {parsed && imageNames.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 text-violet-700 shadow-sm">
                  <FileImage size={20} />
                </div>
                <div>
                  <p className="font-bold text-violet-950">
                    Imágenes detectadas
                  </p>
                  <p className="mt-1 text-sm text-violet-800">
                    {analyzedImageCount} de {imageNames.length} analizadas. Esto
                    ayuda a detectar comprobantes, nombres de negocio, logos y
                    capturas útiles.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAnalyzeImages}
                disabled={analyzingImages || analyzedImageCount === imageNames.length}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzingImages ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <FileImage size={17} />
                )}
                {analyzingImages
                  ? "Analizando…"
                  : analyzedImageCount === imageNames.length
                    ? "Imágenes listas"
                    : "Analizar imágenes"}
              </button>
            </div>

            {imageAnalysisProgress ? (
              <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-xs font-medium text-violet-900">
                {imageAnalysisProgress}
              </p>
            ) : null}

            {imageAnalysisErrors.length > 0 ? (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p className="font-bold">
                  {imageAnalysisErrors.length} imágenes no se pudieron analizar:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {imageAnalysisErrors.slice(0, 5).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {analyzedImageCount > 0 ? (
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {imageNames
                  .filter((name) => Boolean(imageAnalyses[name.toLowerCase()]))
                  .map((name) => {
                    const item = imageAnalyses[name.toLowerCase()];
                    return (
                      <div
                        key={name}
                        className="rounded-xl border border-violet-100 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-violet-800">
                            {name.split("/").pop()}
                          </p>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full bg-violet-100 px-2 py-1 font-semibold text-violet-800">
                              {item.kind}
                            </span>
                            {item.is_payment_proof ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                                {item.amount ? `${item.currency ?? "MXN"} ${item.amount}` : "Comprobante"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-gray-600">
                          {item.summary}
                        </p>
                        {item.business_name ? (
                          <p className="mt-1 text-[11px] text-gray-500">
                            Negocio detectado: <span className="font-semibold text-gray-700">{item.business_name}</span>
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        ) : null}


        {parsed && pdfNames.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 text-amber-700 shadow-sm">
                  <Files size={20} />
                </div>
                <div>
                  <p className="font-bold text-amber-950">PDFs detectados</p>
                  <p className="mt-1 text-sm text-amber-800">
                    {analyzedPdfCount} de {pdfNames.length} analizados. Recupera
                    servicios, productos, teléfonos, ubicaciones, experiencia y
                    proyectos desde catálogos o presentaciones.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAnalyzePdfs}
                disabled={analyzingPdfs || analyzedPdfCount === pdfNames.length}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzingPdfs ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <FileText size={17} />
                )}
                {analyzingPdfs
                  ? "Analizando…"
                  : analyzedPdfCount === pdfNames.length
                    ? "PDFs listos"
                    : "Analizar PDFs"}
              </button>
            </div>

            {pdfAnalysisProgress ? (
              <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-xs font-medium text-amber-900">
                {pdfAnalysisProgress}
              </p>
            ) : null}

            {pdfAnalysisErrors.length > 0 ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-800">
                <p className="font-bold">
                  {pdfAnalysisErrors.length} PDFs no se pudieron analizar:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {pdfAnalysisErrors.slice(0, 5).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {analyzedPdfCount > 0 ? (
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                {pdfNames
                  .filter((name) => Boolean(pdfAnalyses[name.toLowerCase()]))
                  .map((name) => {
                    const item = pdfAnalyses[name.toLowerCase()];
                    return (
                      <div
                        key={name}
                        className="rounded-xl border border-amber-100 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-amber-900">
                            {name.split("/").pop()}
                          </p>
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                            {item.document_type} · confianza {item.confidence}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-gray-600">
                          {item.summary}
                        </p>
                        {item.business_name ? (
                          <p className="mt-2 text-[11px] text-gray-500">
                            Negocio: <span className="font-semibold text-gray-700">{item.business_name}</span>
                          </p>
                        ) : null}
                        {resolvedPdfOffer(item, businessName) ? (
                          <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2">
                            <p className="text-[11px] text-amber-900">
                              Qué vende detectado: {resolvedPdfOffer(item, businessName)}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setWhatSells(resolvedPdfOffer(item, businessName))
                              }
                              className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
                            >
                              Usar en “Qué vende”
                            </button>
                          </div>
                        ) : null}
                        {(item.provider_deliverables ?? []).length > 0 ? (
                          <p className="mt-2 text-[11px] text-gray-400">
                            Entregables de la propuesta: {(item.provider_deliverables ?? [])
                              .slice(0, 6)
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        ) : null}

        {postPaymentInference?.hasPaymentProof ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2.5 text-amber-700 shadow-sm">
                <CircleDollarSign size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-amber-950">
                  Flujo posterior al anticipo detectado
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  El sistema usará estas señales para mover la etapa y crear tareas al importar.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs font-medium text-gray-500">Adelanto detectado</p>
                    <p className="mt-1 font-bold text-gray-950">
                      {postPaymentInference.currency} {postPaymentInference.depositAmount?.toLocaleString("es-MX")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs font-medium text-gray-500">Confirmación</p>
                    <p className="mt-1 font-bold text-gray-950">
                      {postPaymentInference.paymentConfirmed
                        ? "Confirmado de recibido"
                        : "Pendiente de revisión"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Onboarding</p>
                    <p className="mt-1 font-bold text-gray-950">
                      {postPaymentInference.onboardingDateLabel || "No detectado"}
                    </p>
                    {postPaymentInference.meetingUrl ? (
                      <p className="mt-1 truncate text-xs text-blue-700">
                        {postPaymentInference.meetingUrl}
                      </p>
                    ) : null}
                  </div>
                </div>

                {postPaymentInference.estimatedBalance !== null ? (
                  <p className="mt-3 text-xs text-amber-900">
                    Saldo provisional: {postPaymentInference.currency} {postPaymentInference.estimatedBalance.toLocaleString("es-MX")}. Debe confirmarse contra la cotización.
                  </p>
                ) : null}

                <div className="mt-4 rounded-xl border border-amber-100 bg-white p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <CalendarCheck2 size={15} />
                    Tareas que se crearán
                  </div>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
                    {postPaymentInference.taskSuggestions.map((task) => (
                      <li key={task.key}>• {task.title}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-gray-700">Tu nombre dentro del chat</span>
            <input
              value={ownerAlias}
              onChange={(event) => setOwnerAlias(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="EderCreaWebs"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Contacto</span>
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Nombre o número"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Teléfono</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="+52…"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-gray-700">Negocio — opcional</span>
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Grupo Terraxo, Alkance Marketing…"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Etapa</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {statusOptions.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Tipo de proyecto</span>
            <select
              value={projectType}
              onChange={(event) => setProjectType(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {projectOptions.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <div className="mb-4">
            <p className="text-sm font-bold text-gray-900">Análisis comercial automático</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Estos campos se guardarán en la ficha del lead. Puedes corregirlos antes de importar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Qué vende</span>
              <textarea
                value={whatSells}
                onChange={(event) => setWhatSells(event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Servicios, productos o cursos que ofrece"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Cómo vende actualmente</span>
              <textarea
                value={howSells}
                onChange={(event) => setHowSells(event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="WhatsApp, recomendaciones, tienda física, redes…"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">¿Ya vende?</span>
              <select
                value={currentlySelling}
                onChange={(event) =>
                  setCurrentlySelling(event.target.value as "" | "yes" | "no")
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Por confirmar</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">¿Hace anuncios?</span>
              <select
                value={runsAds}
                onChange={(event) =>
                  setRunsAds(event.target.value as "" | "yes" | "no")
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Por confirmar</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Plataformas de anuncios</span>
              <input
                value={adPlatforms}
                onChange={(event) => setAdPlatforms(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Meta, Google, TikTok"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Destino de anuncios</span>
              <input
                value={adDestination}
                onChange={(event) => setAdDestination(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="WhatsApp, formulario, página…"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Problema principal</span>
              <textarea
                value={mainProblem}
                onChange={(event) => setMainProblem(event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Qué le impide vender, cobrar, medir o dar seguimiento"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Objetivo principal</span>
              <textarea
                value={mainGoal}
                onChange={(event) => setMainGoal(event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Captar clientes, vender cursos, cobrar en línea…"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Funciones detectadas</span>
              <textarea
                value={requestedFeatures}
                onChange={(event) => setRequestedFeatures(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Separadas por comas"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Lead score</span>
              <input
                type="number"
                min={0}
                max={15}
                value={leadScore}
                onChange={(event) => setLeadScore(Number(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Intención</span>
              <select
                value={intentionLevel}
                onChange={(event) => setIntentionLevel(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="baja">Baja</option>
                <option value="posible">Posible</option>
                <option value="buena">Buena</option>
                <option value="alta">Alta</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Precio sugerido</span>
              <input
                type="number"
                min={0}
                value={suggestedPrice}
                onChange={(event) => setSuggestedPrice(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="10000"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Moneda</span>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value as "MXN" | "USD")}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Resumen del lead</span>
              <textarea
                value={conversationSummary}
                onChange={(event) => setConversationSummary(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Resumen comercial para la ficha del lead"
              />
            </label>
          </div>
        </div>

        {commercialAnalysis ? (
          <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-violet-600 shadow-sm">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-violet-950">
                  Diagnóstico comercial V1
                </p>
                <p className="mt-1 text-xs text-violet-800">
                  Confianza {commercialAnalysis.confidence}. Es una primera lectura automática,
                  no sustituye tu criterio antes de cotizar.
                </p>
                <ul className="mt-3 space-y-1 text-xs leading-5 text-violet-900">
                  {commercialAnalysis.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {inference ? (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 text-blue-600 shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-950">
                    Formulario prellenado automáticamente
                  </p>
                  <p className="mt-1 text-xs text-blue-800">
                    Confianza {inference.confidence}. Revisa los datos antes de importar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={redetectFields}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                <RefreshCw size={14} />
                Detectar otra vez
              </button>
            </div>
            <ul className="mt-3 space-y-1 text-xs leading-5 text-blue-900">
              {inference.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
        ) : null}

        {warnings.length > 0 ? (
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Se importó con {warnings.length} advertencias:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {warnings.slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!parsed || importing || loadingZip || transcribingAudios || analyzingImages || analyzingPdfs}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing || loadingZip || transcribingAudios || analyzingImages || analyzingPdfs ? <Loader2 className="animate-spin" size={18} /> : <Archive size={18} />}
          {importing ? "Importando…" : loadingZip ? "Leyendo ZIP…" : "Importar al CRM"}
        </button>

        {progress ? <p className="mt-3 text-center text-sm text-gray-500">{progress}</p> : null}
      </form>

      <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Vista previa</h2>
            <p className="mt-1 text-sm text-gray-500">Nada se guarda hasta que pulses Importar.</p>
          </div>
          {parsed ? <CheckCircle2 className="text-green-600" /> : <FileText className="text-gray-300" />}
        </div>

        {parsed ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-2xl font-bold">{parsed.messages.length}</p>
                <p className="mt-1 text-xs text-gray-500">Mensajes</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-2xl font-bold">{mediaNames.length}</p>
                <p className="mt-1 text-xs text-gray-500">Archivos</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-2xl font-bold">{parsed.participants.length}</p>
                <p className="mt-1 text-xs text-gray-500">Participantes</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="truncate text-sm font-bold">{chatFilename}</p>
                <p className="mt-1 text-xs text-gray-500">Chat</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700">Participantes detectados</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {parsed.participants.map((participant) => (
                  <span key={participant} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {participant}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700">Primeros mensajes</p>
              <div className="mt-3 space-y-3">
                {parsed.messages.slice(0, 8).map((message) => (
                  <div key={message.index} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-blue-700">{message.sender || "Sistema"}</p>
                      <p className="text-[11px] text-gray-400">{new Date(message.timestamp).toLocaleString("es-MX")}</p>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{message.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-96 items-center justify-center text-center">
            <div>
              <Archive className="mx-auto text-gray-300" size={44} />
              <p className="mt-4 font-semibold text-gray-600">Aquí aparecerá la conversación</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                Selecciona un ZIP para comprobar mensajes, participantes y adjuntos antes de importarlo.
              </p>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
