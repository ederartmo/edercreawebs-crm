import { createAdminClient } from "@/lib/supabase/admin";

export const RESOURCE_CONSENT_VERSION = "recursos-v1";
export type ResourceSubscription = { email: string; source: "recursos"; consent_version: string };

export function parseResourceSubscription(value: unknown): ResourceSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.consent !== true || input.consentVersion !== RESOURCE_CONSENT_VERSION) return null;
  if (typeof input.website !== "string" || input.website.trim()) return null;
  if (typeof input.email !== "string") return null;
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)) return null;
  if (email.startsWith(".") || email.split("@")[0].endsWith(".") || email.includes("..")) return null;
  return { email, source: "recursos", consent_version: RESOURCE_CONSENT_VERSION };
}

export async function saveResourceSubscription(subscription: ResourceSubscription) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") !== "https://ycdosrsanutbhbgejwwg.supabase.co") throw new Error("invalid_resources_database");
  // Repeated signups preserve the original authorization date and any recorded opt-out.
  const { error } = await createAdminClient().from("resource_subscribers")
    .upsert(subscription, { onConflict: "email", ignoreDuplicates: true })
    .abortSignal(AbortSignal.timeout(8000));
  if (error) throw new Error("subscription_unavailable");
}
