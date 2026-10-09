"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FileCheck2, FileText, LoaderCircle, Upload } from "lucide-react";
import { safeParseJson } from "@/lib/data";

type Certificate = {
  id: string;
  title: string;
  issuer?: string | null;
  issuedOn?: string | null;
  fileName: string;
  mimeType: string;
  createdAt: string;
  url: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const allowedExtensions = /\.(pdf|jpe?g|png)$/i;

function formatDate(value?: string | null) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(date)
    : "Date not provided";
}

export default function AgentCertificateManager({ agentId }: { agentId: string }) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/certificates`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await safeParseJson(response);
      if (!response.ok || !data.success || !Array.isArray(data.certificates)) {
        throw new Error(data.error || "Your certificates could not be loaded.");
      }
      setCertificates(data.certificates);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Your certificates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadCertificates();
  }, [loadCertificates]);

  const onFileChange = (selected: File | null) => {
    setFeedback(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!allowedExtensions.test(selected.name) || (selected.type && !allowedMimeTypes.has(selected.type))) {
      setFile(null);
      setFeedback({ message: "Choose a PDF, JPG, or PNG file.", error: true });
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setFeedback({ message: "The selected file exceeds the 10 MB limit.", error: true });
      return;
    }
    setFile(selected);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setFeedback({ message: "Select a certificate file to upload.", error: true });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = new FormData();
      body.set("title", title.trim());
      body.set("issuer", issuer.trim());
      body.set("issuedOn", issuedOn);
      body.set("file", file);
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/certificates`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await safeParseJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || "The certificate could not be uploaded.");
      setTitle("");
      setIssuer("");
      setIssuedOn("");
      setFile(null);
      const fileInput = document.getElementById("agent-certificate-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setFeedback({ message: "Certificate uploaded successfully.", error: false });
      await loadCertificates();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "The certificate could not be uploaded.", error: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full space-y-6" aria-labelledby="saved-certificates-title">

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-semibold text-slate-900">Add a certificate</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-800 sm:col-span-2">
            Certificate title <span className="text-red-700" aria-hidden="true">*</span>
            <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200" />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Issuer <span className="font-normal text-slate-500">Optional</span>
            <input maxLength={120} value={issuer} onChange={(event) => setIssuer(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200" />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Issue date <span className="font-normal text-slate-500">Optional</span>
            <input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200" />
          </label>
          <label htmlFor="agent-certificate-file" className="text-sm font-medium text-slate-800 sm:col-span-2">
            Certificate document <span className="text-red-700" aria-hidden="true">*</span>
            <span className="mt-1.5 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 transition hover:border-orange-500 hover:bg-orange-50/50 focus-within:border-orange-600 focus-within:ring-2 focus-within:ring-orange-200">
              <Upload size={18} className="shrink-0 text-orange-800" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{file?.name || "Choose a PDF, JPG, or PNG (up to 10 MB)"}</span>
              <input id="agent-certificate-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onFileChange(event.target.files?.[0] || null)} required aria-required="true" />
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <button type="submit" disabled={submitting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            {submitting ? "Uploading…" : "Upload certificate"}
          </button>
          {feedback && <p className={`text-sm ${feedback.error ? "text-red-700" : "text-emerald-800"}`} role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="saved-certificates-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="saved-certificates-title" className="text-lg font-semibold text-slate-900">Your certificates</h2>
            <p className="mt-1 text-sm text-slate-600">Uploaded files are available from your public profile link.</p>
          </div>
          <FileCheck2 size={20} className="shrink-0 text-orange-700" aria-hidden="true" />
        </div>
        {loading ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-slate-600" role="status"><LoaderCircle size={16} className="animate-spin" /> Loading certificates…</p>
        ) : loadError ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadCertificates()} className="mt-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600">Try again</button>
          </div>
        ) : certificates.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">You haven’t added any certificates yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {certificates.map((certificate) => (
              <li key={certificate.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText size={18} className="mt-0.5 shrink-0 text-orange-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{certificate.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {[certificate.issuer, certificate.issuedOn ? `Issued ${formatDate(certificate.issuedOn)}` : null, certificate.fileName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                {certificate.url ? (
                  <a href={certificate.url} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-orange-800 underline decoration-orange-300 underline-offset-4 hover:text-orange-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2">Open file</a>
                ) : <span className="text-sm text-slate-500">File link unavailable</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
