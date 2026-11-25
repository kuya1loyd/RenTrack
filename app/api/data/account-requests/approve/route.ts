import { NextRequest, NextResponse } from "next/server";
import { approveAccountCreationRequest } from "@/lib/db";
import { requireRole } from "@/lib/api-security";
import { createAccountCredentialsEmailHtml, getSiteUrl, isSmtpConfigured, sendEmail } from "@/lib/mail";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const requestId = body.requestId ? String(body.requestId).trim() : undefined;
    const password = String(body.password || "").trim();
    const name = body.name ? String(body.name).trim() : undefined;
    const email = body.email ? String(body.email).trim().toLowerCase() : undefined;
    const phone = body.phone ? String(body.phone).trim() : undefined;
    const address = body.address ? String(body.address).trim() : undefined;
    const propertyName = body.propertyName ? String(body.propertyName).trim() : undefined;
    const unitNumber = body.unitNumber ? String(body.unitNumber).trim() : undefined;
    const unitId = body.unitId ? String(body.unitId).trim() : undefined;
    const agentId = body.agentId ? String(body.agentId).trim() : undefined;

    if (!password) {
      return NextResponse.json({ success: false, error: "A temporary password is required to approve and create the tenant account" }, { status: 400 });
    }

    const result = await approveAccountCreationRequest({
      requestId,
      reviewerId: auth.userId,
      password,
      name,
      email,
      phone,
      address,
      propertyName,
      unitNumber,
      unitId,
      agentId,
    });

    if (result.alreadyApproved) {
      return NextResponse.json({
        success: true,
        alreadyApproved: true,
        message: result.message || "This account request has already been approved.",
      });
    }

    let emailSent = false;
    let emailStatus: "sent" | "not_configured" | "failed" = "not_configured";
    const origin = getSiteUrl(request.nextUrl.origin);
    const tenantEmail = result.user?.email || email;
    const tenantName = result.user?.name || name || "Tenant";

    if (tenantEmail) {
      try {
        const loginUrl = `${origin}/login?email=${encodeURIComponent(tenantEmail)}`;
        await sendEmail({
          to: tenantEmail,
          subject: "Your RentTrack tenant account details",
          text: `Hello ${tenantName},\n\nYour RentTrack tenant account has been created.\n\nUsername / Email: ${tenantEmail}\nTemporary Password: ${password}\nRole: tenant\n\nSign in at: ${loginUrl}\n\nPlease change your temporary password after logging in.`,
          html: createAccountCredentialsEmailHtml({
            title: "Your Tenant Account Details",
            name: tenantName,
            role: "tenant",
            credentials: {
              email: tenantEmail,
              password,
              role: "tenant",
            },
            loginUrl,
          }),
        });
        emailSent = true;
        emailStatus = "sent";
      } catch (err) {
        console.error("Account creation email send error:", err);
        emailStatus = isSmtpConfigured() ? "failed" : "not_configured";
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.user,
      emailSent,
      emailStatus,
    });
  } catch (error: any) {
    console.error("POST /api/data/account-requests/approve error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to approve account request" }, { status: 500 });
  }
}
