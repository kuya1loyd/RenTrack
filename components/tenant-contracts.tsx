"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { safeParseJson } from "@/lib/data";

type TenantContract = {
  id: string;
  title: string;
  propertyName: string;
  fileName?: string;
  status: "requested" | "sent" | "rejected";
  createdAt: string;
};

export default function TenantContracts() {
  const [contracts, setContracts] = useState<TenantContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/data/contracts", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await safeParseJson(response);
        if (!response.ok || !result.success) throw new Error(result.error || "Could not load contracts");
        if (active) setContracts(result.contracts || []);
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load contracts");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary-600" />Documents sent to you</CardTitle>
        <CardDescription>Download rental contracts shared directly by your property owner.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="py-5 text-center text-sm text-text-secondary">Loading your contracts...</p>
        ) : contracts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-7 text-center">
            <FileText className="mx-auto mb-2 h-7 w-7 text-text-tertiary" />
            <p className="text-sm font-medium text-text-secondary">No documents sent directly to you yet</p>
          </div>
        ) : contracts.map((contract) => (
          <div key={contract.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-text-primary">{contract.title}</p>
                <Badge variant={contract.status === "sent" ? "success" : contract.status === "requested" ? "warning" : "outline"} className="capitalize">{contract.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-text-secondary">{contract.propertyName} · Sent {formatDate(contract.createdAt)}</p>
              {contract.fileName && <p className="mt-1 truncate text-xs text-text-tertiary">{contract.fileName}</p>}
            </div>
            {contract.status === "sent" && (
              <a href={`/api/data/contracts/${encodeURIComponent(contract.id)}/file`} className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border px-3 text-sm font-medium text-text-primary hover:bg-surface-secondary">
                <Download className="mr-2 h-4 w-4" />Download
              </a>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
