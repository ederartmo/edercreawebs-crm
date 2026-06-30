import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 30 * 1024 * 1024;

type PdfAnalysisResult = {
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

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function upstreamError(raw: string) {
  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed.error === "object" && parsed.error) {
    const msg = (parsed.error as { message?: string }).message;
    if (msg) return msg;
  }
  if (parsed && typeof parsed.message === "string") return parsed.message;
  return raw.slice(0, 400) || "Error desconocido de OpenAI.";
}

function stringValue(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function stringArray(v: unknown) {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Tu sesión expiró. Vuelve a iniciar sesión." },
      { status: 401 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta OPENAI_API_KEY en .env.local. Agrégala y reinicia npm run dev." },
      { status: 500 },
    );
  }

  try {
    const incoming = await request.formData();
    const file = incoming.get("file");
    const context = String(incoming.get("context") ?? "").slice(0, 1600);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No recibí un PDF válido." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo no parece ser un PDF." }, { status: 415 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "El PDF está vacío." }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "El PDF supera el límite de 30 MB." },
        { status: 413 },
      );
    }

    // ── 1. Upload PDF to OpenAI Files API ──────────────────────────────────
    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);
    uploadForm.append("purpose", "user_data");

    const uploadResponse = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    });

    const uploadRaw = await uploadResponse.text();
    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: `No pude subir el PDF a OpenAI: ${upstreamError(uploadRaw)}` },
        { status: 502 },
      );
    }

    const uploadedFile = safeJsonParse(uploadRaw) as { id?: string } | null;
    const fileId = uploadedFile?.id;
    if (!fileId) {
      return NextResponse.json(
        { error: "OpenAI no devolvió un file_id al subir el PDF." },
        { status: 502 },
      );
    }

    // ── 2. Analyze using Responses API with file_id ───────────────────────
    const model = process.env.OPENAI_DOCUMENT_MODEL ?? "gpt-4o-mini";

    const prompt = [
      "Analiza este PDF como parte del expediente comercial de un prospecto.",
      "El objetivo es completar un CRM sin inventar información.",
      context ? `Contexto previo del chat: ${context}` : "",
      "Identifica el negocio, giro, qué vende, servicios, productos, ubicaciones, teléfonos, correos, sitio web, experiencia, certificaciones, clientes o proyectos y hechos clave.",
      "Primero determina el rol del documento: material propio del prospecto, propuesta/cotización hecha por un proveedor, o documento desconocido.",
      "Si es una propuesta o cotización de desarrollo web, marketing, cursos o software, NO pongas esos entregables como lo que vende el prospecto.",
      "En ese caso, what_sells, services y products deben describir el negocio real del prospecto; los entregables del proveedor van únicamente en provider_deliverables.",
      "Usa el nombre del negocio, el título, el objetivo y el contexto del chat para inferir la oferta real, pero no inventes.",
      "Devuelve únicamente JSON válido con estas llaves exactas:",
      JSON.stringify({
        document_type: "catalogo|cotizacion|presentacion|contrato|folleto|propuesta|otro",
        document_role: "prospect_material|provider_proposal|unknown",
        title: "string",
        summary: "string",
        business_name: "string",
        industry: "string",
        what_sells: "string",
        provider_deliverables: ["string"],
        services: ["string"],
        products: ["string"],
        locations: ["string"],
        phones: ["string"],
        emails: ["string"],
        website: "string",
        years_experience: "string",
        certifications: ["string"],
        clients_or_projects: ["string"],
        key_facts: ["string"],
        detected_text: "string",
        confidence: "alta|media|baja",
      }),
      "detected_text debe contener un resumen compacto del texto más útil, no una transcripción completa.",
      "Si un dato no existe, usa cadena vacía o arreglo vacío.",
    ]
      .filter(Boolean)
      .join("\n");

    let analysisText = "";
    let analysisOk = false;

    try {
      const responsesPayload = {
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_file", file_id: fileId },
              { type: "input_text", text: prompt },
            ],
          },
        ],
      };

      const analysisResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(responsesPayload),
      });

      const analysisRaw = await analysisResponse.text();

      if (analysisResponse.ok) {
        const responseJson = safeJsonParse(analysisRaw);
        if (responseJson) {
          // Extract text from Responses API output
          const output = Array.isArray(responseJson.output) ? responseJson.output as unknown[] : [];
          const pieces: string[] = [];
          for (const item of output) {
            const typedItem = item as { content?: unknown[] };
            if (Array.isArray(typedItem.content)) {
              for (const part of typedItem.content) {
                const typedPart = part as { text?: string };
                if (typeof typedPart.text === "string") pieces.push(typedPart.text);
              }
            }
          }
          if (typeof responseJson.output_text === "string") {
            analysisText = responseJson.output_text as string;
          } else {
            analysisText = pieces.join("\n");
          }
          analysisOk = Boolean(analysisText);
        }
      }
    } catch {
      // Will fall through to chat completions fallback
    }

    // ── 3. Fallback: Chat Completions with file_id ────────────────────────
    if (!analysisOk) {
      const chatPayload = {
        model,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                file: { file_id: fileId },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      };

      const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chatPayload),
      });

      const chatRaw = await chatResponse.text();
      if (!chatResponse.ok) {
        return NextResponse.json(
          { error: `No pude analizar el PDF: ${upstreamError(chatRaw)}` },
          { status: 502 },
        );
      }

      const chatJson = safeJsonParse(chatRaw) as {
        choices?: Array<{ message?: { content?: string } }>;
      } | null;
      analysisText = chatJson?.choices?.[0]?.message?.content?.trim() ?? "";
    }

    // ── 4. Delete uploaded file (best-effort) ─────────────────────────────
    fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => undefined);

    // ── 5. Parse JSON result ──────────────────────────────────────────────
    const jsonText = analysisText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const result = safeJsonParse(jsonText);

    if (!result || typeof result.summary !== "string") {
      return NextResponse.json(
        { error: "El análisis del PDF llegó en un formato no esperado." },
        { status: 502 },
      );
    }

    const normalized: PdfAnalysisResult = {
      document_type: stringValue(result.document_type) || "otro",
      document_role: stringValue(result.document_role) || "unknown",
      title: stringValue(result.title),
      summary: stringValue(result.summary),
      business_name: stringValue(result.business_name),
      industry: stringValue(result.industry),
      what_sells: stringValue(result.what_sells),
      provider_deliverables: stringArray(result.provider_deliverables),
      services: stringArray(result.services),
      products: stringArray(result.products),
      locations: stringArray(result.locations),
      phones: stringArray(result.phones),
      emails: stringArray(result.emails),
      website: stringValue(result.website),
      years_experience: stringValue(result.years_experience),
      certifications: stringArray(result.certifications),
      clients_or_projects: stringArray(result.clients_or_projects),
      key_facts: stringArray(result.key_facts),
      detected_text: stringValue(result.detected_text),
      confidence:
        result.confidence === "alta" || result.confidence === "media" || result.confidence === "baja"
          ? result.confidence
          : "media",
    };

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pude analizar el PDF." },
      { status: 500 },
    );
  }
}
