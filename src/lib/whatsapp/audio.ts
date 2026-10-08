const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;

type MetaMediaInfo = {
  url?: string;
  mime_type?: string;
  file_size?: number;
  id?: string;
  error?: unknown;
};

type OpenAITranscriptionResponse = {
  text?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function extensionForMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "ogg";
}

async function downloadWhatsAppMedia(mediaId: string) {
  const accessToken = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const graphApiVersion = requiredEnv("WHATSAPP_GRAPH_API_VERSION");

  const infoResponse = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(mediaId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const info = (await infoResponse.json()) as MetaMediaInfo;
  if (!infoResponse.ok || !info.url) {
    throw new Error(
      `Could not resolve WhatsApp media (${infoResponse.status}): ${JSON.stringify(info.error ?? info)}`,
    );
  }

  if (typeof info.file_size === "number" && info.file_size > MAX_TRANSCRIPTION_BYTES) {
    throw new Error(`WhatsApp audio exceeds ${MAX_TRANSCRIPTION_BYTES} bytes`);
  }

  const mediaResponse = await fetch(info.url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!mediaResponse.ok) {
    throw new Error(`Could not download WhatsApp media (${mediaResponse.status})`);
  }

  const arrayBuffer = await mediaResponse.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_TRANSCRIPTION_BYTES) {
    throw new Error(`WhatsApp audio exceeds ${MAX_TRANSCRIPTION_BYTES} bytes`);
  }

  const mimeType =
    info.mime_type?.trim() ||
    mediaResponse.headers.get("content-type")?.trim() ||
    "audio/ogg";

  return {
    arrayBuffer,
    mimeType,
  };
}

export async function transcribeWhatsAppAudio(mediaId: string) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const model =
    process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe";
  const { arrayBuffer, mimeType } = await downloadWhatsAppMedia(mediaId);

  const form = new FormData();
  form.append(
    "file",
    new File([arrayBuffer], `whatsapp-audio.${extensionForMime(mimeType)}`, {
      type: mimeType,
    }),
  );
  form.append("model", model);
  form.append("response_format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `OpenAI transcription failed (${response.status}): ${detail.slice(0, 800)}`,
      );
    }

    const payload = (await response.json()) as OpenAITranscriptionResponse;
    const text = payload.text?.trim();
    if (!text) throw new Error("OpenAI transcription returned empty text");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
