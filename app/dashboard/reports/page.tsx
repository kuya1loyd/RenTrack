"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Download, TrendingUp, DollarSign, Users, Home, Building2, FileText
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getProperties, getUnits, getTenants, getPayments, getPaymentTrends, Property, Unit, TenantRecord, Payment, MonthlyTrend } from "@/lib/data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#0f172a"];

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("collections");
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyTrend[]>([]);

  useEffect(() => {
    (async () => {
      const [props, units_, tenants_, pays, trends] = await Promise.all([
        getProperties(user), getUnits(user), getTenants(), getPayments(user), getPaymentTrends(user),
      ]);
      setProperties(props); setUnits(units_); setTenants(tenants_); setPayments(pays); setMonthlyData(trends);
    })();
  }, [user]);

  const totalCollected = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amountPaid, 0);
  const totalReceivables = payments.filter(p => p.status !== "paid").reduce((s, p) => s + p.balance, 0);

  const propData = properties.map((p) => ({
    name: p.name.split(" ")[0],
    revenue: p.monthlyRevenue,
    units: p.units,
    occupied: p.occupiedUnits,
  }));

  const exportReport = () => {
    if (activeTab === "collections") {
      downloadCSV("collection-trends.csv", monthlyData as unknown as Record<string, unknown>[]);
    } else if (activeTab === "properties") {
      downloadCSV("properties.csv", properties.map((p) => ({
        name: p.name,
        location: p.location,
        type: p.type,
        units: p.units,
        occupied: p.occupiedUnits,
        monthlyRevenue: p.monthlyRevenue,
        status: p.status,
      })) as unknown as Record<string, unknown>[]);
    } else {
      downloadCSV("tenants.csv", tenants.map((t) => ({
        name: t.name,
        email: t.email,
        phone: t.phone,
        propertyName: t.propertyName,
        unitNumber: t.unitNumber,
        rentAmount: t.rentAmount,
        status: t.status,
      })) as unknown as Record<string, unknown>[]);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-[#eaf3ff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Owner finance</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Financial Reports</h2>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">Collections, property performance, and tenant portfolio insights.</p>
          </div>
          <Button className="h-9 border border-blue-700 bg-blue-700 text-white hover:bg-blue-800" onClick={exportReport}><Download className="h-4 w-4 mr-1.5" />Download Report</Button>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: "Total collected", value: formatCurrency(totalCollected), icon: DollarSign, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Receivables", value: formatCurrency(totalReceivables), icon: TrendingUp, tone: "text-amber-700 bg-amber-50" },
          { label: "Active tenants", value: tenants.filter(t => t.status === "active").length, icon: Users, tone: "text-blue-700 bg-blue-50" },
          { label: "Occupied units", value: units.filter(u => u.status === "occupied").length, icon: Home, tone: "text-slate-700 bg-slate-100" },
        ].map((stat, i) => (
          <Card key={i} className="border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                <p className="mt-1 truncate text-base font-bold tabular-nums text-slate-900 sm:text-lg">{stat.value}</p>
              </div>
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", stat.tone)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border border-[#dce8f5] bg-white">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
        </TabsList>

        <TabsContent value="collections">
          <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
              <CardTitle>Collection Trends</CardTitle>
              <CardDescription>Monthly payment collection performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {monthlyData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-secondary text-sm">No payment data available yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs text-text-tertiary" />
                      <YAxis className="text-xs text-text-tertiary" />
                      <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px" }} />
                      <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties">
          <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
              <CardTitle>Property Performance</CardTitle>
              <CardDescription>Revenue and occupancy by property</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {propData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-text-secondary">No property performance data available yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={propData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs text-text-tertiary" />
                      <YAxis className="text-xs text-text-tertiary" />
                      <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px" }} />
                      <Bar dataKey="revenue" name="Monthly Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
                <CardTitle>Tenant Overview</CardTitle>
                <CardDescription>Current tenant status distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: "Active", value: tenants.filter(t => t.status === "active").length },
                        { name: "Inactive", value: tenants.filter(t => t.status === "inactive").length },
                      ]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        <Cell fill={COLORS[0]} />
                        <Cell fill={COLORS[3]} />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  {["Active", "Inactive"].map((item, i) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Key metrics at a glance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Total Properties", value: properties.length },
                    { label: "Total Units", value: units.length },
                    { label: "Total Tenants", value: tenants.length },
                    { label: "Occupancy Rate", value: `${Math.round((units.filter((u) => u.status === "occupied").length / (units.length || 1)) * 100)}%` },
                    { label: "Monthly Revenue", value: formatCurrency(units.filter(u => u.status === "occupied").reduce((s, u) => s + u.rentAmount, 0)) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{item.label}</span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
