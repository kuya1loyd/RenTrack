import { NextRequest, NextResponse } from "next/server";
import { ensureAgentProfileTables, getPublicRentManager } from "@/lib/agent-profile-api";
import { createNotification, findUserById, getAdminSupabase } from "@/lib/db";
import { getSessionUserId } from "@/lib/security";
import { createRentTrackEmailTemplate, isSmtpConfigured, sendSystemEmail } from "@/lib/mail";
import {
  getClientIp,
  checkRequestSize,
  validateApiRequest,
  withCorsHeaders,
  withRateLimit,
  withSecurityHeaders,
} from "@/lib/api-security";

const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function respond(request: NextRequest, body: Record<string, unknown>, status = 200) {
  return withSecurityHeaders(withCorsHeaders(request, NextResponse.json(body, { status })));
}

function cleanField(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const validationError = validateApiRequest(request);
    if (validationError) return validationError;

    if (!checkRequestSize(request, 16 * 1024)) {
      return respond(request, { success: false, error: "Inquiry is too large" }, 413);
    }

    const { id: agentId } = await context.params;
    const rateLimit = await withRateLimit(request, `public_agent_inquiry:${getClientIp(request)}:${agentId}`);
    if (rateLimit) return rateLimit;

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 16 * 1024) {
      return respond(request, { success: false, error: "Inquiry is too large" }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return respond(request, { success: false, error: "Invalid inquiry details" }, 400);
    }
    if (!body || typeof body !== "object") {
      return respond(request, { success: false, error: "Invalid inquiry details" }, 400);
    }
    const input = body as Record<string, unknown>;
    const senderName = cleanField(input.senderName, 120);
    const senderEmail = cleanField(input.senderEmail, 254).toLowerCase();
    const senderPhone = cleanField(input.senderPhone, 40);
    const message = cleanField(input.message, MAX_MESSAGE_LENGTH);

    if (!senderName || !senderEmail || !message || !EMAIL_PATTERN.test(senderEmail)) {
      return respond(request, { success: false, error: "Enter your name, a valid email address, and an inquiry message" }, 400);
    }
    if (typeof input.message !== "string" || input.message.trim().length > MAX_MESSAGE_LENGTH) {
      return respond(request, { success: false, error: "Inquiry message must be 5,000 characters or fewer" }, 400);
    }
    if (!isSmtpConfigured()) {
      return respond(request, { success: false, error: "Email inquiries are temporarily unavailable. Please try again later." }, 503);
    }

    await ensureAgentProfileTables();
    const sessionUserId = getSessionUserId(request);
    const [agent, sessionUser] = await Promise.all([
      getPublicRentManager(agentId),
      sessionUserId ? findUserById(sessionUserId) : Promise.resolve(null),
    ]);
    if (!agent) {
      return respond(request, { success: false, error: "This Rent Manager is not available for public inquiries" }, 404);
    }
    if (!agent.email) {
      return respond(request, { success: false, error: "This Rent Manager does not have an email address for inquiries" }, 503);
    }

    const tenantId = sessionUser?.role === "tenant" ? sessionUser.id : null;

    const subject = `RentTrack inquiry from ${senderName}`;
    const text = `New Rent Manager Inquiry\n\nFrom: ${senderName}\nEmail: ${senderEmail}${senderPhone ? `\nPhone: ${senderPhone}` : ""}\n\nInquiry:\n${message}`;
    const html = createRentTrackEmailTemplate({
      title: "New Rent Manager Inquiry",
      body: `From: ${senderName}\nEmail: ${senderEmail}${senderPhone ? `\nPhone: ${senderPhone}` : ""}`,
      messageBlock: message,
      footerNote: "Reply directly to this email to contact the visitor.",
    });
    const emailResult = await sendSystemEmail({
      to: agent.email,
      replyTo: senderEmail,
      subject,
      text,
      html,
    });
    if (!emailResult) {
      return respond(request, { success: false, error: "Your inquiry could not be emailed. Please try again later." }, 502);
    }

    const inquiryId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      const { error } = await getAdminSupabase().from("chat_messages").insert({
        id: inquiryId,
        text: message,
        property_id: null,
        sender_name: senderName,
        sender_email: senderEmail,
        sender_phone: senderPhone || null,
        tenant_id: tenantId,
        agent_id: agent.id,
        agent_name: agent.name,
        status: "new",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (error) {
      console.error("Public agent inquiry emailed but could not be stored:", error);
      return respond(request, {
        success: true,
        stored: false,
        message: "Your inquiry was emailed, but could not be saved in RentTrack.",
      });
    }

    try {
      await createNotification({
        userId: agent.id,
        title: "New landing inquiry",
        message: `${senderName} sent you a new landing inquiry.`,
        type: "system",
      });
    } catch (error) {
      console.error("Public agent inquiry saved but its notification could not be created:", error);
    }

    return respond(request, {
      success: true,
      stored: true,
      message: `Your inquiry was emailed to ${agent.name}. They can reply directly to your email address.`,
    });
  } catch (error) {
    console.error("Public agent inquiry failed:", error);
    return respond(request, { success: false, error: "Your inquiry could not be sent. Please try again." }, 500);
  }
}
