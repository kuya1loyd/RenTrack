"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Eye, EyeOff, FileText, Loader2, Search, Send, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth, getPortalAuthHeaders, savePortalAuthToken } from "@/lib/auth";
import { getAgents, getProperties, getTenants, getUnits, safeParseJson, Property, TenantRecord, Unit, UserRecord } from "@/lib/data";
import { cn, formatDate } from "@/lib/utils";
import { downloadExcelReport } from "@/lib/report-downloads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManagementBanner } from "@/components/management-panel";

type Contract = {
  id: string;
  ownerId: string;
  agentId?: string;
  propertyId: string;
  propertyName: string;
  tenantId?: string;
  tenantName?: string;
  title: string;
  message?: string;
  fileName?: string;
  status: "requested" | "sent" | "rejected";
  createdAt: string;
};

const CONTRACT_PAGE_SIZE = 10;

function ContractsPagination({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / CONTRACT_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = total === 0 ? 0 : (currentPage - 1) * CONTRACT_PAGE_SIZE + 1;
  const end = Math.min(currentPage * CONTRACT_PAGE_SIZE, total);
  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {start}–{end} of {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span className="tabular-nums">Page {currentPage} of {pages}</span>
        <button type="button" disabled={currentPage >= pages} onClick={() => onPageChange(currentPage + 1)} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export default function ContractsPanel({ mode }: { mode: "owner" | "agent" }) {
  const { user, setUser } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [agents, setAgents] = useState<UserRecord[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [recipientType, setRecipientType] = useState<"agent" | "tenant">("agent");
  const [title, setTitle] = useState("Rental contract");
  const [file, setFile] = useState<File | null>(null);
  const [preparingFile, setPreparingFile] = useState(false);
  const [uploadingContractId, setUploadingContractId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showOwnerSendModal, setShowOwnerSendModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contractSearch, setContractSearch] = useState("");
  const [contractStatus, setContractStatus] = useState("all");
  const [contractProperty, setContractProperty] = useState("all");
  const [contractUnit, setContractUnit] = useState("all");
  const [contractPage, setContractPage] = useState(1);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthEmail, setReauthEmail] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const reauthPasswordRef = useRef<HTMLInputElement | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ form: FormData; successMessage: string; closeOwnerModal?: boolean } | null>(null);

  const visibleProperties = useMemo(() => {
    if (mode !== "agent") return properties;
    const assigned = properties.filter((property) => property.agentId === user?.id || (property as any).agent_id === user?.id);
    return assigned.length > 0 ? assigned : properties;
  }, [mode, properties, user?.id]);

  const visibleCondoUnits = useMemo(() => {
    const condoOnly = units.filter((u) => !["house", "villa", "residential"].includes((u.type || "").toLowerCase()));
    if (mode !== "agent") return condoOnly;
    const assigned = condoOnly.filter((u) => (u as any).agentId === user?.id || (u as any).agent_id === user?.id);
    return assigned.length > 0 ? assigned : condoOnly;
  }, [mode, units, user?.id]);

  const hasSelectableTargets = visibleProperties.length > 0 || visibleCondoUnits.length > 0;

  const formatCondoUnitOption = (u: Unit) => {
    const parentProp = u.propertyId ? properties.find((p) => p.id === u.propertyId) : undefined;
    const cleanNum = String(u.unitNumber || "").replace(/^unit\s*#?\s*/i, "").trim();
    const building = String(u.name || parentProp?.name || "").trim();
    const base = cleanNum && building ? `Unit ${cleanNum} – ${building}` : cleanNum ? `Unit ${cleanNum}` : building || "Condominium Unit";
    return u.tenantName ? `${base} (${u.tenantName})` : base;
  };

  const propertyUnits = useMemo(() => units.filter((unit) => (unit.propertyId || (unit as any).property_id) === propertyId), [units, propertyId]);
  const eligibleTenants = useMemo(() => {
    return (tenants || []).filter((tenant) => {
      if (tenant.status === "archived" || tenant.status === "inactive") return false;
      if ((tenant as any).isArchived || (tenant as any).deleted) return false;
      return true;
    });
  }, [tenants]);

  const propertyTenants = useMemo(() => {
    if (!propertyId) {
      return eligibleTenants;
    }
    const normUnit = (v: unknown) => String(v || "").replace(/^unit\s*#?\s*/i, "").trim().toLowerCase();
    const selectedCondo = units.find((u) => u.id === propertyId);
    if (selectedCondo) {
      const targetNum = normUnit(selectedCondo.unitNumber);
      const targetName = String(selectedCondo.name || "").trim().toLowerCase();
      return eligibleTenants.filter((tenant) => {
        if (tenant.unitId === selectedCondo.id) return true;
        if (selectedCondo.tenantId && selectedCondo.tenantId === tenant.id) return true;
        if (selectedCondo.tenantName && tenant.name.trim().toLowerCase() === selectedCondo.tenantName.trim().toLowerCase()) return true;
        if (targetNum && normUnit(tenant.unitNumber) === targetNum) {
          if (!targetName || !tenant.propertyName) return true;
          const tProp = tenant.propertyName.trim().toLowerCase();
          if (tProp === targetName || tProp.includes(targetName) || targetName.includes(tProp)) return true;
        }
        return false;
      });
    }

    const matched = eligibleTenants.filter((tenant) => {
      if (propertyUnits.some((unit) => unit.id === tenant.unitId)) return true;
      const prop = properties.find((p) => p.id === propertyId);
      if (prop && tenant.propertyName) {
        const pName = prop.name.trim().toLowerCase();
        const tProp = tenant.propertyName.trim().toLowerCase();
        if (pName === tProp || pName.includes(tProp) || tProp.includes(pName)) return true;
      }
      if ((tenant as any).propertyId === propertyId || (tenant as any).property_id === propertyId) return true;
      return false;
    });
    return matched;
  }, [eligibleTenants, propertyUnits, propertyId, properties, units]);
  const visibleAgents = useMemo(() => {
    const property = properties.find((item) => item.id === propertyId);
    const condo = units.find((item) => item.id === propertyId);
    const targetAgentId = property?.agentId || (condo as any)?.agentId || (condo as any)?.agent_id;
    if (!targetAgentId) return agents;
    const matched = agents.filter((agent) => agent.id === targetAgentId);
    return matched.length > 0 ? matched : agents;
  }, [agents, properties, units, propertyId]);
  const filteredContracts = useMemo(() => contracts.filter((contract) => {
    const tenant = tenants.find((item) => item.id === contract.tenantId);
    const unit = units.find((item) => item.id === tenant?.unitId);
    const search = `${contract.id} ${contract.title} ${contract.propertyName} ${contract.tenantName || ""} ${contract.fileName || ""} ${contract.message || ""} ${contract.status} ${unit?.unitNumber || ""}`
      .toLowerCase().includes(contractSearch.trim().toLowerCase());
    return search &&
      (contractStatus === "all" || contract.status === contractStatus) &&
      (contractProperty === "all" || contract.propertyId === contractProperty) &&
      (contractUnit === "all" || tenant?.unitId === contractUnit);
  }), [contracts, tenants, units, contractSearch, contractStatus, contractProperty, contractUnit]);
  const visibleContracts = filteredContracts.slice((contractPage - 1) * CONTRACT_PAGE_SIZE, contractPage * CONTRACT_PAGE_SIZE);

  const load = async () => {
    setLoading(true);
    try {
      const [contractResponse, nextProperties, nextUnits, nextTenants, nextAgents] = await Promise.all([
        fetch("/api/data/contracts", { credentials: "include", headers: getPortalAuthHeaders(mode), cache: "no-store" }),
        getProperties(user), getUnits(user), getTenants(user), mode === "owner" ? getAgents() : Promise.resolve([]),
      ]);
      const contractData = await safeParseJson(contractResponse);
      if (contractResponse.ok && contractData.success) {
        setContracts(contractData.contracts || []);
      } else if (contractResponse.status !== 401 && contractResponse.status !== 403) {
        throw new Error(contractData.error || "Could not load contracts");
      }
      setProperties(nextProperties);
      setUnits(nextUnits);
      setTenants(nextTenants);
      setAgents(nextAgents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load contracts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.id, mode]);
  useEffect(() => {
    const handleSync = () => {
      void load();
    };
    window.addEventListener("renttrack-tenants-updated", handleSync);
    window.addEventListener("renttrack-units-updated", handleSync);
    return () => {
      window.removeEventListener("renttrack-tenants-updated", handleSync);
      window.removeEventListener("renttrack-units-updated", handleSync);
    };
  }, []);
  useEffect(() => {
    const applyGlobalSearch = (event: Event) => {
      const query = (event as CustomEvent<{ query: string }>).detail?.query || "";
      setContractSearch(query);
      setContractStatus("all");
      setContractProperty("all");
      setContractUnit("all");
      setContractPage(1);
      window.sessionStorage.removeItem("agent-global-search");
    };
    const storedQuery = window.sessionStorage.getItem("agent-global-search");
    if (storedQuery) {
      setContractSearch(storedQuery);
      window.sessionStorage.removeItem("agent-global-search");
    }
    window.addEventListener("agent-global-search", applyGlobalSearch);
    window.addEventListener("agent-contract-search", applyGlobalSearch);
    return () => {
      window.removeEventListener("agent-global-search", applyGlobalSearch);
      window.removeEventListener("agent-contract-search", applyGlobalSearch);
    };
  }, []);
  useEffect(() => { setContractPage(1); }, [contractSearch, contractStatus, contractProperty, contractUnit]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      toast.error("Contract file exceeds maximum size of 15 MB");
      event.target.value = "";
      return;
    }
    setPreparingFile(true);
    try {
      await Promise.all([
        selected.slice(0, 64 * 1024).arrayBuffer(),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
      setFile(selected);
    } catch {
      toast.error("Could not read the selected file");
      setFile(null);
    } finally {
      setPreparingFile(false);
    }
  };

  const submitOwnerContract = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!propertyId || !file || (recipientType === "agent" && !agentId) || (recipientType === "tenant" && !tenantId)) {
      toast.error(recipientType === "tenant"
        ? "Choose a property or unit, tenant, and contract file"
        : "Choose a property or unit, agent, and contract file");
      return;
    }
    if (recipientType === "tenant" && (!tenantId || !propertyTenants.some((t) => t.id === tenantId))) {
      toast.error("Please select a valid tenant");
      return;
    }
    const form = new FormData();
    form.set("action", "send");
    form.set("recipientType", recipientType);
    form.set("propertyId", propertyId);
    form.set("agentId", agentId);
    form.set("tenantId", tenantId);
    form.set("title", title.trim() || file.name);
    form.set("file", file);
    const ok = await submitFile(form, recipientType === "tenant" ? "Contract sent to tenant" : "Contract sent to agent", true);
    if (ok) {
      setFile(null);
      setTitle("Rental contract");
      setTenantId("");
      setShowOwnerSendModal(false);
    }
  };

  const openSessionRestore = (form: FormData, successMessage: string, closeOwnerModal?: boolean) => {
    let defaultEmail = user?.role === mode ? (user?.email || "") : "";
    if (!defaultEmail && typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`renttrack_user_${mode}`);
        if (cached) defaultEmail = JSON.parse(cached)?.email || "";
      } catch {}
    }
    if (!defaultEmail && mode === "owner") {
      defaultEmail = "renttrackowner@gmail.com";
    }
    setReauthEmail(defaultEmail);
    setReauthPassword("");
    setPendingUpload({ form, successMessage, closeOwnerModal });
    setReauthOpen(true);
  };

  const submitFile = async (form: FormData, successMessage: string, closeOwnerModal?: boolean, overrideHeaders?: Record<string, string>): Promise<boolean> => {
    setSending(true);
    try {
      const response = await fetch("/api/data/contracts", {
        method: "POST",
        credentials: "include",
        headers: overrideHeaders || getPortalAuthHeaders(mode),
        body: form,
      });
      const result = await safeParseJson(response);
      if (response.status === 401 || response.status === 403) {
        openSessionRestore(form, successMessage, closeOwnerModal);
        return false;
      }
      if (!response.ok || !result.success) throw new Error(result.error || "Could not send contract");
      toast.success(successMessage);
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send contract");
      return false;
    } finally {
      setSending(false);
      setUploadingContractId(null);
    }
  };

  const handleReauthAndSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const effectivePassword = reauthPassword || reauthPasswordRef.current?.value || "";
    if (!reauthEmail.trim() || !effectivePassword) {
      toast.error("Enter your email and password");
      return;
    }
    setReauthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: reauthEmail.trim(), password: effectivePassword }),
      });
      const data = await safeParseJson(res);
      if (!res.ok || !data.success || !data.user) {
        throw new Error(data.error || "Invalid email or password");
      }
      if (data.sessionToken) {
        savePortalAuthToken(data.sessionToken, data.user.role);
      }
      setUser(data.user, data.sessionToken);
      setReauthOpen(false);
      setReauthPassword("");

      if (pendingUpload) {
        const { form, successMessage, closeOwnerModal } = pendingUpload;
        setPendingUpload(null);
        const headers = data.sessionToken ? { Authorization: `Bearer ${data.sessionToken}` } : getPortalAuthHeaders(mode);
        const ok = await submitFile(form, successMessage, closeOwnerModal, headers);
        if (ok && closeOwnerModal) {
          setFile(null);
          setTitle("Rental contract");
          setTenantId("");
          setShowOwnerSendModal(false);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify session");
    } finally {
      setReauthLoading(false);
    }
  };

  const sendRequestedContract = (contract: Contract, selectedFile: File | null) => {
    if (!selectedFile) return;
    setUploadingContractId(contract.id);
    const form = new FormData();
    form.set("action", "send");
    form.set("contractId", contract.id);
    form.set("file", selectedFile);
    void submitFile(form, `Contract sent to ${contract.tenantName || "the agent"}`);
  };

  const requestContract = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!propertyId || !tenantId) {
      toast.error("Choose the property and tenant");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/data/contracts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...getPortalAuthHeaders(mode) },
        body: JSON.stringify({ action: "request", propertyId, tenantId, title: `Contract for ${propertyTenants.find((tenant) => tenant.id === tenantId)?.name || "tenant"}`, message: requestMessage.trim() }),
      });
      const result = await safeParseJson(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Could not request contract");
      toast.success("Contract request sent to the owner");
      setRequestMessage("");
      setShowRequestModal(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request contract");
    } finally {
      setSending(false);
    }
  };

  const rejectRequest = async (contract: Contract) => {
    try {
      const response = await fetch("/api/data/contracts", {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", ...getPortalAuthHeaders(mode) },
        body: JSON.stringify({ id: contract.id, action: "reject" }),
      });
      const result = await safeParseJson(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Could not decline request");
      toast.success("Contract request declined");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not decline request");
    }
  };

  const statusVariant = (status: Contract["status"]) => status === "sent" ? "success" : status === "requested" ? "warning" : "outline";
  const exportContracts = () => {
    const rows: Array<Array<string>> = [
      ["Contract reference", "Title", "Tenant", "Property", "Unit", "Status", "Last updated", "File"],
      ...filteredContracts.map((contract) => {
        const tenant = tenants.find((item) => item.id === contract.tenantId);
        const unit = units.find((item) => item.id === tenant?.unitId);
        return [
          contract.id, contract.title, contract.tenantName || "—", contract.propertyName,
          unit?.unitNumber || "—", contract.status, contract.createdAt, contract.fileName || "—",
        ];
      }),
    ];
    downloadExcelReport(`agent-contracts-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Contracts", rows }]);
  };

  return (
    <div className="flex flex-col gap-4">
      <ManagementBanner
        category={mode === "owner" ? "CONTRACT MANAGEMENT" : "LEGAL & LEASING"}
        title={mode === "owner" ? "Rental Contracts" : "Contract Agreements"}
        description={mode === "owner" ? "Review agent requests, issue agreements, and share lease documents with tenants." : "Generate, track, and manage digital lease contracts and tenant signatures."}
        icon={FileText}
      />

      <div className="flex justify-end gap-2">
        {mode === "owner" ? (
          <Button
            type="button"
            onClick={() => {
              setRecipientType("agent");
              setShowOwnerSendModal(true);
            }}
            className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm"
          >
            <UploadCloud className="h-4 w-4" />
            Send a Contract
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRequestModal(true)}
              disabled={!hasSelectableTargets}
              className="h-9 gap-1.5 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 px-4 text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Request a Contract
            </Button>
            <Button
              type="button"
              onClick={() => {
                setRecipientType("tenant");
                setShowOwnerSendModal(true);
              }}
              disabled={!hasSelectableTargets}
              className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />
              Send a Contract
            </Button>
          </>
        )}
      </div>

      <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-semibold text-slate-900">{mode === "owner" ? "Contract activity" : "Contract history"}</CardTitle>
          <CardDescription className="mt-1 text-xs text-slate-500">{mode === "owner" ? "Review requests and files shared with agents or tenants." : "Files stay private to the owner and assigned agent."}</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:p-4">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={contractSearch} onChange={(event) => setContractSearch(event.target.value)} placeholder="Search contracts, tenants, or files…" aria-label="Search contracts" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </label>
          <select value={contractStatus} onChange={(event) => setContractStatus(event.target.value)} aria-label="Filter contracts by status" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
            <option value="all">All Status</option><option value="requested">Requested</option><option value="sent">Sent</option><option value="rejected">Declined</option>
          </select>
          <select value={contractProperty} onChange={(event) => { setContractProperty(event.target.value); setContractUnit("all"); }} aria-label="Filter contracts by property or unit" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
            <option value="all">All properties &amp; units</option>
            {visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            {visibleCondoUnits.map((unit) => <option key={unit.id} value={unit.id}>{formatCondoUnitOption(unit)}</option>)}
          </select>
          <select value={contractUnit} onChange={(event) => setContractUnit(event.target.value)} aria-label="Filter contracts by unit" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
            <option value="all">All units</option>{units.filter((unit) => contractProperty === "all" || unit.propertyId === contractProperty).map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}
          </select>
          <Button type="button" variant="outline" onClick={exportContracts} disabled={!filteredContracts.length} className="h-9 rounded-lg border-slate-200 px-3 text-xs"><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
        </div>
        {loading ? <div className="flex items-center justify-center py-10 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading contracts...</div> : contracts.length === 0 ? (
          <div className="py-10 text-center"><FileText className="mx-auto mb-3 h-9 w-9 text-slate-300" /><p className="font-medium text-slate-600">No contract activity yet</p><p className="mt-1 text-sm text-slate-500">Requests and shared documents will appear here.</p></div>
        ) : filteredContracts.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No contracts match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead className="bg-[#f6f9fd]"><tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-4 py-3">Contract</th><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Property / unit</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleContracts.map((contract) => {
                  const tenant = tenants.find((item) => item.id === contract.tenantId);
                  const unit = units.find((item) => item.id === contract.propertyId || item.id === tenant?.unitId);
                  return <tr key={contract.id} className="align-middle text-xs text-slate-700 transition-colors hover:bg-blue-50/40">
                    <td className="max-w-56 px-4 py-3"><p className="truncate font-semibold text-slate-900">{contract.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{contract.id}</p>{contract.message && <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{contract.message}</p>}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{contract.tenantName || "—"}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{contract.propertyName}</p><p className="mt-0.5 text-[10px] text-slate-500">{unit ? `Unit ${unit.unitNumber}` : "—"}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(contract.createdAt)}</td>
                    <td className="px-4 py-3"><Badge variant={statusVariant(contract.status)} className={cn("text-[10px] capitalize", contract.status === "rejected" && "text-slate-600")}>{contract.status === "rejected" ? "Declined" : contract.status}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-2">
                      {contract.status === "sent" && <a href={`/api/data/contracts/${contract.id}/file`} className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium hover:bg-slate-50"><Download className="mr-1.5 h-3.5 w-3.5" />Download</a>}
                      {contract.status === "requested" && <>
                        <label className={cn("inline-flex h-8 cursor-pointer items-center rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700", sending && "opacity-70 pointer-events-none")}>
                          {uploadingContractId === contract.id ? (
                            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Uploading...</>
                          ) : (
                            <><UploadCloud className="mr-1.5 h-3.5 w-3.5" />Attach</>
                          )}
                          <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" disabled={sending} onChange={(event) => sendRequestedContract(contract, event.target.files?.[0] || null)} />
                        </label>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => void rejectRequest(contract)} disabled={sending}><XCircle className="mr-1 h-3.5 w-3.5" />Decline</Button>
                      </>}
                      {contract.status !== "sent" && contract.status !== "requested" && <span className="text-slate-400">—</span>}
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && contracts.length > 0 && filteredContracts.length > 0 && <ContractsPagination page={contractPage} total={filteredContracts.length} onPageChange={setContractPage} />}
      </Card>
      {mode === "agent" && (
        <>
          {!hasSelectableTargets && <p className="text-right text-sm text-amber-700">No properties or condominium units are available yet.</p>}
          <Modal
            isOpen={showRequestModal}
            onClose={() => setShowRequestModal(false)}
            title="Request a contract"
            description="Select the property or condominium unit and tenant. The owner will be notified and can attach the contract here."
          >
            <form onSubmit={requestContract} className="grid gap-3 w-full min-w-0">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 min-w-0 w-full">
                <span>Property / Condo Unit</span>
                <select required value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setTenantId(""); }} className="h-11 w-full min-w-0 max-w-full rounded-xl border border-border bg-white px-3 text-sm truncate">
                  <option value="">Select property or condo unit</option>
                  {visibleProperties.length > 0 && (
                    <optgroup label="Housing Properties">
                      {visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </optgroup>
                  )}
                  {visibleCondoUnits.length > 0 && (
                    <optgroup label="Condominium Units">
                      {visibleCondoUnits.map((unit) => <option key={unit.id} value={unit.id}>{formatCondoUnitOption(unit)}</option>)}
                    </optgroup>
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 min-w-0 w-full">
                <span>Tenant</span>
                <select
                  required
                  disabled={propertyTenants.length === 0}
                  value={tenantId}
                  onChange={(event) => setTenantId(event.target.value)}
                  className="h-11 w-full min-w-0 max-w-full rounded-xl border border-border bg-white px-3 text-sm truncate disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {propertyTenants.length === 0 ? (
                    <option value="">No tenants available</option>
                  ) : (
                    <>
                      <option value="">Select tenant</option>
                      {propertyTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} · Unit {tenant.unitNumber || "—"}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {propertyTenants.length === 0 && (
                  <span className="text-xs text-amber-600">No tenants available for this property</span>
                )}
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 min-w-0 w-full">
                <span>Note to owner <span className="font-normal text-slate-500">(optional)</span></span>
                <textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Add details for the owner" className="w-full min-w-0 rounded-xl border border-border bg-white px-3 py-2.5 text-sm" />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
                <Button type="submit" disabled={sending}><Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Request from owner"}</Button>
              </div>
            </form>
          </Modal>
        </>
      )}
      <Modal
        isOpen={showOwnerSendModal}
        onClose={() => setShowOwnerSendModal(false)}
        title={mode === "owner" ? "Send a contract" : "Send a contract to tenant"}
        description={mode === "owner" ? "Attach a PDF or Word document and choose who should receive it." : "Attach a PDF or Word document to issue to the tenant."}
        className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-x-hidden"
      >
        <form onSubmit={submitOwnerContract} className="grid gap-3.5 md:grid-cols-2 w-full min-w-0 max-w-full box-border">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 min-w-0 w-full">
            <span>Property / Condo Unit</span>
            <select
              required
              value={propertyId}
              onChange={(event) => { setPropertyId(event.target.value); setAgentId(""); setTenantId(""); }}
              className="h-11 w-full min-w-0 max-w-full box-border rounded-xl border border-border bg-white px-3 pr-8 text-sm truncate"
            >
              <option value="">Select property or condo unit</option>
              {visibleProperties.length > 0 && (
                <optgroup label="Housing Properties">
                  {visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </optgroup>
              )}
              {visibleCondoUnits.length > 0 && (
                <optgroup label="Condominium Units">
                  {visibleCondoUnits.map((unit) => <option key={unit.id} value={unit.id}>{formatCondoUnitOption(unit)}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          {mode === "owner" ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 min-w-0 w-full">
              <span>Recipient</span>
              <select
                required
                value={recipientType}
                onChange={(event) => { setRecipientType(event.target.value as "agent" | "tenant"); setAgentId(""); setTenantId(""); }}
                aria-label="Send contract to"
                className="h-11 w-full min-w-0 max-w-full box-border rounded-xl border border-border bg-white px-3 pr-8 text-sm truncate"
              >
                <option value="agent">Send to agent</option>
                <option value="tenant">Send directly to tenant</option>
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 min-w-0 w-full">
              <span>Recipient</span>
              <div className="flex h-11 w-full min-w-0 max-w-full box-border items-center rounded-xl border border-border bg-slate-50 px-3 text-sm font-semibold text-blue-700">
                Direct to Tenant
              </div>
            </label>
          )}
          {mode === "owner" && recipientType === "agent" ? (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 md:col-span-2 min-w-0 w-full">
                <span>Agent</span>
                <select
                  required
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  className="h-11 w-full min-w-0 max-w-full box-border rounded-xl border border-border bg-white px-3 pr-8 text-sm truncate"
                >
                  <option value="">Select agent</option>
                  {visibleAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 md:col-span-2 min-w-0 w-full">
                <div className="flex items-center justify-between gap-2">
                  <span>Tenant</span>
                  <span className="text-xs font-normal text-slate-500">(Optional for property-wide contracts)</span>
                </div>
                <select
                  disabled={propertyTenants.length === 0}
                  value={tenantId}
                  onChange={(event) => setTenantId(event.target.value)}
                  className="h-11 w-full min-w-0 max-w-full box-border rounded-xl border border-border bg-white px-3 pr-8 text-sm truncate disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {propertyTenants.length === 0 ? (
                    <option value="">No tenants available</option>
                  ) : (
                    <>
                      <option value="">General property contract (Property-wide)</option>
                      {propertyTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} · Unit {tenant.unitNumber || "—"}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {propertyTenants.length === 0 ? (
                  <span className="text-xs text-slate-500">No active tenants for this property. Contract will apply property-wide.</span>
                ) : (
                  <span className="text-xs text-slate-500">Leave unselected to apply this contract property-wide.</span>
                )}
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 md:col-span-2 min-w-0 w-full">
              <span>Tenant</span>
              <select
                required
                disabled={propertyTenants.length === 0}
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                className="h-11 w-full min-w-0 max-w-full box-border rounded-xl border border-border bg-white px-3 pr-8 text-sm truncate disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {propertyTenants.length === 0 ? (
                  <option value="">No tenants available</option>
                ) : (
                  <>
                    <option value="">Select tenant</option>
                    {propertyTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} · Unit {tenant.unitNumber || "—"}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {propertyTenants.length === 0 && (
                <span className="text-xs text-amber-600">No tenants available for this property</span>
              )}
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 md:col-span-2 min-w-0 w-full">
            <span>Contract title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              aria-label="Contract title"
              placeholder="Contract title"
              className="h-11 w-full min-w-0 max-w-full rounded-xl border border-border bg-white px-3 text-sm"
            />
          </label>
          <label
            className={cn(
              "flex min-h-12 w-full min-w-0 max-w-full cursor-pointer flex-col justify-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-sm transition-colors md:col-span-2",
              preparingFile || sending
                ? "border-blue-300 bg-blue-50/70 text-blue-800 pointer-events-none"
                : file
                  ? "border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50"
                  : "border-border text-text-secondary hover:border-blue-300 hover:bg-slate-50"
            )}
          >
            {preparingFile ? (
              <div className="flex items-center gap-2.5">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                <span className="min-w-0 flex-1 truncate font-medium">Loading selected contract file...</span>
              </div>
            ) : sending ? (
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-blue-800">
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                    <span className="truncate">Uploading {file?.name || "contract"}...</span>
                  </span>
                  <span className="shrink-0">Please wait</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
                </div>
              </div>
            ) : file ? (
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {file.name} <span className="text-xs font-normal opacity-80">({(file.size / (1024 * 1024)).toFixed(2)} MB · Click to change)</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <UploadCloud className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Choose PDF or Word contract (max 15 MB)</span>
              </div>
            )}
            <input
              type="file"
              disabled={preparingFile || sending}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          <div className="flex justify-end gap-2 pt-1 md:col-span-2">
            <Button type="button" variant="outline" disabled={sending} onClick={() => setShowOwnerSendModal(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={
                preparingFile ||
                sending ||
                !file ||
                !hasSelectableTargets ||
                (recipientType === "agent" && !visibleAgents.length) ||
                (recipientType === "tenant" && (!tenantId || propertyTenants.length === 0))
              }
            >
              {sending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading contract...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />{recipientType === "tenant" ? "Send to tenant" : "Send to agent"}</>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={reauthOpen}
        onClose={() => { if (!reauthLoading) setReauthOpen(false); }}
        title={`Confirm ${mode === "owner" ? "Owner" : "Agent"} Session`}
        description="Another tab signed in as a different role earlier. Confirm your password once to lock in multi-tab access and send this contract immediately."
        className="max-w-md"
      >
        <form onSubmit={handleReauthAndSend} className="space-y-3.5">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>{mode === "owner" ? "Owner" : "Agent"} Email</span>
            <input
              type="email"
              required
              value={reauthEmail}
              onChange={(e) => setReauthEmail(e.target.value)}
              style={{ color: "#0f172a", colorScheme: "light" }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              placeholder={mode === "owner" ? "renttrackowner@gmail.com" : "agent@email.com"}
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <label htmlFor="reauth-password-input">Password</label>
            <div className="relative">
              <input
                ref={reauthPasswordRef}
                id="reauth-password-input"
                type={showReauthPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                autoFocus
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                onInput={(e) => setReauthPassword((e.target as HTMLInputElement).value)}
                style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a", colorScheme: "light" }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-3 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (reauthPasswordRef.current?.value && !reauthPassword) {
                    setReauthPassword(reauthPasswordRef.current.value);
                  }
                  setShowReauthPassword((prev) => !prev);
                }}
                aria-label={showReauthPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                {showReauthPassword ? <Eye className="h-4 w-4 text-blue-600" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={reauthLoading} onClick={() => setReauthOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={reauthLoading}>
              {reauthLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying &amp; sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Verify &amp; Send Contract</>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
