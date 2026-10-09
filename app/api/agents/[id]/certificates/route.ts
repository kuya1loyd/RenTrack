import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureAgentProfileTables, getPublicRentManager } from "@/lib/agent-profile-api";
import { getAdminSupabase } from "@/lib/db";
import { checkRequestSize, requireRole, validateContentType, withRateLimit, withSecurityHeaders } from "@/lib/api-security";

const BUCKET = "agent-certificates";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
type CertificateMimeType = (typeof ALLOWED_TYPES)[number];
type RouteContext = { params: Promise<{ id: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return withSecurityHeaders(NextResponse.json(body, { status }));
}

function matchesFileSignature(bytes: Buffer, mimeType: CertificateMimeType) {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function safeFileName(value: string) {
  return value.replace(/[\r\n"\\/]/g, "_").trim().slice(0, 160) || "certificate";
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await ensureAgentProfileTables();
    if (!await getPublicRentManager(id)) return json({ success: false, error: "Rent Manager not found" }, 404);

    const client = getAdminSupabase();
    const { data, error } = await client
      .from("agent_certificates")
      .select("id, title, issuer, issued_on, file_name, mime_type, created_at, storage_path")
      .eq("agent_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const certificates = await Promise.all((data || []).map(async (row) => {
      const { data: signed, error: signError } = await client.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60, { download: row.file_name });
      if (signError) throw signError;
      return {
        id: row.id,
        title: row.title,
        issuer: row.issuer,
        issuedOn: row.issued_on,
        fileName: row.file_name,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        url: signed.signedUrl,
      };
    }));
    return json({ success: true, certificates });
  } catch (error) {
    console.error("Get agent certificates error:", error);
    return json({ success: false, error: "Could not load Rent Manager certificates" }, 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["agent"]);
    if (auth instanceof NextResponse) return auth;
    if (!validateContentType(request, ["multipart/form-data"])) {
      return json({ success: false, error: "Upload a PDF, JPG, or PNG certificate" }, 415);
    }
    if (!checkRequestSize(request, MAX_FILE_SIZE + 64 * 1024)) {
      return json({ success: false, error: "Certificate must be 10 MB or smaller" }, 413);
    }
    const { id } = await params;
    if (auth.userId !== id) return json({ success: false, error: "You can only upload certificates to your own profile" }, 403);
    const rateLimit = await withRateLimit(request, `agent_certificate_upload:${auth.userId}`);
    if (rateLimit) return rateLimit;

    const form = await request.formData();
    const file = form.get("file");
    const titleValue = form.get("title");
    const issuerValue = form.get("issuer");
    const issuedOnValue = form.get("issuedOn");
    if (!(file instanceof File) || typeof titleValue !== "string" || typeof issuerValue !== "string") {
      return json({ success: false, error: "Add a certificate title and choose a file" }, 400);
    }
    const title = titleValue.trim().slice(0, 120);
    const issuer = issuerValue.trim().slice(0, 120);
    const issuedOn = typeof issuedOnValue === "string" && issuedOnValue ? issuedOnValue : null;
    if (!title) return json({ success: false, error: "Enter a certificate title" }, 400);
    if (issuedOn) {
      const parsedDate = new Date(`${issuedOn}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== issuedOn) {
        return json({ success: false, error: "Enter a valid certificate date" }, 400);
      }
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return json({ success: false, error: "Certificate must be between 1 byte and 10 MB" }, 413);
    }
    if (!ALLOWED_TYPES.includes(file.type as CertificateMimeType)) {
      return json({ success: false, error: "Only PDF, JPG, and PNG certificates are supported" }, 415);
    }
    if (!await getPublicRentManager(id)) return json({ success: false, error: "Rent Manager profile not found" }, 404);

    const mimeType = file.type as CertificateMimeType;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(buffer, mimeType)) {
      return json({ success: false, error: "The selected file does not match its file type" }, 415);
    }

    await ensureAgentProfileTables();
    const client = getAdminSupabase();
    const bucketResult = await client.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: `${MAX_FILE_SIZE}`,
      allowedMimeTypes: [...ALLOWED_TYPES],
    });
    if (bucketResult.error && !bucketResult.error.message.toLowerCase().includes("already exists")) {
      throw bucketResult.error;
    }

    const certificateId = `cert_${randomUUID()}`;
    const fileName = safeFileName(file.name);
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : "png";
    const storagePath = `${id}/${certificateId}.${extension}`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: signed, error: signedError } = await client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60, { download: fileName });
    if (signedError) {
      const { error: cleanupError } = await client.storage.from(BUCKET).remove([storagePath]);
      if (cleanupError) console.error("Could not clean up certificate without a link:", cleanupError);
      throw signedError;
    }

    const { data: certificate, error: insertError } = await client
      .from("agent_certificates")
      .insert({
        id: certificateId,
        agent_id: id,
        title,
        issuer: issuer || null,
        issued_on: issuedOn,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: mimeType,
        size: buffer.byteLength,
      })
      .select("id, title, issuer, issued_on, file_name, mime_type, created_at, storage_path")
      .single();
    if (insertError) {
      const { error: cleanupError } = await client.storage.from(BUCKET).remove([storagePath]);
      if (cleanupError)       console.error("Could not clean up unrecorded agent certificate:", cleanupError);
      throw insertError;
    }

    return json({
      success: true,
      certificate: {
        id: certificate.id,
        title: certificate.title,
        issuer: certificate.issuer,
        issuedOn: certificate.issued_on,
        fileName: certificate.file_name,
        mimeType: certificate.mime_type,
        createdAt: certificate.created_at,
        url: signed.signedUrl,
      },
    }, 201);
  } catch (error) {
    console.error("Upload agent certificate error:", error);
    return json({ success: false, error: "Could not upload this certificate" }, 500);
  }
}
