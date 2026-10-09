"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Search, Send, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
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
  const { user } = useAuth();
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

  const visibleProperties = useMemo(() => mode === "agent"
    ? properties.filter((property) => property.agentId === user?.id)
    : properties,
    [mode, properties, user?.id]);
  const propertyUnits = useMemo(() => units.filter((unit) => unit.propertyId === propertyId), [units, propertyId]);
  const propertyTenants = useMemo(() => tenants.filter((tenant) => propertyUnits.some((unit) => unit.id === tenant.unitId)), [tenants, propertyUnits]);
  const visibleAgents = useMemo(() => {
    const property = properties.find((item) => item.id === propertyId);
    return property?.agentId ? agents.filter((agent) => agent.id === property.agentId) : agents;
  }, [agents, properties, propertyId]);
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
        fetch("/api/data/contracts", { credentials: "include", cache: "no-store" }),
        getProperties(user), getUnits(user), getTenants(user), mode === "owner" ? getAgents() : Promise.resolve([]),
      ]);
      const contractData = await safeParseJson(contractResponse);
      if (!contractResponse.ok || !contractData.success) throw new Error(contractData.error || "Could not load contracts");
      setContracts(contractData.contracts || []);
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

  const submitOwnerContract = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!propertyId || !file || (recipientType === "agent" && !agentId) || (recipientType === "tenant" && !tenantId)) {
      toast.error(recipientType === "tenant"
        ? "Choose a property, tenant, and contract file"
        : "Choose a property, agent, and contract file");
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
    await submitFile(form, recipientType === "tenant" ? "Contract sent to tenant" : "Contract sent to agent");
    setFile(null);
    setTitle("Rental contract");
    setTenantId("");
    setShowOwnerSendModal(false);
  };

  const submitFile = async (form: FormData, successMessage: string) => {
    setSending(true);
    try {
      const response = await fetch("/api/data/contracts", { method: "POST", credentials: "include", body: form });
      const result = await safeParseJson(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Could not send contract");
      toast.success(successMessage);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send contract");
    } finally {
      setSending(false);
    }
  };

  const sendRequestedContract = (contract: Contract, selectedFile: File | null) => {
    if (!selectedFile) return;
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
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
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
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
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

      <div className="flex justify-end">
        {mode === "owner" ? (
          <Button
            type="button"
            onClick={() => setShowOwnerSendModal(true)}
            className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm"
          >
            <UploadCloud className="h-4 w-4" />
            Send a Contract
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => setShowRequestModal(true)}
            disabled={visibleProperties.length === 0}
            className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Request a Contract
          </Button>
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
            <option value="all">All statuses</option><option value="requested">Requested</option><option value="sent">Sent</option><option value="rejected">Declined</option>
          </select>
          <select value={contractProperty} onChange={(event) => { setContractProperty(event.target.value); setContractUnit("all"); }} aria-label="Filter contracts by property" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
            <option value="all">All properties</option>{visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
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
                  const unit = units.find((item) => item.id === tenant?.unitId);
                  return <tr key={contract.id} className="align-middle text-xs text-slate-700 transition-colors hover:bg-blue-50/40">
                    <td className="max-w-56 px-4 py-3"><p className="truncate font-semibold text-slate-900">{contract.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{contract.id}</p>{contract.message && <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{contract.message}</p>}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{contract.tenantName || "—"}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{contract.propertyName}</p><p className="mt-0.5 text-[10px] text-slate-500">{unit ? `Unit ${unit.unitNumber}` : "—"}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(contract.createdAt)}</td>
                    <td className="px-4 py-3"><Badge variant={statusVariant(contract.status)} className={cn("text-[10px] capitalize", contract.status === "rejected" && "text-slate-600")}>{contract.status === "rejected" ? "Declined" : contract.status}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-2">
                      {contract.status === "sent" && <a href={`/api/data/contracts/${contract.id}/file`} className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium hover:bg-slate-50"><Download className="mr-1.5 h-3.5 w-3.5" />Download</a>}
                      {mode === "owner" && contract.status === "requested" && <>
                        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"><UploadCloud className="mr-1.5 h-3.5 w-3.5" />Attach<input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" disabled={sending} onChange={(event) => sendRequestedContract(contract, event.target.files?.[0] || null)} /></label>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => void rejectRequest(contract)} disabled={sending}><XCircle className="mr-1 h-3.5 w-3.5" />Decline</Button>
                      </>}
                      {contract.status !== "sent" && !(mode === "owner" && contract.status === "requested") && <span className="text-slate-400">—</span>}
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
          {visibleProperties.length === 0 && <p className="text-right text-sm text-amber-700">No properties are assigned to your account yet.</p>}
          <Modal
            isOpen={showRequestModal}
            onClose={() => setShowRequestModal(false)}
            title="Request a contract"
            description="Select the property and tenant. The owner will be notified and can attach the contract here."
          >
            <form onSubmit={requestContract} className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Assigned property
                <select required value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setTenantId(""); }} className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
                  <option value="">Select assigned property</option>{visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Tenant
                <select required value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
                  <option value="">Select tenant</option>{propertyTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · Unit {tenant.unitNumber || "—"}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Note to owner <span className="font-normal text-slate-500">(optional)</span>
                <textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Add details for the owner" className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm" />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
                <Button type="submit" disabled={sending}><Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Request from owner"}</Button>
              </div>
            </form>
          </Modal>
        </>
      )}
      {mode === "owner" && (
        <Modal
          isOpen={showOwnerSendModal}
          onClose={() => setShowOwnerSendModal(false)}
          title="Send a contract"
          description="Attach a PDF or Word document and choose who should receive it."
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
        >
          <form onSubmit={submitOwnerContract} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">Property
              <select required value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setAgentId(""); setTenantId(""); }} className="h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">Recipient
              <select required value={recipientType} onChange={(event) => { setRecipientType(event.target.value as "agent" | "tenant"); setAgentId(""); setTenantId(""); }} aria-label="Send contract to" className="h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="agent">Send to agent</option><option value="tenant">Send directly to tenant</option></select>
            </label>
            {recipientType === "agent" ? (
              <>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">Agent
                  <select required value={agentId} onChange={(event) => setAgentId(event.target.value)} className="h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="">Select agent</option>{visibleAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">Tenant <span className="font-normal text-slate-500">Optional for property-wide contracts</span>
                  <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="">General property contract</option>{propertyTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · Unit {tenant.unitNumber || "—"}</option>)}</select>
                </label>
              </>
            ) : (
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">Tenant
                <select required value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="">Select tenant</option>{propertyTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · Unit {tenant.unitNumber || "—"}</option>)}</select>
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">Contract title
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} aria-label="Contract title" placeholder="Contract title" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
            </label>
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-text-secondary md:col-span-2">
              <UploadCloud className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{file?.name || "Choose PDF or Word contract (max 15 MB)"}</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <div className="flex justify-end gap-2 pt-1 md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setShowOwnerSendModal(false)}>Cancel</Button>
              <Button type="submit" disabled={sending || !properties.length || (recipientType === "agent" && !agents.length)}><Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : recipientType === "tenant" ? "Send to tenant" : "Send to agent"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
