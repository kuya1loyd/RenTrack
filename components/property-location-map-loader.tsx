"use client";

import dynamic from "next/dynamic";

const PropertyLocationMap = dynamic(() => import("@/components/property-location-map"), {
  ssr: false,
  loading: () => <div role="status" className="flex h-105 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">Loading map…</div>,
});

export default PropertyLocationMap;