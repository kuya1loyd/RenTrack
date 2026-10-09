import { NextResponse } from "next/server";
import { getAllUsers, initDatabase } from "@/lib/db";
import { withSecurityHeaders } from "@/lib/api-security";

export async function GET() {
  try {
    await initDatabase();
    const users = await getAllUsers();
    const visibleContacts = users
      .filter((user: any) => ["admin", "owner"].includes(user.role) && user.profileVisibility !== false)
      .map((user: any) => ({
        role: user.role,
        name: user.name || (user.role === "admin" ? "RentTrack Support" : "Property Owner"),
        email: user.role === "owner" ? user.email || "" : user.showEmail === true ? user.email || "" : user.role === "admin" ? "admin@renttrack.com" : "",
        phone: user.role === "owner" ? user.phone || "" : user.showPhone === true ? user.phone || "" : "",
      }));

    const admins = visibleContacts.filter((contact) => contact.role === "admin").map(({ role: _role, ...contact }) => contact);
    const owners = visibleContacts.filter((contact) => contact.role === "owner").map(({ role: _role, ...contact }) => contact);

    return withSecurityHeaders(NextResponse.json({
      success: true,
      admins: admins.length ? admins : [{ name: "RentTrack Support", email: "admin@renttrack.com", phone: "" }],
      owners,
    }, { headers: { "Cache-Control": "no-store" } }));
  } catch (error) {
    console.error("Public contacts lookup failed:", error);
    return withSecurityHeaders(NextResponse.json({ success: false, error: "Contacts are unavailable" }, { status: 500 }));
  }
}