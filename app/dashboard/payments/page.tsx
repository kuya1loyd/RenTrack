"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, Search, CheckCircle2, XCircle, Download, DollarSign, TrendingUp, AlertCircle, Wallet
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { getPayments, getTenants, getUnits, verifyPayment, addNotification, notifyAdmins, Payment, TenantRecord, Unit } from "@/lib/data";
import { toast } from "sonner";
import ReceiptModal from "@/components/receipt-modal";

const fadeInUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const statusStyles: Record<string, string> = {
  paid: "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400",
  pending: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  overdue: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  partial: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400",
};

export default function PaymentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [paymentType, setPaymentType] = useState<"all" | "regular" | "advance">("all");
  const [referenceDate, setReferenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [units, setUnits] = useState<Unit[]>([]);
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      router.replace("/dashboard/admin");
      return;
    }
    Promise.all([
      getPayments(user),
      getTenants(user), getUnits(user),
    ]).then(([pays, tens, unitRows]) => {
      setPayments(pays);
      setTenants(tens);
      setUnits(unitRows);
    });
  }, [user, router]);

  if (user?.role === "admin") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Payment operations are not part of the Administrator role.</h2>
        <p className="mt-2 text-sm text-text-secondary">Redirecting to the system console…</p>
      </div>
    );
  }

  const isAdvance = (p: Payment) => /advance/i.test(p.notes || "") || p.amountPaid > p.amountDue;
  const isInPeriod = (p: Payment) => {
    const paymentDate = new Date(p.paymentDate || "");
    const selected = new Date(`${referenceDate}T00:00:00`);
    if (Number.isNaN(paymentDate.getTime())) return false;
    if (period === "yearly") return paymentDate.getFullYear() === selected.getFullYear();
    if (period === "quarterly") return paymentDate.getFullYear() === selected.getFullYear() && Math.floor(paymentDate.getMonth() / 3) === Math.floor(selected.getMonth() / 3);
    return paymentDate.getFullYear() === selected.getFullYear() && paymentDate.getMonth() === selected.getMonth();
  };
  const filteredPayments = payments.filter((p) => {
    const matchesSearch = p.tenantName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesType = paymentType === "all" || (paymentType === "advance" ? isAdvance(p) : !isAdvance(p));
    return matchesSearch && matchesStatus && matchesType && isInPeriod(p);
  });

  const totalCollected = filteredPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amountPaid || 0), 0);
  const totalPending = filteredPayments.filter((p) => p.status === "pending" || p.status === "partial").reduce((s, p) => s + Number(p.balance || 0), 0);
  const totalOverdue = filteredPayments.filter((p) => p.status === "overdue").reduce((s, p) => s + Number(p.balance || 0), 0);
  const totalAdvance = filteredPayments.filter(isAdvance).reduce((s, p) => s + Math.max(0, Number(p.amountPaid) - Number(p.amountDue)), 0);
  const totalReceivable = units.filter((unit) => unit.status === "occupied").reduce((sum, unit) => sum + Number(unit.rentAmount || 0), 0);

  const handleVerify = async (payment: Payment, status: "paid" | "rejected") => {
    const result = await verifyPayment(payment, user?.id || "", status);
    if (result) {
      const payments = await getPayments(user);
      setPayments(payments);
      await addNotification({
        userId: result.tenantId,
        title: status === "paid" ? "Payment Verified" : "Payment Rejected",
        message: status === "paid"
          ? `Your payment of ${formatCurrency(result.amountPaid)} was approved. Remaining balance: ${formatCurrency(result.balance)}`
          : `Your payment of ${formatCurrency(result.amountPaid)} was rejected. No amount was deducted.`,
        type: "payment",
        read: false,
      });
      await notifyAdmins({
        title: status === "paid" ? "Payment Verified" : "Payment Rejected",
        message: `Payment of ${formatCurrency(result.amountPaid)} for tenant ${result.tenantId} was ${status === "paid" ? "approved" : "rejected"}`,
        type: "payment",
        read: false,
      });
      toast.success(status === "paid"
        ? `Payment approved — remaining balance ${formatCurrency(result.balance)}`
        : "Payment rejected");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      {/* 💳 Payments Hero — Professional Finance */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-8 sm:p-10">
        <div className="absolute -bottom-8 -right-8 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium mb-3">
              <CreditCard className="h-3 w-3" />
              Payment Ledger
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Payments</h2>
            <p className="text-white/70 text-sm mt-1.5">Track and manage all rental payment transactions</p>
          </div>
          <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"><Download className="h-4 w-4 mr-1.5" />Export Report</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Collected", value: formatCurrency(totalCollected), icon: DollarSign, color: "from-green-500 to-green-600", change: "All time" },
          { label: "Pending", value: formatCurrency(totalPending), icon: Wallet, color: "from-amber-500 to-amber-600", change: "Awaiting approval" },
          { label: "Overdue", value: formatCurrency(totalOverdue), icon: AlertCircle, color: "from-red-500 to-red-600", change: `${payments.filter(p => p.status === "overdue").length} accounts` },
          { label: "Advance", value: formatCurrency(totalAdvance), icon: TrendingUp, color: "from-primary-500 to-primary-600", change: "Overpayments" },
          { label: "Total Receivable", value: formatCurrency(totalReceivable), icon: Wallet, color: "from-sky-500 to-sky-600", change: "Occupied units / month" },
        ].map((stat, i) => (
          <motion.div key={i} variants={fadeInUp} whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.2 }}>
            <Card className="hover:shadow-lg transition-all duration-300"><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-secondary">{stat.label}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{stat.value}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{stat.change}</p>
                </div>
                <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", stat.color)}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent></Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Payment Ledger</CardTitle>
              <CardDescription>Complete record of all payment transactions</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <Input placeholder="Search by tenant..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-border bg-surface text-sm text-foreground px-3">
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 items-center">
            <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="h-9 rounded-lg border border-border bg-surface text-sm text-foreground px-3"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>
            <Input aria-label="Selected period" type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} className="h-9 w-40" />
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as typeof paymentType)} className="h-9 rounded-lg border border-border bg-surface text-sm text-foreground px-3"><option value="all">All payment types</option><option value="regular">Regular payment</option><option value="advance">Advance payment</option></select>
          </div>
        </CardHeader>
<CardContent className="overflow-x-auto">
          <div className="min-w-[1050px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Base Rent</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Status</TableHead>
                {(user?.role === "owner" || user?.role === "agent") && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-text-secondary text-sm">
                    No payment records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment, i) => (
                  <motion.tr key={payment.id} variants={fadeInUp} custom={i}
                    className="border-b border-border transition-all duration-200 hover:bg-surface-secondary/70">
                    <TableCell>
                      <div className="flex items-center gap-3">
                          <Avatar src={tenants.find(t => t.id === payment.tenantId)?.avatarUrl || ""} fallback={payment.tenantName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)} size="sm" />
                        <span className="text-sm font-medium text-foreground">{payment.tenantName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">{payment.propertyName || "—"}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(payment.amountDue)}</TableCell>
                    <TableCell className="text-right text-sm text-text-secondary">{formatCurrency(0)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-foreground">{formatCurrency(payment.amountPaid)}</TableCell>
                    <TableCell className="text-sm text-text-secondary whitespace-nowrap">{formatDate(payment.dueDate)}</TableCell>
                    <TableCell><Badge variant="outline" className="whitespace-nowrap">{isAdvance(payment) ? "Advance Payment" : "Regular Payment"}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0.5 capitalize", statusStyles[payment.status])}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    {(user?.role === "owner" || user?.role === "agent") && (
                      <TableCell>
                         <div className="flex gap-1">
                           {payment.receiptUrl && (
                             <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] hover:bg-blue-50 hover:text-blue-600 transition-all"
                               onClick={() => setViewingReceipt(payment)}>
                               Receipt
                             </Button>
                           )}
                           {payment.status === "pending" && (
                             <>
                               <Button size="sm" className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600 transition-all"
                                 onClick={() => handleVerify(payment, "paid")}>
                                 <CheckCircle2 className="h-3.5 w-3.5" />
                               </Button>
                               <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 transition-all"
                                 onClick={() => handleVerify(payment, "rejected")}>
                                 <XCircle className="h-3.5 w-3.5" />
                               </Button>
                             </>
                           )}
                           {payment.status === "paid" && (
                             <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px]">Verified</Badge>
                           )}
                         </div>
                      </TableCell>
                    )}
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Receipt Viewer Modal ─── */}
      <ReceiptModal
        isOpen={!!viewingReceipt}
        onClose={() => setViewingReceipt(null)}
        receiptUrl={viewingReceipt?.receiptUrl || null}
        payment={viewingReceipt || undefined}
      />
    </motion.div>
  );
}
