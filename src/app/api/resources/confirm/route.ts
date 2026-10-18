import { randomBytes } from "node:crypto";
import { confirmationOrigin, confirmResourceSubscription } from "@/lib/resources/confirmation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const nonce = randomBytes(18).toString("base64");
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirma tu correo · EderCreaWebs</title><style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;padding:24px;min-height:100vh;display:grid;place-items:center;background:#f6f6f4;color:#111;font-family:Arial,sans-serif}main{width:min(100%,420px);padding:28px;border:1px solid #ddd;border-radius:18px;background:white}b{font-size:19px}h1{margin:30px 0 16px;font-size:28px}p{font-size:15px;line-height:1.6}button{width:100%;min-height:48px;padding:12px;margin-top:16px;border:0;border-radius:10px;background:#111;color:white;font-size:15px;font-weight:700;cursor:pointer}button:disabled{opacity:.55}button:focus-visible{outline:3px solid #777;outline-offset:3px}a{color:#111}</style><main><b>EderCreaWebs</b><h1>Confirma tu correo</h1><p id="status" role="status">Pulsa el botón para activar los avisos de nuevos recursos.</p><button id="confirm" type="button" disabled>Confirmar suscripción</button><p><a href="https://edercreawebs.com">Volver a EderCreaWebs</a></p></main><script nonce="${nonce}">const params=new URLSearchParams(location.hash.slice(1));const token=params.get('token');history.replaceState(null,'',location.pathname);const button=document.getElementById('confirm'),status=document.getElementById('status');if(token&&token.length<513){button.disabled=false}else{status.textContent='Abre el enlace que te enviamos por correo para confirmar.'}button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Confirmando…';try{const response=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const data=await response.json();if(!response.ok||data.ok!==true)throw Error();status.textContent='Tu correo quedó confirmado. Te avisaremos cuando publiquemos nuevos recursos.';button.remove()}catch{status.textContent='No pudimos confirmar el enlace. Puede haber vencido; vuelve a registrarte en Recursos.';button.disabled=false}});</script></html>`;
  return new Response(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'` } });
}

export async function POST(request: Request) {
  const reply = (body: object, status: number) => Response.json(body, { status, headers });
  try {
    if (process.env.RESOURCES_CONFIRMATION_ENABLED !== "true") return reply({ error: "confirmation_unavailable" }, 503);
    if (request.headers.get("origin") !== confirmationOrigin()) return reply({ error: "invalid_origin" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "invalid_request" }, 415);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "invalid_request" }, 400);
    let body = "";
    let size = 0;
    try {
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024) { await reader.cancel(); return reply({ error: "invalid_request" }, 413); }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
    let input;
    try { input = JSON.parse(body); } catch { return reply({ error: "invalid_request" }, 400); }
    if (!await confirmResourceSubscription(input?.token)) return reply({ error: "invalid_or_expired" }, 400);
    return reply({ ok: true }, 200);
  } catch { return reply({ error: "confirmation_unavailable" }, 503); }
}
