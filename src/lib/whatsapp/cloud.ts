import { createHmac, timingSafeEqual } from "node:crypto";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

type SendWhatsAppTextResponse = {
  messages?: Array<{ id?: string }>;
  error?: unknown;
};

export async function sendWhatsAppText(to: string, body: string) {
  const accessToken = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
  const graphApiVersion = requiredEnv("WHATSAPP_GRAPH_API_VERSION");

  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body,
        },
      }),
    },
  );

  const payload = (await response.json()) as SendWhatsAppTextResponse;

  if (!response.ok) {
    throw new Error(
      `WhatsApp Cloud API error (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  return payload.messages?.[0]?.id ?? null;
}

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null) {
  const appSecret = process.env.META_APP_SECRET?.trim();

  // During the first connection test this can be omitted. In production,
  // configure META_APP_SECRET so every POST is authenticated.
  if (!appSecret) return true;
  if (!signature?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signature.slice("sha256=".length);

  if (expected.length !== received.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
