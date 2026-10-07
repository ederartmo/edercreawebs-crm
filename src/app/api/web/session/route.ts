import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseWebSessionInput } from "@/lib/web/parse";
import { createWebSession, heartbeatWebSession, recordWebEvent } from "@/lib/web/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "ecw_web_session";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request) {
  if (process.env.INTAKE_WEB_ENABLED !== "true") return NextResponse.json({ error: "disabled" }, { status: 503, headers });
  // Exact configured public origin; never trust a caller-supplied Host for authorization.
  if (!process.env.INTAKE_WEB_ORIGIN || request.headers.get("origin") !== process.env.INTAKE_WEB_ORIGIN) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "invalid_content_type" }, { status: 415, headers });
  try {
    // Enforce streamed size, even with absent/lying Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw Error("invalid_input");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12000) { await reader.cancel(); return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers }); }
      chunks.push(value);
    }
    const input = parseWebSessionInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const cookie = (await cookies()).get(COOKIE)?.value;
    // Identity is exclusively this opaque cookie: no session_id, owner_id or lead_id from the client.
    const token = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : undefined;

    if (input.action === "create") {
      const session = await createWebSession({ ...input, token });
      const response = NextResponse.json({ ok: true, reference_code: session.reference_code, status: session.status }, { status: session.created ? 201 : 200, headers });
      response.cookies.set(COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
      return response;
    }
    if (!token) throw Error("session_unavailable");
    if (input.action === "event") return NextResponse.json(await recordWebEvent(token, input), { headers });
    return NextResponse.json(await heartbeatWebSession(token, input), { headers });
  } catch { return NextResponse.json({ error: "invalid_or_unavailable_session" }, { status: 400, headers }); }
}
