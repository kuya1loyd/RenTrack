import { NextRequest, NextResponse } from "next/server";
import { createAgentApplication, getAgentApplications, initDatabase, getAdminSupabase, createNotification, reviewAgentApplication, reopenAgentApplication, removeRejectedAgentApplication, createUser, deleteUser, findUserByEmail } from "@/lib/db";
import { requireRole } from "@/lib/api-security";
import { createRentTrackEmailTemplate, getSiteUrl, sendEmail } from "@/lib/mail";
import { randomBytes } from "crypto";

const LOCATIONS = ["Cebu", "Manila", "Davao", "Butuan"];

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const address = String(form.get("address") || "");
    const resume = form.get("resume");
    if (!name || !email || !address || !LOCATIONS.includes(address) || !(resume instanceof File)) {
      return NextResponse.json({ success: false, error: "Name, email, location, and resume are required" }, { status: 400 });
    }
    if (resume.size > 5 * 1024 * 1024 || !["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(resume.type)) {
      return NextResponse.json({ success: false, error: "Resume must be a PDF or Word document up to 5 MB" }, { status: 400 });
    }
    const existing = await getAdminSupabase().from("agent_applications").select("id, status").eq("email", email).eq("status", "pending").maybeSingle();
    if (existing.data) return NextResponse.json({ success: false, error: "You already have a pending application" }, { status: 409 });

    const phone = String(form.get("phone") || "").trim() || undefined;
    const gender = String(form.get("gender") || "").trim() || undefined;
    const birthdate = String(form.get("birthdate") || "").trim() || undefined;

    const application = await createAgentApplication({
      name,
      email,
      address,
      phone,
      gender,
      birthdate,
      resumeData: Buffer.from(await resume.arrayBuffer()),
      resumeName: resume.name,
      resumeMimeType: resume.type,
    });

    let confirmationEmailSent = false;
    try {
      await sendEmail({
        to: email,
        subject: "We received your RentTrack agent application",
        text: `Hello ${name},\n\nThank you for applying to become a RentTrack agent. We received your application for ${address} and our team will review it. We will email you when a decision has been made.`,
        html: createRentTrackEmailTemplate({
          title: "Application received",
          body: `Hello ${name},\n\nThank you for applying to become a RentTrack agent. We received your application and our team will review it. We will email you when a decision has been made.`,
          messageBlock: `Application: Agent\nLocation: ${address}`,
          footerNote: "This is an automated confirmation. Please keep this email for your records.",
        }),
      });
      confirmationEmailSent = true;
    } catch (emailError) {
      console.error("Agent application confirmation email failed:", emailError);
    }

    try {
      const { data: owners, error: ownersError } = await getAdminSupabase()
        .schema("public")
        .from("users")
        .select("id")
        .in("role", ["owner", "admin"]);
      if (ownersError) throw ownersError;

      const notificationResults = await Promise.allSettled((owners || []).map((owner: { id: string }) => createNotification({
        userId: owner.id,
        title: "New Agent Applicant",
        message: `${name} applied to become an agent in ${address}.`,
        type: "system",
        read: false,
      })));
      notificationResults.forEach((result) => {
        if (result.status === "rejected") console.warn("Owner notification failed:", result.reason);
      });
    } catch (notifError) {
      console.warn("Owner notification failed:", notifError);
    }

    return NextResponse.json({ success: true, application, confirmationEmailSent });
  } catch (error: any) {
    console.error("Agent application error:", error);
    const errorMessage = error?.message || (typeof error === "string" ? error : "Unable to submit application");
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin"]);
  if (auth instanceof NextResponse) return auth;
  try {
    const applications = await getAgentApplications(new URL(request.url).searchParams.get("status") || undefined);
    return NextResponse.json({ success: true, applications });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load applications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin"]);
  if (auth instanceof NextResponse) return auth;
  try {
    await initDatabase();
    const { id, status, action, rejectionReason: rawRejectionReason } = await request.json();
    if (action === "reopen") {
      if (!id) return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 });
      const application = await reopenAgentApplication(id);
      return NextResponse.json({ success: true, application });
    }
    if (!id || !["approved", "rejected"].includes(status)) return NextResponse.json({ success: false, error: "Invalid review request" }, { status: 400 });
    const rejectionReason = typeof rawRejectionReason === "string" ? rawRejectionReason.trim() : "";
    if (status === "rejected" && (!rejectionReason || rejectionReason.length > 1000)) {
      return NextResponse.json({ success: false, error: "A rejection reason of 1 to 1000 characters is required" }, { status: 400 });
    }

    if (status === "approved") {
      const application = (await getAgentApplications("pending")).find((item) => item.id === id);
      if (!application) return NextResponse.json({ success: false, error: "Pending application not found" }, { status: 404 });

      if (await findUserByEmail(application.email)) {
        return NextResponse.json({ success: false, error: "An account already exists for this applicant email" }, { status: 409 });
      }

      const temporaryPassword = "NewPassword123";
      const agent = await createUser(
        application.name,
        application.email,
        temporaryPassword,
        "agent",
        application.phone || undefined,
        undefined,
        application.address,
        true,
        auth.user?.role === "owner" ? auth.userId : undefined
      );

      let reviewedApplication;
      try {
        reviewedApplication = await reviewAgentApplication(id, status, auth.userId);
      } catch (reviewError) {
        await deleteUser(agent.id);
        throw reviewError;
      }

      let emailSent = false;
      try {
        const loginUrl = `${getSiteUrl(request.nextUrl.origin)}/login`;
        await sendEmail({
          to: application.email,
          subject: "Your RentTrack agent account is ready",
          text: `Hello ${application.name},\n\nYour agent application has been approved.\n\nUsername: ${application.email}\nTemporary password: ${temporaryPassword}\n\nSign in at: ${loginUrl}\n\nBefore your first sign-in, request a verification code from the verification page. Please change your password after signing in.`,
          html: createRentTrackEmailTemplate({
            title: "Your agent account is ready",
            body: `Hello ${application.name},\n\nYour agent application has been approved. Sign in using the temporary credentials below.`,
            messageBlock: `Username: ${application.email}\nTemporary password: ${temporaryPassword}`,
            ctaLabel: "Sign in to RentTrack",
            ctaUrl: loginUrl,
            footerNote: "Request a verification code before your first sign-in, then change your password. Keep this email private.",
          }),
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Approved agent credentials email failed:", emailError);
      }

      try {
        await createNotification({ userId: auth.userId, title: "Agent application approved", message: `${application.name}'s agent account was created.`, type: "system", read: false });
      } catch (notificationError) {
        console.warn("Agent review notification failed:", notificationError);
      }
      return NextResponse.json({ success: true, application: reviewedApplication, agent, emailSent, ...(!emailSent ? { temporaryPassword } : {}) });
    }

    const application = await reviewAgentApplication(id, status, auth.userId, rejectionReason);
    let emailSent = false;
    try {
      await sendEmail({
        to: application.email,
        subject: "An update on your RentTrack agent application",
        text: `Hello ${application.name},\n\nThank you for applying to become a RentTrack agent. After reviewing your application, we are unable to move forward at this time.\n\nReason: ${rejectionReason}\n\nThank you for your interest in RentTrack.`,
        html: createRentTrackEmailTemplate({
          title: "Application update",
          body: `Hello ${application.name},\n\nThank you for applying to become a RentTrack agent. After reviewing your application, we are unable to move forward at this time. The reason is included below.`,
          messageBlock: `Reason for rejection:\n${rejectionReason}`,
          footerNote: "Thank you for your interest in RentTrack.",
        }),
      });
      emailSent = true;
    } catch (emailError) {
      console.error("Agent application rejection email failed:", emailError);
    }
    try {
      await createNotification({ userId: auth.userId, title: `Agent application ${status}`, message: `${application.name}'s application was ${status}.`, type: "system", read: false });
    } catch (notificationError) {
      console.warn("Agent review notification failed:", notificationError);
    }
    return NextResponse.json({ success: true, application, emailSent });
  } catch (error) {
    console.error("Agent application review failed:", error);
    const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : error instanceof Error && error.message
        ? error.message
        : "Unable to review application";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await request.json();
    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 });
    }

    const removed = await removeRejectedAgentApplication(id.trim());
    if (!removed) {
      return NextResponse.json({ success: false, error: "Rejected application not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rejected agent application removal failed:", error);
    return NextResponse.json({ success: false, error: "Unable to remove rejected application" }, { status: 500 });
  }
}
