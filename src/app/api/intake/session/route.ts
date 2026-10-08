import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createIntakeSession, editSessionAnswer, finalizeIntakeSession, getIntakeSession, issueContinuation, saveSessionAnswer } from "@/lib/intake/service";
import { parseWebIntakeInput } from "@/lib/intake/web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "ecw_intake";
const WEB_COOKIE = "ecw_web_session";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
async function token() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw Error("session_unavailable");
  return value;
}
/** Path=/ web cookie travels here too; only its presence matters, never what the browser claims. */
async function webSessionToken() {
  const value = (await cookies()).get(WEB_COOKIE)?.value;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export async function GET() {
  if (process.env.INTAKE_WEB_ENABLED !== "true") return NextResponse.json({ error: "disabled" }, { status: 503, headers });
  try { return NextResponse.json(await getIntakeSession(await token()), { headers }); }
  catch { return NextResponse.json({ error: "session_unavailable" }, { status: 404, headers }); }
}
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
    const input = parseWebIntakeInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const webToken = await webSessionToken();
    if (input.action === "create") {
      const existing = (await cookies()).get(COOKIE)?.value;
      if (existing && /^[a-f0-9]{64}$/.test(existing)) {
        try { return NextResponse.json(await getIntakeSession(existing), { headers }); } catch { /* expired */ }
      }
      const { token: sessionToken, ...state } = await createIntakeSession(input.attribution, webToken);
      const response = NextResponse.json(state, { status: 201, headers });
      response.cookies.set(COOKIE, sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/intake", maxAge: 30 * 86400 });
      return response;
    }
    const sessionToken = await token();
    if (input.action === "continue") return NextResponse.json(await issueContinuation(sessionToken), { headers });
    if (input.action === "finalize") return NextResponse.json(await finalizeIntakeSession(sessionToken, webToken, input.meta_marketing), { headers });
    if ("mode" in input && input.mode === "edit") return NextResponse.json(await editSessionAnswer(sessionToken, input.field, input.value), { headers });
    return NextResponse.json(await saveSessionAnswer(sessionToken, input.answers), { headers });
  } catch { return NextResponse.json({ error: "invalid_or_unavailable_session" }, { status: 400, headers }); }
}
