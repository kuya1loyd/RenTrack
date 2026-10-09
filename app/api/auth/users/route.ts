import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, findUserById, findUserByEmail, deleteUser, createUser, createLoginOtp, initDatabase } from "@/lib/db";
import {
  requireRole, sanitizeResponse,
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";
import { createRentTrackEmailTemplate, createVerificationOtpEmailHtml, getSiteUrl, isSmtpConfigured, sendEmail } from "@/lib/mail";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const requestedRole = request.nextUrl.searchParams.get("role");
    if (requestedRole && !["admin", "owner", "agent", "tenant"].includes(requestedRole)) {
      return NextResponse.json({ success: false, error: "Invalid role filter" }, { status: 400 });
    }

    let users = await getAllUsers();
    if (requestedRole) {
      users = users.filter((user) => user.role === requestedRole);
      if (auth.user?.role === "owner") {
        users = users.filter((user) => user.createdBy === auth.userId);
      }
    }
    const safeUsers = users.map(u => {
      const safeUser = sanitizeResponse(u);
      // Only administrators and owners may view other users' residential addresses.
      if (auth.user?.role !== "admin" && auth.user?.role !== "owner") delete (safeUser as Record<string, unknown>).address;
      return safeUser;
    });
    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const role = String(body.role || "tenant").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: "Name, email, and password are required" }, { status: 400 });
    }

    const allowedRoles = auth.user?.role === "admin"
      ? ["admin", "owner", "agent", "tenant"]
      : ["agent", "tenant"];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already exists" }, { status: 409 });
    }

    const createdBy = (role === "agent" && auth.user?.role === "owner") ? auth.userId : (auth.userId || undefined);
    // Newly created accounts require email/OTP verification to log in
    const user = await createUser(name, email, password, role, phone || undefined, undefined, address || undefined, false, createdBy);
    const otp = await createLoginOtp(user.id, 15);
    await logAudit(auth.userId, "user_created", { createdUserId: user.id, name: user.name, role: user.role, emailVerified: false }, (request as any).ip, (request as any).headers?.get("user-agent"));

    let emailSent = false;
    let emailStatus: "sent" | "not_configured" | "failed" = "not_configured";
    const origin = getSiteUrl(request.nextUrl.origin);
    const verifyUrl = `${origin}/verify-otp?email=${encodeURIComponent(user.email)}`;
    const loginUrl = `${origin}/login?email=${encodeURIComponent(user.email)}`;
    const devShowOtp = process.env.DEV_SHOW_OTP === "true";

    try {
      await sendEmail({
        to: user.email,
        subject: role === "agent"
          ? "Your RentTrack agent account is ready - Verify Your Account"
          : `Your RentTrack ${role} account has been created - Verify Your Account`,
        text: `Hello ${user.name},\n\nYour RentTrack account has been created.\n\nUsername: ${user.email}\nPassword: ${password}\nRole: ${user.role}\n\nYour 6-Digit Verification Code: ${otp}\n\nPlease verify your account before logging in:\n${verifyUrl}\n\nOr sign in at: ${loginUrl}\n(You will be prompted to enter your verification code.)\n\nPlease change your password after signing in.`,
        html: createVerificationOtpEmailHtml({
          title: role === "agent" ? "Your Agent Account is Ready" : `Your ${role.charAt(0).toUpperCase() + role.slice(1)} Account is Ready`,
          name: user.name,
          code: otp,
          verifyUrl,
          loginUrl,
          credentials: {
            email: user.email,
            password,
            role: user.role,
          },
        }),
      });
      emailSent = true;
      emailStatus = "sent";
    } catch (emailError) {
      console.error("Account created but credentials email failed:", emailError);
      emailStatus = isSmtpConfigured() ? "failed" : "not_configured";
    }

    return NextResponse.json({
      success: true,
      user: sanitizeResponse(user),
      emailSent,
      emailStatus,
      needsOtp: true,
      ...(devShowOtp ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ success: false, error: "Failed to create user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "admin") {
      return NextResponse.json({ success: false, error: "Cannot delete admin users" }, { status: 403 });
    }

    if (targetUser.id === auth.userId) {
      return NextResponse.json({ success: false, error: "Cannot delete your own account" }, { status: 400 });
    }

    await deleteUser(userId);

    await logAudit(auth.userId, "user_deleted", { deletedUserId: userId, deletedUserName: targetUser.name }, (request as any).ip, (request as any).headers?.get("user-agent"));
    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete user" }, { status: 500 });
  }
}
