import { NextRequest, NextResponse } from "next/server";
import { setUserPaymentPin, initDatabase } from "@/lib/db";
import {
  requireAuth, validateApiRequest,
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { currentPassword, paymentPin } = await request.json();
    if (!currentPassword || !paymentPin) {
      return NextResponse.json({ success: false, error: "Missing current password or payment PIN" }, { status: 400 });
    }

    const user = auth.user;
    if (user.role !== "tenant") {
      return NextResponse.json({ success: false, error: "Only tenant accounts need a payment PIN" }, { status: 403 });
    }

    const bcrypt = (await import("bcryptjs")).default;
    const passwordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatches) {
      await logAudit(auth.userId, "payment_pin_failed", { reason: "invalid_password" }, auth.ip, auth.userAgent);
      return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });
    }

    if (!/^\d{4,6}$/.test(String(paymentPin).trim())) {
      return NextResponse.json({ success: false, error: "Payment PIN must be 4 to 6 digits" }, { status: 400 });
    }

    await setUserPaymentPin(auth.userId, String(paymentPin).trim());
    await logAudit(auth.userId, "payment_pin_set", {}, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true, message: "Payment PIN saved" });
  } catch (error) {
    console.error("Payment PIN update error:", error);
    return NextResponse.json({ success: false, error: "Failed to save payment PIN" }, { status: 500 });
  }
}
