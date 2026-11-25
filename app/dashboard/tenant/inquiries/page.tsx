"use client";

import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ManagementBanner } from "@/components/management-panel";
import { MyInquiriesSection, MyRentalCard, useMyRental } from "@/components/tenant-my-rental";

export default function TenantInquiriesPage() {
  const { user } = useAuth();
  const myRental = useMyRental(Boolean(user));

  return (
    <div className="space-y-6 pb-10">
      <ManagementBanner
        category="INQUIRY TRACKER"
        title="My Inquiries & Approved Rental"
        description="Track every condominium unit or house property you inquired about, read agent replies, and view your owner-approved rental."
        icon={MessageCircle}
      />

      {/* Tenant's Approved / Pending Assigned Rental */}
      <MyRentalCard state={myRental} hideWhenEmpty />

      {/* All Units & Properties Inquired About */}
      <MyInquiriesSection state={myRental} />
    </div>
  );
}
