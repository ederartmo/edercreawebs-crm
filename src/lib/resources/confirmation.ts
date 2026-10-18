import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 24 * 60 * 60 * 1000;
const validId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function resourceDatabase() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") !== "https://ycdosrsanutbhbgejwwg.supabase.co") throw new Error("invalid_resources_database");
  return createAdminClient();
}

function signingSecret() {
  const secret = process.env.RESOURCES_EMAIL_SIGNING_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("confirmation_unavailable");
  return secret;
}

export function confirmationOrigin() {
  const origin = process.env.RESOURCES_CONFIRMATION_ORIGIN?.trim() || process.env.CRM_BASE_URL?.trim();
  if (!origin) throw new Error("confirmation_unavailable");
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new Error("confirmation_unavailable");
  return origin;
}

export function createConfirmationToken(id: string, issuedAt: string) {
  if (!validId.test(id) || !Number.isFinite(Date.parse(issuedAt))) throw new Error("invalid_confirmation");
  const data = Buffer.from(JSON.stringify({ id, at: new Date(issuedAt).toISOString() })).toString("base64url");
  return `${data}.${createHmac("sha256", signingSecret()).update(data).digest("base64url")}`;
}

export function readConfirmationToken(token: unknown, now = Date.now()): { id: string; at: string } | null {
  if (typeof token !== "string" || token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [data, signature] = token.split(".");
  const expected = createHmac("sha256", signingSecret()).update(data).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    const time = Date.parse(value.at);
    if (!validId.test(value.id) || !Number.isFinite(time) || time > now + 60000 || now - time > DAY) return null;
    return { id: value.id, at: new Date(time).toISOString() };
  } catch { return null; }
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

export function buildConfirmationEmail(link: string) {
  const subject = "Confirma tu correo para recibir recursos de EderCreaWebs";
  const text = `Confirma tu correo.\n\nGracias por apuntarte a los recursos de EderCreaWebs. Queremos compartirte guías y materiales para mejorar la presencia digital de tu negocio.\n\nConfirma tu suscripción y te avisaremos cuando publiquemos nuevos recursos:\n\n${link}\n\nEl enlace vence en 24 horas.\n\nSi no solicitaste este registro, ignora este correo. Tu suscripción no se activará sin tu confirmación.\n\nEder\nEderCreaWebs · Diseño web para tu negocio`;
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Confirma tu correo · EderCreaWebs</title>
  <style>
    @media only screen and (max-width:480px){
      .email-outer{padding:20px 12px!important}
      .email-content{padding:30px 24px!important}
      .email-heading{font-size:34px!important;letter-spacing:-1.3px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f3f3f0;color:#0c0c0c;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Confirma tu registro y te avisaremos cuando publiquemos nuevos recursos para tu negocio.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f3f0;">
    <tr><td class="email-outer" align="center" style="padding:48px 20px;">
      <!--[if mso]><table role="presentation" width="560"><tr><td><![endif]-->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;border:1px solid #deded8;border-radius:20px;background-color:#ffffff;">
        <tr><td class="email-content" style="padding:40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:0 0 26px;border-bottom:1px solid #e8e8e3;font-size:21px;line-height:28px;font-weight:700;letter-spacing:-.8px;">EderCreaWebs</td>
              <td align="right" style="padding:0 0 26px;border-bottom:1px solid #e8e8e3;font-size:10px;line-height:16px;font-weight:700;letter-spacing:1.4px;color:#686863;">RECURSOS</td>
            </tr>
          </table>
          <p style="margin:34px 0 16px;font-size:10px;line-height:16px;font-weight:700;letter-spacing:1.8px;color:#686863;">UN PASO MÁS</p>
          <h1 class="email-heading" style="margin:0 0 22px;font-size:42px;line-height:1.08;letter-spacing:-1.8px;font-weight:700;">Confirma<br>tu correo.</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#464642;">Gracias por apuntarte. Queremos compartirte guías y materiales para mejorar la presencia digital de tu negocio.</p>
          <p style="margin:0;font-size:16px;line-height:26px;color:#464642;">Confirma tu suscripción y te avisaremos cuando publiquemos nuevos recursos.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
            <tr><td align="center" bgcolor="#0c0c0c" style="background-color:#0c0c0c;border-radius:10px;">
              <a href="${escapeHtml(link)}" style="display:block;padding:18px 12px;border:1px solid #0c0c0c;border-radius:10px;background-color:#0c0c0c;color:#ffffff;text-decoration:none;font-size:15px;line-height:20px;font-weight:700;">Confirmar mi correo</a>
            </td></tr>
          </table>
          <p style="margin:12px 0 30px;text-align:center;font-size:12px;line-height:18px;color:#686863;">El enlace vence en 24 horas.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding-top:24px;border-top:1px solid #e8e8e3;">
              <p style="margin:0 0 5px;font-size:15px;line-height:20px;font-weight:700;">Eder</p>
              <p style="margin:0;font-size:12px;line-height:19px;color:#686863;">EderCreaWebs · Diseño web para tu negocio</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;">
        <tr><td align="center" style="padding:22px 12px 0;font-size:11px;line-height:18px;color:#686863;">Si no solicitaste este registro, puedes ignorar este correo.<br>Tu suscripción no se activará sin tu confirmación.</td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

export async function sendResourceConfirmation(email: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("confirmation_unavailable");
  signingSecret();
  const origin = confirmationOrigin();
  const from = process.env.RESEND_FROM?.trim() || "EderCreaWebs <recursos@edercreawebs.com>";
  const db = resourceDatabase();
  const { data, error } = await db.rpc("resource_prepare_confirmation", { p_email: email });
  if (error || !data || typeof data.send !== "boolean") throw new Error("confirmation_unavailable");
  if (!data.send) return;
  const token = createConfirmationToken(data.id, data.issued_at);
  const message = buildConfirmationEmail(`${origin}/api/resources/confirm#token=${token}`);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `resources-confirm-v1/${data.id}/${Date.parse(data.issued_at)}` },
    body: JSON.stringify({ from, to: [email], ...message }),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json();
  if (!response.ok || typeof result.id !== "string") throw new Error("confirmation_unavailable");
  const saved = await db.from("resource_subscribers").update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("subscription_id", data.id).eq("confirmation_requested_at", data.issued_at);
  if (saved.error) throw new Error("confirmation_unavailable");
}

export async function confirmResourceSubscription(token: unknown) {
  const value = readConfirmationToken(token);
  if (!value) return false;
  const { data, error } = await resourceDatabase().rpc("resource_confirm_subscription", { p_id: value.id, p_issued_at: value.at });
  if (error) throw new Error("confirmation_unavailable");
  return data === true;
}
