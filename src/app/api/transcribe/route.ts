import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
]);

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function normalizeAudioFilename(filename: string) {
  const extension = extensionOf(filename);

  // WhatsApp normalmente exporta notas de voz como .opus dentro de un
  // contenedor Ogg. La API acepta Ogg, así que conservamos los bytes y
  // cambiamos únicamente el nombre que se envía.
  if (extension === "opus") {
    return `${filename.slice(0, -5)}.ogg`;
  }

  return filename;
}

function upstreamErrorMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed.error?.message || parsed.message || "OpenAI rechazó el audio.";
  } catch {
    return raw.slice(0, 500) || "OpenAI rechazó el audio.";
  }
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
      {
        error:
          "Falta OPENAI_API_KEY en .env.local. Agrégala y reinicia npm run dev.",
      },
      { status: 500 },
    );
  }

  try {
    const incoming = await request.formData();
    const file = incoming.get("file");
    const context = String(incoming.get("context") ?? "").slice(0, 1200);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No recibí un archivo de audio válido." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "El archivo de audio está vacío." },
        { status: 400 },
      );
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "La nota de voz supera el límite de 25 MB." },
        { status: 413 },
      );
    }

    const normalizedFilename = normalizeAudioFilename(file.name);
    const extension = extensionOf(normalizedFilename);

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          error: `Formato no soportado: .${extension || "desconocido"}.`,
        },
        { status: 415 },
      );
    }

    const upstream = new FormData();
    upstream.append("file", file, normalizedFilename);
    upstream.append(
      "model",
      process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    );
    upstream.append("response_format", "json");
    upstream.append("language", "es");
    upstream.append(
      "prompt",
      [
        "Transcribe fielmente esta nota de voz de WhatsApp en español de México.",
        "Conserva nombres de negocios, plataformas, precios, fechas, servicios y términos técnicos como Stripe, Wix, Meta Ads, Pixel y WhatsApp.",
        context ? `Contexto comercial: ${context}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: upstream,
      },
    );

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: upstreamErrorMessage(raw) },
        { status: response.status >= 400 && response.status < 500 ? 400 : 502 },
      );
    }

    const result = JSON.parse(raw) as { text?: string };
    const text = result.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "La transcripción llegó vacía." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      text,
      model:
        process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
      filename: file.name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pude transcribir la nota de voz.",
      },
      { status: 500 },
    );
  }
}
