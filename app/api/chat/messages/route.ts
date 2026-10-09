import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, initDatabase } from "@/lib/db";
import { sendSystemEmail, createRentTrackEmailTemplate, escapeHtml } from "@/lib/mail";
import { requireAuth, withCorsHeaders, withSecurityHeaders } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const agentId = body.agentId || null;
    const agentName = body.agentName || null;

    if (agentId || agentName) {
      const auth = await requireAuth(request);
      if (auth instanceof NextResponse) return auth;
    }

    await initDatabase();
    const text = String(body.text || "").trim();
    const propertyId = body.propertyId || null;
    const senderName = String(body.senderName || "Landing Visitor").trim();
    const senderEmail = String(body.senderEmail || "").trim();
    const senderPhone = body.senderPhone || null;

    if (!text) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    const id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const { error } = await getAdminSupabase().from("chat_messages").insert({
      id,
      text,
      property_id: propertyId,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_phone: senderPhone,
      agent_id: agentId,
      agent_name: agentName,
      status: "new",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Chat insert error:", error);
      return NextResponse.json({ success: false, error: "Failed to save message" }, { status: 500 });
    }

    const agentEmails: string[] = [];
    const agentIds: string[] = [];

    if (agentId) {
      const { data: selectedAgent } = await getAdminSupabase().schema("public").from("users").select("id, email").eq("id", agentId).single();
      if (selectedAgent) {
        const email = (selectedAgent as any).email;
        const idVal = (selectedAgent as any).id;
        if (email) agentEmails.push(email);
        if (idVal) agentIds.push(idVal);
      }
    }

    if (!agentId && propertyId) {
      const { data: prop } = await getAdminSupabase().from("properties").select("agent_id, users!properties_agent_id_fkey(email)").eq("id", propertyId).single();
      const agentEmail = (prop as any)?.users?.email;
      const agentIdFromProp = (prop as any)?.agent_id;
      if (agentEmail) agentEmails.push(agentEmail);
      if (agentIdFromProp) agentIds.push(agentIdFromProp);
    }

    if (agentEmails.length > 0 && senderEmail) {
      const subject = `New chat message from ${senderName}`;
      const safeText = (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const body = `New Chat Message<br /><br /><strong>From:</strong> ${escapeHtml(senderName)} (${escapeHtml(senderEmail)})${senderPhone ? `<br /><strong>Phone:</strong> ${escapeHtml(senderPhone)}` : ""}<br /><strong>Property:</strong> ${escapeHtml(propertyId || "General inquiry")}<br /><br /><strong>Message:</strong><br />${safeText}`;
      const html = createRentTrackEmailTemplate({
        title: "New Inquiry",
        body,
        footerNote: "An agent will respond to this inquiry shortly.",
      });
      const textBody = `New Chat Message\nFrom: ${senderName} (${senderEmail})${senderPhone ? `\nPhone: ${senderPhone}` : ""}\nProperty: ${propertyId || "General inquiry"}\nMessage: ${text}`;

      for (const email of agentEmails) {
        try {
          await sendSystemEmail({ to: email, subject, text: textBody, html });
        } catch (mailErr) {
          console.error("Chat notification email failed", mailErr);
        }
      }
    }

    if (agentIds.length > 0) {
      const notificationId = `not_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const { error: notifError } = await getAdminSupabase().from("notifications").insert({
        id: notificationId,
        user_id: agentIds[0],
        title: `New inquiry from ${senderName}`,
        message: text,
        type: "tenant",
        read: false,
        created_at: new Date().toISOString(),
      });

      if (notifError) {
        console.error("Chat notification insert failed", notifError);
      }
    }

    return NextResponse.json({ success: true, inquiryId: id, message: "Message received. An agent will reply by email." });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ success: false, error: "Failed to send message" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const ids = request.nextUrl.searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean) || [];
    let query = getAdminSupabase().from("chat_messages").select("*").order("created_at", { ascending: true });
    if (ids.length > 0) query = query.in("id", ids);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, messages: (data || []).map((row: any) => ({ id: row.id, text: row.text, propertyId: row.property_id, senderName: row.sender_name, senderEmail: row.sender_email, senderPhone: row.sender_phone, agentId: row.agent_id, agentName: row.agent_name, status: row.status, replyText: row.reply_text, repliedAt: row.replied_at, createdAt: row.created_at })) });
  } catch (err) {
    console.error("Chat GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to load messages" }, { status: 500 });
  }
}
