import { NextRequest, NextResponse } from "next/server";
import {
  createAccountCreationRequest,
  getAccountCreationRequestById,
  getAccountCreationRequests,
  findAccountCreationRequestForNotification,
  createNotification,
  sendMessage,
  getAdminSupabase,
} from "@/lib/db";
import { requireRole } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["agent", "owner", "admin"]);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const requestId = searchParams.get("requestId");
    const notificationId = searchParams.get("notificationId");
    const message = searchParams.get("message");
    const status = searchParams.get("status") || undefined;
    const agentId = searchParams.get("agentId") || undefined;
    const email = searchParams.get("email") || undefined;

    if (id || requestId || notificationId || message) {
      const single = await findAccountCreationRequestForNotification(
        notificationId || undefined,
        message || undefined,
        id || requestId || undefined
      );
      if (single) {
        return NextResponse.json({ success: true, request: single });
      }
      return NextResponse.json({ success: false, error: "Account creation request not found" }, { status: 404 });
    }

    const requests = await getAccountCreationRequests({ status, agentId, email });
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error("GET /api/data/account-requests error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch account creation requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["agent", "owner", "admin"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const reason = String(body.reason || "").trim();
    const recipientRole = body.recipientRole === "admin" ? "admin" : "owner";
    const agentName = String(body.agentName || auth.user?.name || "Agent").trim();

    if (!name || !email) {
      return NextResponse.json({ success: false, error: "Full name and email are required" }, { status: 400 });
    }

    const requestId = `acct_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const savedRequest = await createAccountCreationRequest({
      id: requestId,
      agentId: auth.userId,
      agentName,
      name,
      email,
      phone: phone || undefined,
      address: address || undefined,
      propertyId: body.propertyId || undefined,
      propertyName: body.propertyName || undefined,
      unitId: body.unitId || undefined,
      unitNumber: body.unitNumber || undefined,
      reason: reason || undefined,
    });

    // Notify target recipients (owner and/or admin)
    const targetRoles = recipientRole === "admin" ? ["admin"] : ["owner"];
    const { data: recipientUsers } = await getAdminSupabase()
      .schema("public")
      .from("users")
      .select("id")
      .in("role", targetRoles);

    const recipientIds = (recipientUsers || []).map((u: any) => u.id);

    const messageBody = `${agentName} is requesting to create a new tenant account:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "N/A"}\nAddress: ${address || "N/A"}\nReason: ${reason || "No reason provided"}\n[Request ID: ${requestId}]`;

    await Promise.allSettled(
      recipientIds.flatMap((targetId: string) => [
        createNotification({
          userId: targetId,
          title: "Account Creation Request",
          message: `${agentName} submitted a request to create a new tenant account for ${name} (${email}).\nReason: ${reason || "No reason provided"}\n[Request ID: ${requestId}]`,
          type: "tenant",
          requestId,
          metadata: {
            requestId,
            name,
            email,
            agentId: auth.userId,
            agentName,
          },
        }),
        sendMessage(auth.userId, targetId, "Account Creation Request", messageBody),
      ])
    );

    return NextResponse.json({ success: true, request: savedRequest });
  } catch (error: any) {
    console.error("POST /api/data/account-requests error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to submit account creation request" }, { status: 500 });
  }
}
