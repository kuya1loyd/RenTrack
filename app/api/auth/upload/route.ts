import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security";
import { createUpload, updateUserAvatar, updateUserIdVerification, createNotification, getAdminSupabase, findUserById } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawType = (formData.get("type") as string || "property").trim().toLowerCase();

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const typeMap: Record<string, string> = {
      property: "property",
      properties: "property",
      unit: "unit",
      units: "unit",
      avatar: "avatar",
      id_verification: "id_verification",
      receipt: "receipt",
      contract: "contract",
    };

    const type = typeMap[rawType] || "property";

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploader = await findUserById(userId).catch(() => null);
    const id = await createUpload({
      userId,
      userType: uploader?.role,
      type,
      buffer,
      mimeType: file.type || "image/jpeg",
      size: file.size || buffer.length,
    });

    const url = `/api/auth/upload/${id}`;

    if (type === "avatar") {
      await updateUserAvatar(userId, url).catch(() => null);
    } else if (type === "id_verification") {
      await updateUserIdVerification(userId, url, "pending").catch(() => null);

      try {
        const uploaderUser = await getAdminSupabase().schema("public").from("users").select("name, email, role, created_by").eq("id", userId).single();
        const uploaderName = uploaderUser.data?.name || "A user";
        const uploaderRole = uploaderUser.data?.role || "user";
        const creatorOwnerId = uploaderUser.data?.created_by;

        const recipientIds = new Set<string>();
        const admins = await getAdminSupabase().schema("public").from("users").select("id").eq("role", "admin");
        for (const admin of admins.data || []) {
          recipientIds.add(admin.id);
        }
        if (uploaderRole === "agent" && creatorOwnerId) {
          recipientIds.add(creatorOwnerId);
        } else if (uploaderRole !== "agent") {
          const owners = await getAdminSupabase().schema("public").from("users").select("id").eq("role", "owner");
          for (const owner of owners.data || []) {
            recipientIds.add(owner.id);
          }
        }

        for (const recipientId of recipientIds) {
          await createNotification({
            userId: recipientId,
            title: uploaderRole === "agent" ? "Agent ID Upload Pending Review" : "ID Upload Pending Review",
            message: `${uploaderName} (${uploaderRole}) has uploaded an ID for verification.`,
            type: "id_verification",
          }).catch(() => null);
        }
      } catch (notifErr) {
        console.warn("ID verification notification skipped:", notifErr);
      }
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
