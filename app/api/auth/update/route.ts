import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, findUserById, initDatabase } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  requireAuth, validateApiRequest,
} from "@/lib/api-security";

const ALLOWED_UPDATE_FIELDS = ["name", "email", "phone", "gender", "birthdate", "address", "avatarUrl", "avatar_url"];

export async function PATCH(request: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json();
    const { id, currentPassword, newPassword } = body;

    if (id && id !== auth.userId) {
      return NextResponse.json({ success: false, error: "Not allowed to update another user" }, { status: 403 });
    }

    if (currentPassword && newPassword) {
      const user = await findUserById(auth.userId);
      if (!user) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      const passwordMatches = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatches) {
        return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json({ success: false, error: "New password must be at least 6 characters" }, { status: 400 });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      const { error: passwordError } = await getAdminSupabase()
        .schema("public").from("users")
        .update({ password: newHash })
        .eq("id", auth.userId);

      if (passwordError) {
        console.error("Password update error:", passwordError);
        return NextResponse.json({ success: false, error: "Failed to update password" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Password changed successfully" });
    }

    const updateData: any = {};

    for (const [key, val] of Object.entries(body)) {
      if (key === "id") continue;
      if (!ALLOWED_UPDATE_FIELDS.includes(key)) continue;
      if (val === undefined || val === null) continue;

      if (key === "avatarUrl" || key === "avatar_url") {
        updateData["avatar_url"] = String(val);
      } else if (key === "email") {
        const sanitized = String(val).toLowerCase().trim().replace(/[^a-zA-Z0-9@._+-]/g, "");
        if (!sanitized.includes("@")) {
          return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
        }
        updateData["email"] = sanitized;
      } else if (key === "phone") {
        updateData["phone"] = String(val).replace(/[^0-9+]/g, "").slice(0, 20);
      } else if (key === "birthdate") {
        const dateValue = String(val).trim();
        if (dateValue) {
          updateData["birthdate"] = dateValue;
        }
      } else {
        updateData[key] = String(val).replace(/[<>]/g, "").slice(0, 200);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await getAdminSupabase()
      .schema("public").from("users")
      .update(updateData)
      .eq("id", auth.userId);

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ success: false, error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ success: false, error: "Failed to update profile" }, { status: 500 });
  }
}
