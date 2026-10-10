import { NextRequest, NextResponse } from "next/server";
import { getUpload, deleteUpload } from "@/lib/db";
import { getSessionUserId, getCurrentUser } from "@/lib/security";
import { withSecurityHeaders, withCorsHeaders } from "@/lib/security-headers";
import { logAudit } from "@/lib/db";

function getIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const upload = await getUpload(resolvedParams.id);
    if (!upload || !upload.data || upload.data.length === 0) {
      return NextResponse.redirect(new URL("/images/landing/feature-property.jpg", request.url));
    }

    const isPublicUpload = ["property", "unit", "avatar"].includes(upload.type);
    const currentUser = isPublicUpload ? null : await getCurrentUser(request);
    const userId = isPublicUpload ? null : getSessionUserId(request);
    if (!isPublicUpload && !currentUser) {
      const response = NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    const canAccess = isPublicUpload || upload.user_id === userId || ["admin", "owner", "agent"].includes(currentUser?.role || "");
    if (!canAccess) {
      const response = NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      await logAudit(userId || "unknown", "upload_access_denied", { uploadId: resolvedParams.id }, getIp(request), request.headers.get("user-agent") || "unknown");
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    const buffer = Buffer.isBuffer(upload.data) ? upload.data : Buffer.from(upload.data);
    const response = new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": upload.mime_type || "application/octet-stream",
        "Cache-Control": isPublicUpload ? "public, max-age=86400, stale-while-revalidate=604800, immutable" : "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="upload_${resolvedParams.id}"`,
      },
    });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Upload fetch error:", error);
    const response = NextResponse.json({ success: false, error: "Failed to fetch file" }, { status: 500 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !["admin", "owner", "agent"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }
    const { id } = await params;
    const upload = await getUpload(id);
    if (!upload || !["property", "unit"].includes(upload.type)) {
      return NextResponse.json({ success: false, error: "Image not found" }, { status: 404 });
    }
    await deleteUpload(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upload delete error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete image" }, { status: 500 });
  }
}
