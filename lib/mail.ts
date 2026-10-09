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
