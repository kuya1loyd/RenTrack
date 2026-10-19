import { NextRequest, NextResponse } from "next/server";
import { parseGcashReference } from "@/lib/utils";
import { createWorker } from "tesseract.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { parseGcashReference };

export async function POST(req: NextRequest) {
  let worker: any = null;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }

    // Quick filename check (e.g., if user named receipt with reference number)
    const filenameRef = parseGcashReference(file.name);
    if (filenameRef) {
      return NextResponse.json({
        success: true,
        referenceNumber: filenameRef,
        source: "filename",
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText = "";
    try {
      worker = await createWorker("eng");
      const ret = await worker.recognize(buffer);
      rawText = ret?.data?.text || "";
    } catch (workerErr) {
      console.warn("Server OCR recognition error:", workerErr);
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {}
      }
    }

    const extractedRef = parseGcashReference(rawText);

    return NextResponse.json({
      success: Boolean(extractedRef),
      referenceNumber: extractedRef,
      rawText: rawText.slice(0, 300),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        referenceNumber: null,
        message: error instanceof Error ? error.message : "OCR unavailable",
      },
      { status: 200 }
    );
  }
}
