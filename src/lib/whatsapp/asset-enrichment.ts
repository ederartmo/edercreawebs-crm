import { createAdminClient } from "@/lib/supabase/admin";
import { tryPrepareVisualProposalDraft } from "@/lib/whatsapp/proposal-prep";

type OpenAIAnnotation = {
  type?: string;
  url?: string;
  title?: string;
};

type OpenAIContent = {
  type?: string;
  text?: string;
  annotations?: OpenAIAnnotation[];
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIContent[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
};

type EnrichmentProfile = {
  business_name: string;
  business_type: string;
  location: string;
  services: string[];
  products: string[];
  brand_colors: string[];
  visual_style: string;
  useful_image_notes: string[];
  testimonials: string[];
  missing_information: string[];
  summary: string;
  confidence: number;
};

const ENRICHMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    business_name: { type: "string" },
    business_type: { type: "string" },
    location: { type: "string" },
    services: { type: "array", items: { type: "string" } },
    products: { type: "array", items: { type: "string" } },
    brand_colors: { type: "array", items: { type: "string" } },
    visual_style: { type: "string" },
    useful_image_notes: { type: "array", items: { type: "string" } },
    testimonials: { type: "array", items: { type: "string" } },
    missing_information: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "business_name",
    "business_type",
    "location",
    "services",
    "products",
    "brand_colors",
    "visual_style",
    "useful_image_notes",
    "testimonials",
    "missing_information",
    "summary",
    "confidence",
  ],
} as const;

function getOutputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        const text = content.text.trim();
        if (text) chunks.push(text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function getSourceUrls(response: OpenAIResponse) {
  const urls = new Set<string>();
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (typeof annotation.url === "string" && annotation.url.trim()) {
          urls.add(annotation.url.trim());
        }
      }
    }
  }
  return [...urls].slice(0, 12);
}

function getMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function callOpenAI(body: Record<string, unknown>, timeoutMs = 45000) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `OpenAI asset enrichment failed (${response.status}): ${detail.slice(0, 1000)}`,
      );
    }

    return (await response.json()) as OpenAIResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function researchReference(args: {
  url: string;
  assetType: string;
  knownBusinessContext: string | null;
  knownSalesProcess: string | null;
}) {
  const model = process.env.WHATSAPP_ENRICHMENT_MODEL?.trim() || "gpt-5.6-sol";
  const response = await callOpenAI({
    model,
    store: false,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search", external_web_access: true }],
    tool_choice: "required",
    instructions: [
      "Research one business reference for Eder Crea Webs.",
      "Use public web information only and focus on the exact business/profile supplied.",
      "Do not guess facts that are not supported by what you can find.",
      "If the social profile itself is unavailable, use search results or the business website only when they clearly refer to the same business.",
      "Return concise research notes useful for preparing a visual web proposal: business name/type, location if public, services/products, visible brand/visual cues, useful public images or content themes, testimonials/reviews if clearly attributable, and what remains unknown.",
      "Explicitly say when information could not be verified.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          `Reference type: ${args.assetType}`,
          `Reference URL: ${args.url}`,
          `Known business context from the lead: ${args.knownBusinessContext ?? "none"}`,
          `Known sales process from the lead: ${args.knownSalesProcess ?? "none"}`,
          "Investigate this reference once and produce factual notes for a later visual proposal.",
        ].join("\n"),
      },
    ],
  });

  return {
    notes: getOutputText(response),
    sources: getSourceUrls(response),
  };
}

async function structureResearch(args: {
  notes: string;
  sources: string[];
  url: string;
  knownBusinessContext: string | null;
}) {
  const model = process.env.WHATSAPP_ENRICHMENT_MODEL?.trim() || "gpt-5.6-sol";
  const response = await callOpenAI({
    model,
    store: false,
    reasoning: { effort: "low" },
    instructions: [
      "Turn research notes into a compact CRM profile.",
      "Use only information present in the research notes or known lead context.",
      "Never invent colors, location, services, products, reviews, or business identity.",
      "For unknown string fields use an empty string. For unknown lists use an empty array.",
      "Keep the profile compact because it will be injected into later sales-agent turns.",
    ].join("\n"),
    text: {
      format: {
        type: "json_schema",
        name: "business_enrichment_profile",
        strict: true,
        schema: ENRICHMENT_SCHEMA,
      },
    },
    input: [
      {
        role: "user",
        content: [
          `Reference URL: ${args.url}`,
          `Known lead context: ${args.knownBusinessContext ?? "none"}`,
          `Research sources: ${args.sources.join(" | ") || "none"}`,
          "Research notes:",
          args.notes || "No reliable public information was recovered.",
        ].join("\n"),
      },
    ],
  });

  const text = getOutputText(response);
  if (!text) throw new Error("Asset enrichment structuring returned no output");

  const parsed = JSON.parse(text) as EnrichmentProfile;
  if (!parsed || typeof parsed !== "object" || typeof parsed.summary !== "string") {
    throw new Error("Asset enrichment structuring returned an invalid profile");
  }
  return parsed;
}

async function enrichReferenceAsset(assetId: string) {
  const supabase = createAdminClient();
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id,lead_id,external_url,metadata")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) throw assetError;
  if (!asset) throw new Error("Asset not found for enrichment");
  if (!asset.external_url) throw new Error("Asset has no external URL to enrich");

  const metadata = getMetadata(asset.metadata);
  const currentStatus = typeof metadata.enrichment_status === "string"
    ? metadata.enrichment_status
    : "pending";
  if (currentStatus === "complete") {
    return { ok: true, skipped: true, reason: "already_complete", leadId: asset.lead_id };
  }

  const startedAt = new Date().toISOString();
  const { error: processingError } = await supabase
    .from("assets")
    .update({
      metadata: {
        ...metadata,
        enrichment_status: "processing",
        enrichment_started_at: startedAt,
        enrichment_error: null,
      },
    })
    .eq("id", assetId);
  if (processingError) throw processingError;

  try {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("what_sells,how_sells")
      .eq("id", asset.lead_id)
      .maybeSingle();
    if (leadError) throw leadError;

    const assetType = typeof metadata.asset_type === "string"
      ? metadata.asset_type
      : "business_reference";

    const research = await researchReference({
      url: asset.external_url,
      assetType,
      knownBusinessContext: lead?.what_sells?.trim() || null,
      knownSalesProcess: lead?.how_sells?.trim() || null,
    });

    const profile = await structureResearch({
      notes: research.notes,
      sources: research.sources,
      url: asset.external_url,
      knownBusinessContext: lead?.what_sells?.trim() || null,
    });

    const completedAt = new Date().toISOString();
    const { error: saveError } = await supabase
      .from("assets")
      .update({
        extracted_text: JSON.stringify(profile),
        metadata: {
          ...metadata,
          enrichment_status: "complete",
          enrichment_started_at: startedAt,
          enrichment_completed_at: completedAt,
          enrichment_sources: research.sources,
          enrichment_profile: profile,
          enrichment_error: null,
        },
      })
      .eq("id", assetId);
    if (saveError) throw saveError;

    return {
      ok: true,
      skipped: false,
      profile,
      sources: research.sources,
      leadId: asset.lead_id,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = errorMessage(error).slice(0, 1000);
    const { error: failedUpdateError } = await supabase
      .from("assets")
      .update({
        metadata: {
          ...metadata,
          enrichment_status: "failed",
          enrichment_started_at: startedAt,
          enrichment_failed_at: failedAt,
          enrichment_error: message,
        },
      })
      .eq("id", assetId);

    if (failedUpdateError) {
      console.error("Could not persist WhatsApp asset enrichment failure", failedUpdateError);
    }
    throw error;
  }
}

export async function enrichBusinessReferenceAsset(assetId: string) {
  const { leadId, ...enrichment } = await enrichReferenceAsset(assetId);
  // Separate step, outside enrichment's catch. Complete assets also retry prep.
  const proposalPrep = await tryPrepareVisualProposalDraft({ leadId, sourceAssetId: assetId });
  return { ...enrichment, proposalPrep };
}
