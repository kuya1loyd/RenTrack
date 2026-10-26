/**
 * RentTrack Mail Service - Updated 2026-10-22
 */
import nodemailer from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";
import path from "path";
import fs from "fs";

export function getLogoAttachment() {
  try {
    const localLogoPath = path.join(process.cwd(), "public", "images", "landing", "logo.png");
    if (fs.existsSync(localLogoPath)) {
      return [
        {
          filename: "logo.png",
          path: localLogoPath,
          cid: "renttrack-logo",
        },
      ];
    }
  } catch (err) {
    console.warn("[Mail] Could not load logo attachment:", err);
  }
  return [];
}

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
      from: SMTP_USER ? `"RentTrack" <${SMTP_USER}>` : undefined,
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
      from: SMTP_USER ? `"RentTrack" <${SMTP_USER}>` : undefined,
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

export async function sendSystemEmail({
  to,
  subject,
  text,
  html,
  bcc,
  replyTo,
  attachments,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: any[];
}) {
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
      from: SMTP_USER ? `"RentTrack" <${SMTP_USER}>` : undefined,
      to,
      bcc,
      replyTo,
      subject,
      text: text || html?.replace(/<[^>]+>/g, "") || "",
      html,
      attachments,
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

export function createAccountCredentialsEmailHtml({
  title,
  name,
  role,
  credentials,
  loginUrl,
}: {
  title: string;
  name: string;
  role?: string;
  credentials: { email: string; password?: string; role?: string };
  loginUrl: string;
}) {
  const siteUrl = getSiteUrl("");
  const logoUrl = `${siteUrl}/images/landing/logo.png`;
  const escapedTitle = escapeHtml(title);
  const escapedName = escapeHtml(name);
  const formattedRole = role ? escapeHtml(role.charAt(0).toUpperCase() + role.slice(1)) : "User";
  const year = new Date().getFullYear();

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
                  <p style="color: #475569; line-height: 1.6; margin: 0 0 20px; font-size: 14px;">
                    Your RentTrack ${formattedRole} account has been created by an administrator or property owner. Below are your account login details:
                  </p>
                  
                  <div style="margin: 20px 0; padding: 18px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Details</p>
                    <p style="margin: 6px 0; font-size: 14px; color: #475569;"><strong>Email / Username:</strong> <span style="font-family: monospace; color: #0f172a; font-weight: 600;">${escapeHtml(credentials.email)}</span></p>
                    ${credentials.password ? `<p style="margin: 6px 0; font-size: 14px; color: #475569;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-family: monospace; color: #0f172a; font-weight: 600;">${escapeHtml(credentials.password)}</code></p>` : ""}
                    ${credentials.role ? `<p style="margin: 6px 0; font-size: 14px; color: #475569;"><strong>Role:</strong> <span style="text-transform: capitalize; color: #0f172a; font-weight: 600;">${escapeHtml(credentials.role)}</span></p>` : ""}
                  </div>

                  <div style="margin: 20px 0; padding: 14px 18px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 8px;">
                    <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                      <strong>Security Note:</strong> When you log in for the first time with these details, a 6-digit verification code will be sent to your email to verify your identity and activate your account.
                    </p>
                  </div>

                  <table cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 20px; width: 100%;">
                    <tr>
                      <td align="center">
                        <a href="${escapeHtml(loginUrl)}" style="display: inline-block; padding: 13px 36px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">Go to Login</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0 0 20px; font-size: 12px; color: #94a3b8; text-align: center; word-break: break-all;">
                    Or visit:<br />
                    <a href="${escapeHtml(loginUrl)}" style="color: #2563eb;">${escapeHtml(loginUrl)}</a>
                  </p>

                  <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                    Please change your password after logging in. For your security, never share your temporary password with anyone.
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

export function createSystemMaintenanceEmailHtml({
  name,
  estimatedDowntime = "30 to 60 minutes",
  customMessage,
  maintenanceReason = "Property & Unit Infrastructure Maintenance",
}: {
  name: string;
  estimatedDowntime?: string;
  customMessage?: string;
  maintenanceReason?: string;
}) {
  const siteUrl = getSiteUrl("");
  const logoUrl = `${siteUrl}/images/landing/logo.png`;
  const escapedName = escapeHtml(name || "User");
  const escapedDowntime = escapeHtml(estimatedDowntime);
  const escapedReason = escapeHtml(maintenanceReason);
  const preheaderText = escapeHtml(
    (customMessage || `RentTrack is undergoing scheduled maintenance (${estimatedDowntime}). Services will resume shortly.`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160)
  );
  const year = new Date().getFullYear();
  const dateFormatted = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  });

  return `
    <!-- Hidden Preheader for email clients so preview shows message body -->
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
      ${preheaderText}
    </div>
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 0; background: #f8fafc; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; padding: 36px 0;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 580px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 36px; text-align: center;">
                  <img src="${logoUrl}" alt="RentTrack" width="56" height="56" style="height: 56px; width: 56px; margin-bottom: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); display: inline-block; vertical-align: middle;" />
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">RentTrack Property Management</h1>
                  <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">HedgeHomes Realty and Brokerage</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 36px 36px 28px;">
                  <div style="display: inline-block; padding: 6px 14px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 9999px; margin-bottom: 18px;">
                    <span style="color: #b45309; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">System Maintenance Notice</span>
                  </div>

                  <h2 style="color: #0f172a; margin: 0 0 14px; font-size: 22px; font-weight: 700;">System is Currently Under Scheduled Maintenance</h2>
                  
                  <p style="color: #334155; line-height: 1.6; margin: 0 0 14px; font-size: 15px;">
                    Hello <strong>${escapedName}</strong>,
                  </p>

                  <p style="color: #475569; line-height: 1.6; margin: 0 0 16px; font-size: 14px;">
                    Please be advised that the RentTrack platform is currently undergoing scheduled system maintenance to perform essential updates and repairs.
                  </p>

                  ${customMessage ? `
                  <div style="margin: 20px 0; padding: 14px 18px; background: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 6px;">
                    <p style="margin: 0; font-size: 13px; color: #1e293b; line-height: 1.5;">
                      <strong>Note from Administrator:</strong><br />${escapeHtml(customMessage)}
                    </p>
                  </div>
                  ` : ""}

                  <div style="margin: 22px 0; padding: 18px 20px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-size: 13px; color: #78350f;">
                      <tr>
                        <td width="38%" style="font-weight: 700;">Status:</td>
                        <td><span style="display: inline-block; padding: 2px 8px; background: #fde68a; color: #92400e; border-radius: 4px; font-weight: 700;">Under Maintenance</span></td>
                      </tr>
                      <tr>
                        <td style="font-weight: 700;">Reason for Maintenance:</td>
                        <td><strong style="color: #92400e;">${escapedReason}</strong></td>
                      </tr>
                      <tr>
                        <td style="font-weight: 700;">Maintenance Window:</td>
                        <td>${dateFormatted}</td>
                      </tr>
                      <tr>
                        <td style="font-weight: 700;">Expected Duration:</td>
                        <td>${escapedDowntime}</td>
                      </tr>
                      <tr>
                        <td style="font-weight: 700;">Affected Services:</td>
                        <td>Tenant portals, public listing browsing, and portal accounts</td>
                      </tr>
                    </table>
                  </div>

                  <p style="color: #475569; line-height: 1.6; margin: 0 0 16px; font-size: 14px;">
                    During this window, non-administrative access is temporarily paused. All your data, rental contracts, payment records, and account credentials remain completely safe and secure.
                  </p>

                  <p style="color: #475569; line-height: 1.6; margin: 0 0 20px; font-size: 14px;">
                    Normal operations will resume as soon as the maintenance updates are finalized. We apologize for any inconvenience and thank you for your patience.
                  </p>

                  <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      This is an automated system notification from RentTrack. If you have urgent inquiries, please contact management.
                    </p>
                  </div>
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

export async function broadcastMaintenanceEmailToAllUsers(options?: {
  customMessage?: string;
  estimatedDowntime?: string;
  maintenanceReason?: string;
}): Promise<{ totalAccounts: number; sentCount: number; failedCount: number }> {
  try {
    const { getAllUsers } = await import("@/lib/db");
    const allUsers = await getAllUsers();

    const validUsers = (allUsers || []).filter(
      (u: any) => u.email && typeof u.email === "string" && u.email.includes("@") && u.role !== "admin"
    );
    let sentCount = 0;
    let failedCount = 0;

    const batchSize = 6;
    for (let i = 0; i < validUsers.length; i += batchSize) {
      const batch = validUsers.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (user: any) => {
          try {
            const html = createSystemMaintenanceEmailHtml({
              name: user.name || "Valued User",
              estimatedDowntime: options?.estimatedDowntime || "30 to 60 minutes",
              customMessage: options?.customMessage,
              maintenanceReason: options?.maintenanceReason,
            });
            const result = await sendSystemEmail({
              to: user.email,
              subject: `[RentTrack Notice] System Under Maintenance: ${options?.maintenanceReason || "Scheduled Maintenance"}`,
              html,
            });
            if (result) {
              sentCount++;
            } else {
              failedCount++;
            }
          } catch (err) {
            console.error(`Failed to send maintenance email to ${user.email}:`, err);
            failedCount++;
          }
        })
      );
    }
    console.log(`[Maintenance Broadcast] Finished: ${sentCount} sent, ${failedCount} failed out of ${validUsers.length} accounts.`);
    return {
      totalAccounts: validUsers.length,
      sentCount,
      failedCount,
    };
  } catch (error) {
    console.error("Failed to broadcast maintenance emails:", error);
    return { totalAccounts: 0, sentCount: 0, failedCount: 0 };
  }
}

export function createAnnouncementEmailHtml({
  name,
  title,
  message,
  maintenanceReason,
  estimatedDowntime,
}: {
  name: string;
  title: string;
  message: string;
  maintenanceReason?: string;
  estimatedDowntime?: string;
}) {
  const siteUrl = getSiteUrl("");
  const logoUrl = `${siteUrl}/images/landing/logo.png`;
  const escapedName = escapeHtml(name || "Resident / User");
  const escapedTitle = escapeHtml(title || "System Announcement");
  const escapedMessage = escapeHtml(message).replace(/\n/g, "<br />");
  const escapedReason = maintenanceReason && maintenanceReason !== "None" ? escapeHtml(maintenanceReason) : undefined;
  const escapedDowntime = estimatedDowntime ? escapeHtml(estimatedDowntime) : undefined;
  const preheaderText = escapeHtml(message.replace(/\s+/g, " ").trim().slice(0, 160));
  const year = new Date().getFullYear();
  const dateFormatted = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  });

  return `
    <!-- Hidden Preheader for email clients so preview shows message body -->
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
      ${preheaderText}
    </div>
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 0; background: #f8fafc; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; padding: 36px 0;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 580px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 36px; text-align: center;">
                  <img src="${logoUrl}" alt="RentTrack" width="56" height="56" style="height: 56px; width: 56px; margin-bottom: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); display: inline-block; vertical-align: middle;" />
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">RentTrack Property Management</h1>
                  <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">HedgeHomes Realty and Brokerage</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 36px 36px 28px;">
                  <div style="display: inline-block; padding: 6px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9999px; margin-bottom: 18px;">
                    <span style="color: #1d4ed8; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">Official System Notice</span>
                  </div>

                  <h2 style="color: #0f172a; margin: 0 0 14px; font-size: 22px; font-weight: 700;">${escapedTitle}</h2>
                  
                  <p style="color: #334155; line-height: 1.6; margin: 0 0 14px; font-size: 15px;">
                    Hello <strong>${escapedName}</strong>,
                  </p>

                  <div style="margin: 20px 0; padding: 18px 22px; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 8px; font-size: 14px; color: #1e293b; line-height: 1.65;">
                    ${escapedMessage}
                  </div>

                  ${(escapedReason || escapedDowntime) ? `
                  <div style="margin: 22px 0; padding: 18px 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-size: 13px; color: #166534;">
                      ${escapedReason ? `
                      <tr>
                        <td width="38%" style="font-weight: 700;">Related Category:</td>
                        <td><strong style="color: #15803d;">${escapedReason}</strong></td>
                      </tr>
                      ` : ""}
                      ${escapedDowntime ? `
                      <tr>
                        <td style="font-weight: 700;">Estimated Duration:</td>
                        <td>${escapedDowntime}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="font-weight: 700;">Broadcast Date:</td>
                        <td>${dateFormatted}</td>
                      </tr>
                    </table>
                  </div>
                  ` : ""}

                  <p style="color: #475569; line-height: 1.6; margin: 20px 0 0; font-size: 14px;">
                    If you have any questions or require assistance regarding this notice, please contact your property administrator or agent.
                  </p>

                  <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      This is an official system announcement from RentTrack Property Management.
                    </p>
                  </div>
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

export async function broadcastAnnouncementEmailToAllUsers(options: {
  title: string;
  message: string;
  maintenanceReason?: string;
  estimatedDowntime?: string;
}): Promise<{ totalAccounts: number; sentCount: number; failedCount: number }> {
  try {
    const { getAllUsers } = await import("@/lib/db");
    const allUsers = await getAllUsers();

    // Filter all users except admin accounts
    const validUsers = (allUsers || []).filter(
      (u: any) => u.email && typeof u.email === "string" && u.email.includes("@") && u.role !== "admin"
    );
    let sentCount = 0;
    let failedCount = 0;

    const batchSize = 6;
    for (let i = 0; i < validUsers.length; i += batchSize) {
      const batch = validUsers.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (user: any) => {
          try {
            const html = createAnnouncementEmailHtml({
              name: user.name || "Valued User",
              title: options.title,
              message: options.message,
              maintenanceReason: options.maintenanceReason,
              estimatedDowntime: options.estimatedDowntime,
            });
            const result = await sendSystemEmail({
              to: user.email,
              subject: `[RentTrack Announcement] ${options.title}`,
              html,
            });
            if (result) {
              sentCount++;
            } else {
              failedCount++;
            }
          } catch (err) {
            console.error(`Failed to send announcement email to ${user.email}:`, err);
            failedCount++;
          }
        })
      );
    }

    console.log(`[Announcement Broadcast] Finished: ${sentCount} sent, ${failedCount} failed out of ${validUsers.length} accounts.`);
    return {
      totalAccounts: validUsers.length,
      sentCount,
      failedCount,
    };
  } catch (error) {
    console.error("Failed to broadcast announcement emails:", error);
    return { totalAccounts: 0, sentCount: 0, failedCount: 0 };
  }
}


