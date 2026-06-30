import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function mimeForExtension(ext: string) {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "image/jpeg";
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
    const context = String(incoming.get("context") ?? "").slice(0, 800);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No recibí un archivo de imagen válido." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "El archivo de imagen está vacío." },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "La imagen supera el límite de 15 MB." },
        { status: 413 },
      );
    }

    const ext = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext === "heic" ? "jpg" : ext)) {
      return NextResponse.json(
        { error: `Formato no soportado: .${ext || "desconocido"}.` },
        { status: 415 },
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mime = mimeForExtension(ext);
    const dataUrl = `data:${mime};base64,${base64}`;

    const systemPrompt = [
      "Eres un asistente experto en analizar imágenes de chats de WhatsApp para una agencia de desarrollo web llamada EderCreaWebs.",
      "Tu tarea es clasificar la imagen y extraer información comercial relevante.",
      "Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código.",
      "El objeto debe tener exactamente estas propiedades:",
      '  "kind": uno de ["payment_proof","logo_or_brand","social_or_web_screenshot","document_photo","product_or_service","other"]',
      '  "summary": string — descripción breve en español de qué muestra la imagen (máx. 120 caracteres)',
      '  "business_name": string — nombre del negocio si se detecta, si no ""',
      '  "detected_text": string — texto relevante extraído de la imagen (máx. 300 caracteres)',
      '  "is_payment_proof": boolean — true si es un comprobante de transferencia, depósito, SPEI o pago',
      '  "amount": number | null — monto del pago si es comprobante, si no null',
      '  "currency": "MXN" | "USD" | null — moneda detectada',
      '  "bank_name": string — nombre del banco si es comprobante, si no ""',
      '  "beneficiary": string — nombre del beneficiario si es comprobante, si no ""',
      '  "reference": string — número de referencia o rastreo si es comprobante, si no ""',
      '  "confidence": "alta" | "media" | "baja" — confianza general del análisis',
    ].join("\n");

    const userPrompt = [
      "Analiza esta imagen de WhatsApp.",
      context ? `Contexto del negocio: ${context}` : "",
      "Si es un comprobante de pago, extrae el monto exacto, banco, beneficiario y referencia.",
      "Si contiene un nombre de negocio visible, capturalo en business_name.",
    ]
      .filter(Boolean)
      .join("\n");

    const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            ],
          },
        ],
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      let message = "OpenAI rechazó la solicitud.";
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        message = parsed.error?.message ?? message;
      } catch {
        // ignore
      }
      return NextResponse.json(
        { error: message },
        { status: response.status >= 400 && response.status < 500 ? 400 : 502 },
      );
    }

    const completion = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = completion.choices?.[0]?.message?.content?.trim() ?? "";

    if (!content) {
      return NextResponse.json(
        { error: "OpenAI devolvió una respuesta vacía." },
        { status: 502 },
      );
    }

    // Strip markdown code fences if the model wrapped the JSON
    const jsonText = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "No pude interpretar la respuesta del modelo como JSON." },
        { status: 502 },
      );
    }

    // Ensure required fields exist with safe defaults
    const result = {
      kind: analysis.kind ?? "other",
      summary: analysis.summary ?? "",
      business_name: analysis.business_name ?? "",
      detected_text: analysis.detected_text ?? "",
      is_payment_proof: Boolean(analysis.is_payment_proof),
      amount: typeof analysis.amount === "number" && Number.isFinite(analysis.amount)
        ? analysis.amount
        : null,
      currency: analysis.currency === "USD" ? "USD" : analysis.currency === "MXN" ? "MXN" : null,
      bank_name: analysis.bank_name ?? "",
      beneficiary: analysis.beneficiary ?? "",
      reference: analysis.reference ?? "",
      confidence: ["alta", "media", "baja"].includes(String(analysis.confidence))
        ? analysis.confidence
        : "baja",
      model,
      filename: file.name,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pude analizar la imagen.",
      },
      { status: 500 },
    );
  }
}
