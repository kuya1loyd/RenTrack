import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, findUserById, findUserByEmail, deleteUser, createUser, initDatabase } from "@/lib/db";
import {
  requireRole, sanitizeResponse,
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";
import { createRentTrackEmailTemplate, getSiteUrl, isSmtpConfigured, sendEmail } from "@/lib/mail";

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

    if (!["tenant", "agent", "owner"].includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already exists" }, { status: 409 });
    }

    const createdBy = role === "agent" && auth.user?.role === "owner" ? auth.userId : undefined;
    const user = await createUser(name, email, password, role, phone || undefined, undefined, address || undefined, true, createdBy);
    await logAudit(auth.userId, "user_created", { createdUserId: user.id, name: user.name, role: user.role }, (request as any).ip, (request as any).headers?.get("user-agent"));

    let emailSent = false;
    let emailStatus: "sent" | "not_configured" | "failed" = "not_configured";
    try {
      const loginUrl = `${getSiteUrl(request.nextUrl.origin)}/login`;
      await sendEmail({
        to: user.email,
        subject: role === "agent" ? "Your RentTrack agent account is ready" : "Your RentTrack account has been created",
        text: `Hello ${user.name},\n\nYour RentTrack account has been created.\n\nUsername: ${user.email}\nPassword: ${password}\nRole: ${user.role}\n\nSign in at: ${loginUrl}\n\nPlease change your password after signing in.`,
        html: createRentTrackEmailTemplate({
          title: role === "agent" ? "Your agent account is ready" : "Your account is ready",
          body: `Hello ${user.name},\n\nYour RentTrack account has been created by an owner or administrator.`,
          messageBlock: `Username: ${user.email}\nPassword: ${password}\nRole: ${user.role}`,
          ctaLabel: "Sign in to RentTrack",
          ctaUrl: loginUrl,
          footerNote: "Please change your password after signing in. Keep this email private.",
        }),
      });
      emailSent = true;
      emailStatus = "sent";
    } catch (emailError) {
      console.error("Account created but credentials email failed:", emailError);
      emailStatus = isSmtpConfigured() ? "failed" : "not_configured";
    }

    return NextResponse.json({ success: true, user: sanitizeResponse(user), emailSent, emailStatus });
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
