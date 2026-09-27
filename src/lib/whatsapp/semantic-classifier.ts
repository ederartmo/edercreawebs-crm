export type WhatsAppQualificationStage = "business_context" | "sales_process";

export type WhatsAppReplyClassification = {
  status:
    | "complete"
    | "incomplete"
    | "needs_clarification"
    | "other_question"
    | "off_topic"
    | "uncertain";
  extracted_answer: string;
  missing_information: Array<"what_sells" | "lead_source" | "sales_process">;
  confidence: number;
  reason: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: [
        "complete",
        "incomplete",
        "needs_clarification",
        "other_question",
        "off_topic",
        "uncertain",
      ],
    },
    extracted_answer: { type: "string" },
    missing_information: {
      type: "array",
      items: {
        type: "string",
        enum: ["what_sells", "lead_source", "sales_process"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
  required: [
    "status",
    "extracted_answer",
    "missing_information",
    "confidence",
    "reason",
  ],
} as const;

function getOutputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text.trim();
      }
    }
  }

  return "";
}

function isClassification(value: unknown): value is WhatsAppReplyClassification {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WhatsAppReplyClassification>;
  return (
    [
      "complete",
      "incomplete",
      "needs_clarification",
      "other_question",
      "off_topic",
      "uncertain",
    ].includes(item.status ?? "") &&
    typeof item.extracted_answer === "string" &&
    Array.isArray(item.missing_information) &&
    typeof item.confidence === "number" &&
    typeof item.reason === "string"
  );
}

function unavailableClassification(
  stage: WhatsAppQualificationStage,
  reason: string,
): WhatsAppReplyClassification {
  return {
    status: "uncertain",
    extracted_answer: "",
    missing_information:
      stage === "business_context"
        ? ["what_sells", "lead_source"]
        : ["sales_process"],
    confidence: 0,
    reason,
  };
}

export async function classifyWhatsAppReply(args: {
  stage: WhatsAppQualificationStage;
  question: string;
  message: string;
  knownContext?: string;
}): Promise<WhatsAppReplyClassification> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("WhatsApp semantic classifier skipped: OPENAI_API_KEY is not configured");
    return unavailableClassification(
      args.stage,
      "OPENAI_API_KEY is not configured; classification was not attempted",
    );
  }

  const model = process.env.WHATSAPP_CLASSIFIER_MODEL?.trim() || "gpt-4o-mini";
  const stageRequirements =
    args.stage === "business_context"
      ? [
          "For business_context, a complete answer must provide both: what the business sells/does AND where customers currently come from.",
          "If only one is present across known context plus the latest message, use status=incomplete and report the missing field as what_sells or lead_source.",
        ].join(" ")
      : [
          "For sales_process, a complete answer must describe what happens after a prospect shows interest until a quote, booking, payment, purchase, or next commercial step.",
          "If that process is not actually described across known context plus the latest message, use incomplete or needs_clarification as appropriate and include sales_process in missing_information.",
        ].join(" ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            role: "system",
            content: [
              "You are a semantic classifier for a Spanish-language sales qualification flow on WhatsApp.",
              "Your job is ONLY to interpret whether the prospect's latest message, together with any known context from earlier replies in the same stage, answers the bot's current question.",
              "Do not invent facts and do not answer the prospect.",
              "Use needs_clarification when the person indicates confusion or asks what the question means, regardless of wording, spelling, slang, abbreviations, or punctuation.",
              "Use other_question when the person asks something else instead of answering the current question.",
              "Use off_topic for unrelated content.",
              "Use uncertain when intent cannot be determined reliably.",
              "extracted_answer must contain the combined usable facts from known context and the latest prospect message, but only facts the prospect actually stated. If there is no usable answer, return an empty string.",
              stageRequirements,
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Stage: ${args.stage}`,
              `Bot question: ${args.question}`,
              `Known context from earlier replies: ${args.knownContext?.trim() || "None"}`,
              `Latest prospect message: ${args.message}`,
            ].join("\n"),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "whatsapp_reply_classification",
            strict: true,
            schema: CLASSIFICATION_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(
        `WhatsApp semantic classifier failed (${response.status}): ${detail.slice(0, 500)}`,
      );
      return unavailableClassification(
        args.stage,
        `OpenAI classifier request failed with HTTP ${response.status}`,
      );
    }

    const payload = (await response.json()) as OpenAIResponse;
    const outputText = getOutputText(payload);
    if (!outputText) {
      console.error("WhatsApp semantic classifier returned no output text");
      return unavailableClassification(
        args.stage,
        "OpenAI classifier returned no output text",
      );
    }

    const parsed = JSON.parse(outputText) as unknown;
    if (!isClassification(parsed)) {
      console.error("WhatsApp semantic classifier returned an invalid shape");
      return unavailableClassification(
        args.stage,
        "OpenAI classifier returned an invalid structured response",
      );
    }

    return parsed;
  } catch (error) {
    console.error("WhatsApp semantic classifier error", error);
    return unavailableClassification(
      args.stage,
      "OpenAI classifier request threw or timed out",
    );
  } finally {
    clearTimeout(timeout);
  }
}
