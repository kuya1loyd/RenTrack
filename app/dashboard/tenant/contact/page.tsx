"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Send, Building2, Users, ArrowRight, HelpCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createComplaint, getComplaints, replyToComplaint, Complaint } from "@/lib/data";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ManagementBanner } from "@/components/management-panel";

export default function TenantContactPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("target") === "manager" || searchParams.get("tab") === "manager" ? "manager" : "manager";
  const [activeTab, setActiveTab] = useState<"manager" | "support">(initialTab);
  const [requests, setRequests] = useState<Complaint[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const loadRequests = () => { if (user) getComplaints(user.id).then(setRequests).catch(() => setRequests([])); };
  useEffect(loadRequests, [user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) { toast.error("Subject and message are required"); return; }
    setSubmitting(true);
    try {
      const targetType = activeTab === "manager" ? "property" : "support";
      const request = await createComplaint({
        tenantId: user?.id || "",
        targetType,
        targetId: activeTab === "manager" ? "manager" : "support",
        subject,
        message,
        priority: "medium",
      });
      setRequests((current) => [request, ...current]);
      setSubject("");
      setMessage("");
      toast.success(activeTab === "manager" ? "Message sent to property manager" : "Support request submitted");
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async (complaintId: string) => {
    if (!replyText.trim()) { toast.error("Reply cannot be empty"); return; }
    setReplying(true);
    try {
      const updated = await replyToComplaint(complaintId, replyText);
      if (updated) {
        setRequests((current) => current.map((item) => item.id === complaintId ? updated : item));
        setReplyText("");
        setReplyingId(null);
        toast.success("Reply sent");
      }
    } catch { toast.error("Failed to send reply"); }
    finally { setReplying(false); }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-6 sm:py-10">
      <ManagementBanner
        category="COMMUNICATIONS"
        title="Contact & Support"
        description="Connect directly with your property manager, assigned agent, or RentTrack support."
        icon={MessageSquare}
      />

      {/* Recipient Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("manager")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "manager"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Contact Property Manager & Agent</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("support")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "support"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>RentTrack Platform Support</span>
        </button>
      </div>

      {/* Quick Action Cards for Property Manager */}
      {activeTab === "manager" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Direct Chat</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">Message Property Team</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Open real-time messaging with your property manager and landlord.
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/dashboard/tenant/messages"
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Open Direct Messages</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Rent Managers</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">Find A Rent Manager</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Browse verified local rent managers and property agents.
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/dashboard/tenant/rent-manager"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Browse Rent Managers</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              {activeTab === "manager" ? "New Message to Manager" : "New Support Request"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Subject / Category</label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={activeTab === "manager" ? "Tenancy confirmation, move-out, lease..." : "Payment, login, account bug..."}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Message</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  placeholder={activeTab === "manager" ? "Describe your question or request for the property manager..." : "Describe what you need help with..."}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                <Send className="mr-2 h-4 w-4" />
                {submitting ? "Sending..." : activeTab === "manager" ? "Send to Property Manager" : "Submit Support Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">
              {activeTab === "manager" ? "Messages & Requests" : "My Support Requests"}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            {requests.length ? (
              <div className="space-y-4 min-w-0">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-gray-200 p-4 min-w-0 overflow-hidden">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="shrink-0">
                        <Avatar src={user?.avatarUrl} fallback={user?.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "T"} size="md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900 break-all">{request.subject}</h3>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 break-all">{request.message}</p>
                          </div>
                          <Badge variant={request.status === "resolved" || request.status === "closed" ? "success" : "warning"} className="capitalize shrink-0">
                            {request.status.replace("_", " ")}
                          </Badge>
                          {(request.status === "resolved" || request.status === "closed") && request.responseBy && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 shrink-0">Resolved by Admin</span>
                          )}
                        </div>
                        {request.responseText && (
                          <div className="mt-3 rounded-lg bg-blue-50 p-3 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-semibold text-blue-700">Support response</p>
                              {request.responseBy && <span className="text-[10px] text-blue-500">from {request.responseBy}</span>}
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-gray-700 break-all">{request.responseText}</p>
                          </div>
                        )}
                        {request.tenantReplyText && (
                          <div className="mt-3 rounded-lg bg-gray-50 p-3 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar src={user?.avatarUrl} fallback={user?.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "T"} size="sm" />
                              <p className="text-xs font-semibold text-gray-700">Your reply</p>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-gray-700 break-all">{request.tenantReplyText}</p>
                          </div>
                        )}
                        <div className="mt-3">
                          {request.responseText && (replyingId === request.id ? (
                            <div className="flex gap-2">
                              <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} placeholder="Write a reply..." className="w-full rounded-lg border border-gray-200 p-3 text-sm" />
                              <div className="flex flex-col gap-2">
                                <Button size="sm" onClick={() => sendReply(request.id)} disabled={!replyText.trim() || replying}>{replying ? "Sending..." : "Send"}</Button>
                                <Button size="sm" variant="outline" onClick={() => { setReplyingId(null); setReplyText(""); }}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setReplyingId(request.id)}>Reply</Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-gray-500">No support requests yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
