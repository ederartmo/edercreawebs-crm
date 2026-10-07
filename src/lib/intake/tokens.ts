import { createHash, randomBytes, randomUUID } from "node:crypto";

export function createSessionToken() { return randomBytes(32).toString("hex"); }
export function createContinuationCode() { return `ECW-${randomBytes(12).toString("hex").toUpperCase()}`; }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
/** Public web-tracking identifiers: opaque, server-minted and never client-supplied. */
export function createEventId() { return randomUUID(); }
export function extractContinuationCode(text: string) { return text.match(/\bECW-[A-F0-9]{24}\b/i)?.[0].toUpperCase() ?? null; }
export function redactContinuationCode(text: string) { return text.replace(/\bECW-[A-F0-9]{24}\b/gi, "[referencia de continuidad]"); }
