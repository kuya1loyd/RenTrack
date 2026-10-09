import nodemailer from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
let cachedTransporter: nodemailer.Transporter<SMTPPool.SentMessageInfo, SMTPPool.Options> | null = null;
let transporterResolved = false;

function createTransporter() {
  if (transporterResolved) return cachedTransporter;
  transporterResolved = true;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return cachedTransporter;
}

export function isSmtpConfigured() {
  return !!createTransporter();
}

export function getSiteUrl(requestOrigin: string): string {
  return process.env.NEXT_PUBLIC_SITE_URL || requestOrigin;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createRentTrackEmailTemplate({
  title,
  body,
  ctaLabel,
  ctaUrl,
  footerNote,
  messageBlock,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  messageBlock?: string;
}) {
  const siteUrl = getSiteUrl("");
  const logoUrl = `${siteUrl}/images/landing/logo.png`;
  const escapedTitle = escapeHtml(title);
  const escapedBody = escapeHtml(body).replace(/\n/g, "<br />");
  const footer = escapeHtml(footerNote || "This is an automated message from RentTrack. Please do not reply to this email.");

  const ctaBlock = ctaLabel && ctaUrl
    ? `<p style="margin:16px 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;">${escapeHtml(ctaLabel)}</a></p>`
    : "";

  const messageHtml = messageBlock
    ? `<div style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-left:4px solid #2563eb;border-radius:4px;color:#111827;font-size:14px;line-height:1.6;">${escapeHtml(messageBlock).replace(/\n/g, "<br />")}</div>`
    : "";

  return `<!doctype html><html><body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;"><tr><td style="background:#0f172a;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold;text-align:center;"><img src="${logoUrl}" alt="RentTrack" style="height:32px;width:32px;vertical-align:middle;margin-right:8px;border-radius:50%;" onerror="this.style.display='none'" />RentTrack</td></tr><tr><td style="padding:24px;color:#111827;font-size:15px;line-height:1.6;"><p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${escapedTitle}</p><p>${escapedBody}</p>${messageHtml}${ctaBlock}</td></tr><tr><td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;text-align:center;">${footer}</td></tr></table></td></tr></table></body></html>`;
}

export async function sendOtpEmail(to: string, code: string) {
  const currentTransporter = createTransporter();
  if (!currentTransporter) {
    console.warn("SMTP not configured; skipping email send");
    return false;
  }

  const subject = "Your RentTrack payment verification code";
  const text = `Your verification code is: ${code}. It expires in 10 minutes.`;
  const html = createRentTrackEmailTemplate({
    title: "Verification Code",
    body: `Your verification code is: <strong>${escapeHtml(code)}</strong><br />It expires in 10 minutes.`,
    footerNote: "If you did not request this code, please ignore this email.",
  });

  try {
    await currentTransporter.sendMail({
      from: SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    return false;
  }
}

export async function sendEmail({ to, subject, text, html, bcc }: { to: string; subject: string; text?: string; html?: string; bcc?: string }) {
  const currentTransporter = createTransporter();
  if (!currentTransporter) {
    throw new Error("SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.");
  }

  try {
    await currentTransporter.sendMail({
      from: SMTP_USER,
      to,
      bcc,
      subject,
      text: text || html?.replace(/<[^>]+>/g, "") || "",
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    throw err;
  }
}

export async function sendSystemEmail({ to, subject, text, html, bcc, replyTo }: { to: string; subject: string; text?: string; html?: string; bcc?: string; replyTo?: string }) {
  const configured = isSmtpConfigured();
  console.log("[Mail] SMTP configured:", configured, { to, subject, from: process.env.SMTP_USER });
  if (!configured) {
    console.warn("[Mail] Skipping email because SMTP is not configured.");
    return false;
  }
  try {
    const currentTransporter = createTransporter();
    if (!currentTransporter) {
      console.warn("[Mail] SMTP transporter unavailable at send time.");
      return false;
    }
    const result = await currentTransporter.sendMail({
      from: SMTP_USER,
      to,
      bcc,
      replyTo,
      subject,
      text: text || html?.replace(/<[^>]+>/g, "") || "",
      html,
    });
    console.log("[Mail] Email sent successfully:", { to, subject });
    return result;
  } catch (err) {
    console.error("[Mail] Failed to send email:", err);
    return false;
  }
}

export function createVerificationOtpEmailHtml({
  title,
  name,
  code,
  verifyUrl,
  loginUrl,
  credentials,
  isReminder,
}: {
  title: string;
  name: string;
  code: string;
  verifyUrl?: string;
  loginUrl?: string;
  credentials?: { email: string; password?: string; role?: string };
  isReminder?: boolean;
}) {
  const siteUrl = getSiteUrl("");
  const logoUrl = `${siteUrl}/images/landing/logo.png`;
  const escapedTitle = escapeHtml(title);
  const escapedName = escapeHtml(name);
  const escapedCode = escapeHtml(code);
  const year = new Date().getFullYear();

  const credentialSection = credentials
    ? `
      <div style="margin: 20px 0; padding: 16px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Details</p>
        <p style="margin: 4px 0; font-size: 14px; color: #475569;"><strong>Email:</strong> ${escapeHtml(credentials.email)}</p>
        ${credentials.password ? `<p style="margin: 4px 0; font-size: 14px; color: #475569;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${escapeHtml(credentials.password)}</code></p>` : ""}
        ${credentials.role ? `<p style="margin: 4px 0; font-size: 14px; color: #475569;"><strong>Role:</strong> <span style="text-transform: capitalize;">${escapeHtml(credentials.role)}</span></p>` : ""}
      </div>
    `
    : "";

  const introText = isReminder
    ? `A sign-in attempt was detected for your account. Please use the verification code below to verify your account and complete login.`
    : `Your RentTrack account has been created. To activate your account and log in, please enter the 6-digit verification code below.`;

  const verifyButton = verifyUrl
    ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; padding: 13px 34px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(37,99,235,0.2);">Verify &amp; Log In</a>
          </td>
        </tr>
      </table>
      <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8; text-align: center; word-break: break-all;">
        Or copy this verification link into your browser:<br />
        <a href="${escapeHtml(verifyUrl)}" style="color: #2563eb;">${escapeHtml(verifyUrl)}</a>
      </p>
    `
    : (loginUrl ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; width: 100%;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(loginUrl)}" style="display: inline-block; padding: 13px 34px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px;">Go to Login</a>
          </td>
        </tr>
      </table>
    ` : "");

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 0; background: #f3f4f6; color: #1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f3f4f6; padding: 36px 0;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06);">
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 36px; text-align: center;">
                  <img src="${logoUrl}" alt="RentTrack" style="height: 52px; width: auto; margin-bottom: 12px; border-radius: 50%;" onerror="this.style.display='none'" />
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">RentTrack</h1>
                  <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">HedgeHomes Realty and Brokerage</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 36px 36px 28px;">
                  <h2 style="color: #0f172a; margin: 0 0 12px; font-size: 20px; font-weight: 700;">${escapedTitle}</h2>
                  <p style="color: #334155; line-height: 1.6; margin: 0 0 8px; font-size: 15px;">Hello <strong>${escapedName}</strong>,</p>
                  <p style="color: #475569; line-height: 1.6; margin: 0 0 20px; font-size: 14px;">${introText}</p>
                  
                  ${credentialSection}

                  <div style="margin: 24px 0 20px; text-align: center;">
                    <p style="margin: 0 0 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em;">Verification Code</p>
                    <div style="display: inline-block; padding: 16px 40px; background: #eff6ff; border: 2px dashed #2563eb; border-radius: 14px; font-weight: 800; font-size: 32px; letter-spacing: 10px; color: #1d4ed8; font-family: monospace;">${escapedCode}</div>
                    <p style="margin: 10px 0 0; font-size: 12px; color: #64748b;">This code will expire in 15 minutes.</p>
                  </div>

                  ${verifyButton}

                  <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                    For your security, never share this code or your password with anyone. If you did not request this, please contact your administrator.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; padding: 20px 36px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; margin: 0; font-size: 11px;">© ${year} RentTrack. All rights reserved.</p>
                  <p style="color: #94a3b8; margin: 4px 0 0; font-size: 11px;">HedgeHomes Realty and Brokerage</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}
