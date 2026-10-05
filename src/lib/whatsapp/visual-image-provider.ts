import "server-only";

// Official Images API contract reviewed 2026-10-05. One request, no SDK retries.
// https://developers.openai.com/api/docs/guides/image-generation
// https://developers.openai.com/api/reference/resources/images/methods/edit
export const IMAGE_MODEL = "gpt-image-2.5-sunburst-2026-09-08";
export const IMAGE_SIZE = "864x1536"; // exact 9:16; both dimensions divisible by 16
export type ImageInput = { asset_id: string; role: string; bytes: Uint8Array; mime_type: string };
export type ImageResult = { bytes: Uint8Array; request_id: string | null };
export class ImageProviderFailure extends Error {
  constructor(public readonly outcome: "known_failure" | "unknown", public readonly requestId: string | null = null) {
    super(`image_provider_${outcome}`);
  }
}

export function assertMobilePng(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.length < 45 || b.length > 20 * 1024 * 1024
    || b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    || b.subarray(12, 16).toString() !== "IHDR"
    || b.readUInt32BE(16) !== 864 || b.readUInt32BE(20) !== 1536) throw new Error("invalid_mobile_png");
}

export function assertImageProviderConfigured() {
  if (process.env.WHATSAPP_VISUAL_GENERATION_ENABLED !== "true") throw new Error("visual_generation_disabled");
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("visual_api_key_unavailable");
}

export async function generateScreenImage(args: { prompt: string; inputs: ImageInput[] }): Promise<ImageResult> {
  assertImageProviderConfigured();
  if (args.inputs.length > 5 || args.prompt.length > 32000) throw new Error("visual_input_limit");
  const body = {
    model: IMAGE_MODEL, prompt: args.prompt, n: 1, size: IMAGE_SIZE, quality: "high", output_format: "png", background: "opaque",
    ...(args.inputs.length ? { images: args.inputs.map(input => ({
      image_url: `data:${input.mime_type};base64,${Buffer.from(input.bytes).toString("base64")}`,
    })) } : {}),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  let requestId: string | null = null;
  try {
    const response = await fetch(`https://api.openai.com/v1/images/${args.inputs.length ? "edits" : "generations"}`, {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const id = response.headers.get("x-request-id");
    requestId = id && /^[a-zA-Z0-9_-]{1,200}$/.test(id) ? id : null;
    if (!response.ok) {
      // Timeouts/server errors can occur AFTER paid work. Never blindly retry them.
      throw new ImageProviderFailure([400, 401, 403, 404, 413, 422, 429].includes(response.status) ? "known_failure" : "unknown", requestId);
    }
    const result = await response.json();
    if (!Array.isArray(result.data) || result.data.length !== 1 || typeof result.data[0]?.b64_json !== "string"
      || result.data[0].b64_json.length > 28 * 1024 * 1024) throw new ImageProviderFailure("unknown", requestId);
    const bytes = Buffer.from(result.data[0].b64_json, "base64");
    assertMobilePng(bytes);
    return { bytes, request_id: requestId };
  } catch (error) {
    if (error instanceof ImageProviderFailure) throw error;
    throw new ImageProviderFailure("unknown", requestId);
  } finally { clearTimeout(timer); }
}
