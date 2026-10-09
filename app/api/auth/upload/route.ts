import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security";
import { createUpload, getUpload, updateUserAvatar, updateUserIdVerification, createNotification, supabase, getAdminSupabase, findUserById } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!type || !["avatar", "id_verification", "property", "unit", "receipt"].includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid upload type" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploader = await findUserById(userId);
    const id = await createUpload({ userId, userType: uploader?.role, type, buffer, mimeType: file.type, size: file.size });

    const url = `/api/auth/upload/${id}`;

    if (type === "avatar") {
      await updateUserAvatar(userId, url);
    } else if (type === "id_verification") {
      await updateUserIdVerification(userId, url, "pending");

      const uploader = await getAdminSupabase().schema("public").from("users").select("name, email, role").eq("id", userId).single();
      const uploaderName = uploader.data?.name || "A user";
      const uploaderRole = uploader.data?.role || "user";

      const admins = await getAdminSupabase().schema("public").from("users").select("id").in("role", ["admin", "owner"]);
      for (const admin of admins.data || []) {
        await createNotification({
          userId: admin.id,
          title: "ID Upload Pending Review",
          message: `${uploaderName} (${uploaderRole}) has uploaded an ID for verification.`,
          type: "system",
        });
      }
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
