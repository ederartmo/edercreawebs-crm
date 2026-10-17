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


const META_CONTACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const META_PIXEL_VALUE = /^[A-Za-z0-9._!:-]{1,300}$/;

export const metaContactEventId = (eventId: string) => `contact_${eventId.toLowerCase()}`;

export type MetaContact = {
  eventId: string;
  occurredAt: string;
  marketing: boolean;
  externalId: string;
  fbp?: string | null;
  fbc?: string | null;
};

/** WhatsApp Contact conversion. Uses the browser UUID so Pixel + CAPI share one event_id. */
export async function sendMetaContact(input: MetaContact): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (input.marketing !== true) return false;
    if (!META_CONTACT_UUID.test(input.eventId)) return false;

    const dataset = process.env.META_DATASET_ID?.trim();
    const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
    if (!dataset || !/^\d+$/.test(dataset) || !token) return false;

    const eventTime = Math.floor(Date.parse(input.occurredAt) / 1000);
    if (!Number.isFinite(eventTime)) return false;

    const userData: Record<string, string | string[]> = {
      external_id: [hash(input.externalId)],
    };

    const fbp = input.fbp?.trim();
    const fbc = input.fbc?.trim();

    if (fbp && META_PIXEL_VALUE.test(fbp)) userData.fbp = fbp;
    if (fbc && META_PIXEL_VALUE.test(fbc)) userData.fbc = fbc;

    const payload: Record<string, unknown> = {
      data: [{
        event_name: "Contact",
        event_time: eventTime,
        event_id: metaContactEventId(input.eventId),
        action_source: "website",
        event_source_url: "https://edercreawebs.com",
        user_data: userData,
      }],
    };

    const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
    if (testCode) payload.test_event_code = testCode;

    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(
      `https://graph.facebook.com/v25.0/${dataset}/events`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    return response.ok;
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
