import "server-only";
import { createHash } from "node:crypto";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const metaLeadEventId = (leadId: string) => `lead_${hash(leadId)}`;
export type MetaLead = {
  leadId: string;
  materializedAt: string;
  marketing: boolean;
  email?: string | null;
  phone?: string | null;
};

/** No durable queue: a finalize retry reuses the original event ID and event time. */
export async function sendMetaLead(input: MetaLead): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (input.marketing !== true) return false;
    const dataset = process.env.META_DATASET_ID?.trim();
    const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
    if (!dataset || !/^\d+$/.test(dataset) || !token) return false;
    const eventTime = Math.floor(Date.parse(input.materializedAt) / 1000);
    if (!Number.isFinite(eventTime)) return false;
    const userData: Record<string, string[]> = { external_id: [hash(input.leadId)] };
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.replace(/[^0-9]/g, "").replace(/^00/, "");
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) userData.em = [hash(email)];
    // No invented country code; only declared international numbers are usable.
    if (phone && /^[1-9]\d{10,14}$/.test(phone)) userData.ph = [hash(phone)];
    const payload: Record<string, unknown> = { data: [{
      event_name: "Lead", event_time: eventTime, event_id: metaLeadEventId(input.leadId),
      action_source: "website", event_source_url: "https://edercreawebs.com", user_data: userData,
    }] };
    const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
    if (testCode) payload.test_event_code = testCode;
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`https://graph.facebook.com/v25.0/${dataset}/events`, {
      method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    return response.ok;
  } catch { return false; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
