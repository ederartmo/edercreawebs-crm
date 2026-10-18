import { parseResourceSubscription, saveResourceSubscription } from "@/lib/resources/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const reply = (body: object, status: number) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  if (process.env.RESOURCES_WEB_ENABLED !== "true") return reply({ error: "subscription_unavailable" }, 503);
  const origin = process.env.RESOURCES_WEB_ORIGIN?.trim();
  if (!origin || request.headers.get("origin") !== origin) return reply({ error: "invalid_origin" }, 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) return reply({ error: "invalid_request" }, 415);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "invalid_request" }, 400);
  try {
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2048) { await reader.cancel(); return reply({ error: "request_too_large" }, 413); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let input;
    try { input = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { return reply({ error: "invalid_request" }, 400); }
    const subscription = parseResourceSubscription(input);
    if (!subscription) return reply({ error: "invalid_subscription" }, 400);
    await saveResourceSubscription(subscription);
    if (process.env.RESOURCES_CONFIRMATION_ENABLED === "true") {
      const { sendResourceConfirmation } = await import("@/lib/resources/confirmation");
      await sendResourceConfirmation(subscription.email);
      return reply({ ok: true, requiresConfirmation: true }, 200);
    }
    return reply({ ok: true }, 200);
  } catch {
    return reply({ error: "subscription_unavailable" }, 503);
  } finally {
    reader.releaseLock();
  }
}
