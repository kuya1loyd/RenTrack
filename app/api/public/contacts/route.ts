import { NextResponse } from "next/server";
import { getAllUsers, initDatabase } from "@/lib/db";
import { withSecurityHeaders } from "@/lib/api-security";

export async function GET() {
  try {
    await initDatabase();
    const users = await getAllUsers();
    const visibleContacts = users
      .filter((user: any) => user.role === "owner" && user.profileVisibility !== false)
      .map((user: any) => ({
        role: user.role,
        name: user.name || "Property Owner",
        email: user.email || "renttrackowner@gmail.com",
        phone: user.phone || "09395158432",
      }));

    const owners = visibleContacts.map(({ role: _role, ...contact }) => contact);
    const finalOwners = owners.length ? owners : [{ name: "Property Owner", email: "renttrackowner@gmail.com", phone: "09395158432" }];

    return withSecurityHeaders(NextResponse.json({
      success: true,
      admins: [],
      owners: finalOwners,
    }, { headers: { "Cache-Control": "no-store" } }));
  } catch (error) {
    console.error("Public contacts lookup failed:", error);
    return withSecurityHeaders(NextResponse.json({ success: false, error: "Contacts are unavailable" }, { status: 500 }));
  }
}