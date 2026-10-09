import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, initDatabase } from "@/lib/db";
import { isSmtpConfigured, sendSystemEmail, getSiteUrl, createRentTrackEmailTemplate } from "@/lib/mail";
import { requireRole, withRateLimit, validateApiRequest, checkRequestSize, withSecurityHeaders, withCorsHeaders } from "@/lib/api-security";
import { sanitizeString } from "@/lib/security-headers";
import { randomBytes } from "crypto";

const MAX_REPLY_LENGTH = 5000;

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const url = new URL(request.url);
    const countOnly = url.searchParams.get("count") === "true";

    if (countOnly) {
      let countQuery = getAdminSupabase()
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .or("status.eq.new,status.is.null");
      if (auth.user.role === "agent") {
        countQuery = countQuery.eq("agent_id", auth.userId);
      }
      const { count, error } = await countQuery;
      if (error) throw error;
      const response = NextResponse.json({ success: true, count: count || 0 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    let inquiries: any[] = [];
    try {
      let query = getAdminSupabase()
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (auth.user.role === "agent") {
        query = query.eq("agent_id", auth.userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      inquiries = (data || []).map((row: any) => ({
        id: row.id,
        text: row.text,
        propertyId: row.property_id,
        senderName: row.sender_name,
        senderEmail: row.sender_email,
        senderPhone: row.sender_phone,
        status: row.status || "new",
        createdAt: row.created_at,
        replyText: row.reply_text,
        repliedAt: row.replied_at,
        agentName: row.agent_name,
        visitorReply: row.visitor_reply,
        visitorRepliedAt: row.visitor_replied_at,
        agentId: row.agent_id,
      }));
    } catch (err: any) {
      if (err?.message?.includes("schema cache") || err?.code === "PGRST205") {
        console.warn("chat_messages table not found, returning empty inquiries");
        inquiries = [];
      } else {
        throw err;
      }
    }

    const response = NextResponse.json({ success: true, inquiries });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (err) {
    console.error("Get inquiries error:", err);
    const response = NextResponse.json({ success: false, error: "Failed to fetch inquiries" }, { status: 500 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const validationError = validateApiRequest(request);
    if (validationError) return validationError;

    if (!checkRequestSize(request)) {
      const response = NextResponse.json({ success: false, error: "Request too large" }, { status: 413 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    await initDatabase();
    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id, status, replyText } = body;
    const sanitizedId = sanitizeString(String(id || ""), 128);
    const hasStatus = typeof status === "string";
    const sanitizedStatus = hasStatus ? sanitizeString(status, 32) : "";
    const sanitizedReplyText = typeof replyText === "string" ? sanitizeString(replyText, MAX_REPLY_LENGTH).trim() : "";
    const hasPropertyId = Object.prototype.hasOwnProperty.call(body, "propertyId");
    const isReadOnlyUpdate = sanitizedStatus === "read" && !sanitizedReplyText && !hasPropertyId;

    if (!sanitizedId || (!hasStatus && !hasPropertyId)) {
      const response = NextResponse.json({ success: false, error: "ID and an inquiry update are required" }, { status: 400 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    const validStatuses = ["new", "read", "replied"];
    if (hasStatus && !validStatuses.includes(sanitizedStatus)) {
      const response = NextResponse.json({ success: false, error: "Invalid inquiry status" }, { status: 400 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    let nextPropertyId: string | null = null;
    if (hasPropertyId) {
      if (body.propertyId !== null && typeof body.propertyId !== "string") {
        const response = NextResponse.json({ success: false, error: "Choose a valid inquiry category" }, { status: 400 });
        return withSecurityHeaders(withCorsHeaders(request, response));
      }
      nextPropertyId = typeof body.propertyId === "string"
        ? sanitizeString(body.propertyId, 128).trim() || null
        : null;
      if (nextPropertyId && auth.user.role === "agent") {
        const { data: property, error } = await getAdminSupabase()
          .from("properties")
          .select("id")
          .eq("id", nextPropertyId)
          .eq("agent_id", auth.userId)
          .maybeSingle();
        if (error) throw error;
        if (!property) {
          const response = NextResponse.json({ success: false, error: "Choose one of your assigned properties" }, { status: 403 });
          return withSecurityHeaders(withCorsHeaders(request, response));
        }
      }
    }

    // A read polling loop should not block actual replies. This keeps the agent's reply path responsive.
    if (!isReadOnlyUpdate) {
      const rateLimit = await withRateLimit(request, `inquiry_update:${auth.userId}:${request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"}`);
      if (rateLimit) return rateLimit;
    }

    let emailSent = false;
    let replyToken = "";
    try {
      const updates: Record<string, string | null> = {};
      if (hasStatus) updates.status = sanitizedStatus;
      if (hasPropertyId) updates.property_id = nextPropertyId;
      if (sanitizedReplyText) {
        replyToken = randomBytes(32).toString("hex");
        updates.reply_text = sanitizedReplyText;
        updates.replied_at = new Date().toISOString();
        updates.agent_name = sanitizeString(String(auth.user.name || "RentTrack Support"), 255);
        updates.reply_token = replyToken;
      }

      let inquiryQuery = getAdminSupabase().from("chat_messages")
        .select("sender_email, sender_name, text")
        .eq("id", sanitizedId);
      let updateQuery = getAdminSupabase().from("chat_messages").update(updates).eq("id", sanitizedId);
      if (auth.user.role === "agent") {
        inquiryQuery = inquiryQuery.eq("agent_id", auth.userId);
        updateQuery = updateQuery.eq("agent_id", auth.userId);
      }
      const { data: inquiry, error: inquiryError } = await inquiryQuery.maybeSingle();
      if (inquiryError) throw inquiryError;
      if (!inquiry) {
        const response = NextResponse.json({ success: false, error: "Inquiry not found" }, { status: 404 });
        return withSecurityHeaders(withCorsHeaders(request, response));
      }
      const { error } = await updateQuery;

      if (error) throw error;

      const shouldSendEmail = !!sanitizedReplyText && !!inquiry?.sender_email;
      console.log("[Inquiry] PATCH update prepared:", {
        id: sanitizedId,
        status: sanitizedStatus || undefined,
        propertyId: hasPropertyId ? nextPropertyId : undefined,
        hasReplyText: !!sanitizedReplyText,
        shouldSendEmail,
        senderEmail: inquiry?.sender_email,
        smtpConfigured: isSmtpConfigured(),
      });

      if (shouldSendEmail && isSmtpConfigured()) {
        try {
          const senderName = sanitizeString(String(auth.user.name || "RentTrack Support"), 255);
          const replyDate = new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date());

          const html = createRentTrackEmailTemplate({
            title: "Agent Replied",
            body: `Date of Reply: ${replyDate}\n\nDear ${inquiry!.sender_name || "there"},\n\nThank you for reaching out to RentTrack. We have reviewed your inquiry and our team has provided the following response.`,
            messageBlock: `${sanitizedReplyText}\n\n— ${senderName}`,
            footerNote: `This message was sent by ${senderName} from RentTrack. Please do not share sensitive information in this email.`,
          });
          const sendResult = await sendSystemEmail({
            to: inquiry!.sender_email,
            subject: "Agent replied to your RentTrack inquiry",
            html,
            text: `Agent Replied\nDate of Reply: ${replyDate}\n\nDear ${inquiry!.sender_name || "there"},\n\nThank you for reaching out to RentTrack. We have reviewed your inquiry and our team has provided the following response.\n\n---\n${sanitizedReplyText}\n---\n\n— ${senderName}\n\nThis message was sent by ${senderName} from RentTrack. Please do not share sensitive information in this email.`,
          });
          emailSent = !!sendResult;
        } catch (mailErr) {
          console.error("[Inquiry] Failed to send reply email:", mailErr);
        }
      } else if (shouldSendEmail && !isSmtpConfigured()) {
        console.warn("[Inquiry] Skipping reply email because SMTP is not configured.");
      }
    } catch (err: any) {
      if (err?.message?.includes("schema cache") || err?.code === "PGRST205") {
        console.warn("chat_messages table not found, skipping update");
        const response = NextResponse.json({ success: true });
        return withSecurityHeaders(withCorsHeaders(request, response));
      }
      throw err;
    }

    const response = NextResponse.json({ success: true, emailSent });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (err) {
    console.error("Update inquiry error:", err);
    const response = NextResponse.json({ success: false, error: "Failed to update inquiry" }, { status: 500 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}
