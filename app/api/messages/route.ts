import { NextRequest, NextResponse } from "next/server";
import { getConversations, sendMessage, getUnreadMessageCount, findUserById, createNotification } from "@/lib/db";
import { requireAuth, validateApiRequest, getClientIp } from "@/lib/api-security";
import { logAudit } from "@/lib/db";
import { sendEmail, getSiteUrl } from "@/lib/mail";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;
    const url = new URL(request.url);
    const countOnly = url.searchParams.get("count") === "true";

    if (countOnly) {
      const count = await getUnreadMessageCount(userId);
      return NextResponse.json({ success: true, count });
    }

    const conversations = await getConversations(userId);
    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json();
    const { receiverId, subject, body: messageBody, attachmentUrl, attachmentType } = body;

    if (!receiverId || !messageBody) {
      return NextResponse.json({ success: false, error: "Receiver and message body are required" }, { status: 400 });
    }

    const message = await sendMessage(auth.userId, receiverId, subject || "", messageBody, attachmentUrl, attachmentType);
    await logAudit(auth.userId, "message_sent", { receiverId, subject }, getClientIp(request), request.headers.get("user-agent") || "unknown");

    try {
      const receiver = await findUserById(receiverId);
      const sender = await findUserById(auth.userId);
      if (receiver?.email && sender) {
        const siteUrl = getSiteUrl(request.headers.get("origin") || "");
        const isAgentReply = sender.role === "agent";
        const emailSubject = isAgentReply ? `Agent ${sender.name} replied to you on RentTrack` : `New message from ${sender.name}`;
        const html = isAgentReply
          ? `<p><strong>${sender.name}</strong> (Agent) has replied to your message on RentTrack.</p><p><a href="${siteUrl}/dashboard/messages">Open Messages</a></p>`
          : `<p>You have a new message from <strong>${sender.name}</strong> on RentTrack.</p><p><a href="${siteUrl}/dashboard/messages">Open Messages</a></p>`;
        await sendEmail({ to: receiver.email, subject: emailSubject, html, bcc: process.env.SMTP_USER });
      }
    } catch (err) {
      console.error("Failed to send message notification email:", err);
    }

    try {
      const msgSender = await findUserById(auth.userId);
      const senderDisplayName = msgSender?.name || "User";
      await createNotification({
        userId: receiverId,
        title: `New Message from ${senderDisplayName}`,
        message: subject ? `${subject}: ${messageBody.slice(0, 100)}` : messageBody.slice(0, 100),
        type: "system",
      });
    } catch (err) {
      console.error("Failed to create message notification:", err);
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ success: false, error: "Failed to send message" }, { status: 500 });
  }
}
