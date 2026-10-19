import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Helper function to extract GCash Reference Number from OCR text
export function parseGcashReference(text: string): string | null {
  if (!text) return null;

  const clean = text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");

  // 1. Matches "Ref No.", "Reference No.", "Ref. No.", "Ref:", "Reference #", "Transaction No.", etc.
  // Also tolerate letter O or o mistranscribed for 0
  const normalizedForDigits = clean.replace(/(?:ref(?:erence)?|trans(?:action)?)[^0-9a-z]*([0-9o\s.-]{7,28})/i, (match, p1) => {
    return "REF_" + p1.replace(/[oO]/g, "0");
  });

  const labeledRegex = /(?:REF_|ref(?:erence)?(?:\s*(?:no\.?|num(?:ber)?|#))?[:\s.-]*)([0-9][0-9\s.-]{7,25}[0-9])/i;
  const match = normalizedForDigits.match(labeledRegex) || clean.match(labeledRegex);
  if (match && match[1]) {
    const digits = match[1].replace(/[^0-9]/g, "");
    if (digits.length >= 8 && digits.length <= 18) {
      if (digits.length >= 12 && digits.length <= 15) {
        return digits.slice(0, 4) + " " + digits.slice(4, 8) + " " + digits.slice(8);
      }
      return digits;
    }
  }

  // 2. Common GCash 4-4-4 or 4-4-5 grouping: e.g. "1002 9841 8294" or "0012 8492 8421"
  const groupedRegex = /\b([0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4,5})\b/;
  const groupedMatch = clean.match(groupedRegex);
  if (groupedMatch && groupedMatch[1]) {
    const rawGroup = groupedMatch[1].replace(/[^0-9]/g, "");
    if (rawGroup.length >= 12) {
      return rawGroup.slice(0, 4) + " " + rawGroup.slice(4, 8) + " " + rawGroup.slice(8);
    }
    return groupedMatch[1].trim();
  }

  // 3. Fallback: Any 11-16 digit standalone sequence (ignoring typical 09xxxxxxxxx phone numbers unless >11 digits)
  const digitsRegex = /\b([0-9]{11,16})\b/g;
  const allDigits = clean.match(digitsRegex);
  if (allDigits && allDigits.length > 0) {
    const nonMobile = allDigits.find((d) => !d.startsWith("09") || d.length > 11);
    const chosen = (nonMobile || allDigits[0]).replace(/[^0-9]/g, "");
    if (chosen.length >= 12 && chosen.length <= 15) {
      return chosen.slice(0, 4) + " " + chosen.slice(4, 8) + " " + chosen.slice(8);
    }
    return chosen;
  }

  return null;
}

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;
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

    // Write to a temporary file for standalone runner (avoids Next.js webpack worker thread issues)
    const ext = path.extname(file.name) || ".jpg";
    tempFilePath = path.join(os.tmpdir(), `gcash_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    fs.writeFileSync(tempFilePath, buffer);

    const scriptPath = path.join(process.cwd(), "scripts", "ocr-extract.mjs");
    const nodeExecutable = process.execPath || "node";

    const rawText = await new Promise<string>((resolve, reject) => {
      execFile(nodeExecutable, [scriptPath, tempFilePath!], { timeout: 10000 }, (error, stdout) => {
        if (error) {
          return reject(error);
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.success) {
            resolve(parsed.text || "");
          } else {
            reject(new Error(parsed.error || "OCR failed"));
          }
        } catch {
          resolve(stdout || "");
        }
      });
    });

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
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}
    }
  }
}
