"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  Building2, Users, CreditCard, TrendingUp, Home, AlertCircle,
  ArrowUpRight, ArrowDownRight, Calendar, Download, LayoutDashboard,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatCurrency, getTimeAgo } from "@/lib/utils";
import {
  Property, Payment, MonthlyTrend, TenantRecord,
  getDashboardData,
} from "@/lib/data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

  const fadeInUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

export default function DashboardOverview() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receivables, setReceivables] = useState(0);
  const [collected, setCollected] = useState(0);
  const [propsCount, setPropsCount] = useState(0);
  const [unitsCount, setUnitsCount] = useState(0);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [vacantCount, setVacantCount] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyTrend[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantRecord[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace("/");
        return;
      }
      setIsRedirecting(true);
      if (user.role === "tenant") {
        router.replace("/dashboard/tenant");
      } else if (user.role === "admin") {
        router.replace("/dashboard/admin");
      } else if (user.role === "owner") {
        router.replace("/dashboard/owner");
      } else if (user.role === "agent") {
        router.replace("/dashboard/agent");
      } else {
        setIsRedirecting(false);
      }
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDashboardData(user);
        setProperties(data.properties);
        setPayments(data.payments);
        setMonthlyData(data.trends);
        setTenantsList(data.tenants);
        setPropsCount(data.propertiesCount);
        setUnitsCount(data.unitsCount);
        setTenantsCount(data.tenantsCount);
        setOccupiedCount(data.occupiedUnitsCount);
        setVacantCount(data.vacantUnitsCount);
        setReceivables(data.totalReceivables);
        setCollected(data.totalCollected);
      } catch (err) {
        console.error("Dashboard overview load error:", err);
      }
    })();
  }, [user]);

  if (isLoading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-gray-200 border-t-primary-600 animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "owner") {
    return null;
  }

  const overdueCount = payments.filter(p => p.status === "overdue").length;

  const statCards = [
    { label: "Properties", value: propsCount, icon: Building2, change: `${properties.length} registered`, positive: true, gradient: "from-primary-500 to-primary-600" },
    { label: "Total Units", value: unitsCount, icon: Home, change: `${occupiedCount} occupied`, positive: true, gradient: "from-secondary-500 to-secondary-600" },
    { label: "Tenants", value: tenantsCount, icon: Users, change: `${occupiedCount} active`, positive: true, gradient: "from-accent-500 to-accent-600" },
    { label: "Overdue", value: overdueCount, icon: AlertCircle, change: `${formatCurrency(receivables)} outstanding`, positive: false, gradient: "from-red-500 to-red-600" },
  ];

  return (
    <div className="relative min-h-screen bg-white dark:bg-slate-900">
      <motion.div initial="hidden" animate="visible" variants={stagger} transition={{ duration: 0.3 }} className="max-w-7xl mx-auto relative z-10 space-y-3">
      {/* Dashboard Hero Box with Background Image */}
      <motion.div variants={fadeInUp}>
        <div className="relative overflow-hidden rounded-xl p-4 sm:p-6 text-white shadow-xl">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/images/favicon/Agusan del Norte.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-indigo-900/80 dark:from-slate-900/90 dark:to-slate-900/90" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 dark:bg-white/10 text-white text-xs font-medium mb-3 border border-white/20">
                <LayoutDashboard className="h-3 w-3" />
                Dashboard
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Welcome, {user?.name?.split(" ")[0] || "User"} 👋
              </h2>
              <p className="text-white/80 text-sm mt-1">Real-time overview of your rental portfolio performance</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur-sm">
                <Calendar className="h-4 w-4 mr-1.5" />This Month
              </Button>
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg">
                <Download className="h-4 w-4 mr-1.5" />Export
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions Box */}
      <motion.div variants={fadeInUp}>
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl p-3 shadow-lg transition-shadow">
          <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Add Property", icon: Building2, href: "/dashboard/properties", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
              { label: "Register Tenant", icon: UserPlus, href: "/dashboard/tenants", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
              { label: "Record Payment", icon: CreditCard, href: "/dashboard/payments", color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
              { label: "View Reports", icon: TrendingUp, href: "/dashboard/reports", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
            ].map((action, i) => (
              <motion.div key={i}>
                <Link href={action.href} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-all group">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white transition-colors">{action.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {statCards.map((stat, i) => (
          <motion.div key={i} variants={fadeInUp}>
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl p-4 shadow-lg transition-shadow cursor-default">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">{stat.label}</span>
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow", stat.gradient)}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
              <div className="flex items-center gap-1 text-[11px]">
                {stat.positive ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                <span className={stat.positive ? "text-green-500" : "text-red-500"}>{stat.change}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <motion.div variants={fadeInUp}>
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl shadow-lg transition-shadow">
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Collection Trends
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Monthly payment collections overview</p>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[11px]">
                  {formatCurrency(collected)} collected
                </Badge>
              </div>
            </div>
            <div className="p-3">
              <div className="h-64">
                {monthlyData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">No payment data available yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="month" className="text-[11px] text-slate-500 dark:text-slate-400" />
                      <YAxis className="text-[11px] text-slate-500 dark:text-slate-400" />
                      <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px" }} />
                      <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl shadow-lg transition-shadow">
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Home className="h-4 w-4 text-indigo-500" />
                    Occupancy Overview
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Current occupancy status across all units</p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[11px]">
                  {Math.round((occupiedCount / (unitsCount || 1)) * 100)}% Occupied
                </Badge>
              </div>
            </div>
            <div className="p-3">
              <div className="h-64 flex items-center justify-center">
                <div className="text-center w-full">
                  <div className="flex justify-center gap-8">
                    <div>
                      <div className="text-3xl font-bold text-emerald-500">{occupiedCount}</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Occupied</p>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-amber-500">{vacantCount}</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Vacant</p>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-white">{unitsCount}</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Units</p>
                    </div>
                  </div>
                  <div className="mt-4 w-full max-w-sm mx-auto h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((occupiedCount / (unitsCount || 1)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                    {Math.round((occupiedCount / (unitsCount || 1)) * 100)}% occupancy rate
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Row: Registered Tenants + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Registered Tenants - Left (wider) */}
        <motion.div variants={fadeInUp} className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl shadow-lg transition-shadow">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    Registered Tenants
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tenants currently using the platform</p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[11px]">
                  {tenantsList.length} total
                </Badge>
              </div>
            </div>
            <div className="p-3">
              {tenantsList.length === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">No tenants registered yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Property / Unit</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantsList.slice(0, 10).map((tenant) => (
                        <tr key={tenant.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Avatar src={tenant.avatarUrl} fallback={tenant.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)} size="sm" />
                              <span className="font-medium text-slate-900 dark:text-white text-sm">{tenant.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-xs">{tenant.email}</td>
                          <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-xs">{tenant.phone}</td>
                          <td className="py-2 px-2">
                            <div className="text-slate-900 dark:text-white text-sm">{tenant.propertyName}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">Unit Number: {tenant.unitNumber}</div>
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-medium px-1.5 py-0 capitalize",
                              tenant.status === "active" && "bg-green-50 text-green-600 border-green-200",
                              tenant.status === "inactive" && "bg-gray-50 text-gray-600 border-gray-200",
                            )}>{tenant.status}</Badge>
                          </td>
                          <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-xs">
                            {new Date(tenant.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Recent Payments - Right sidebar */}
        <motion.div variants={fadeInUp}>
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl shadow-lg transition-shadow h-full">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                Recent Payments
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Latest transactions</p>
            </div>
            <div className="p-3">
              <div className="space-y-2">
                {payments.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">No payments yet</div>
                ) : (
                  payments.slice(0, 5).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Avatar fallback={payment.tenantName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{payment.tenantName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{getTimeAgo(payment.paymentDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(payment.amountPaid)}</p>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-medium px-1.5 py-0 mt-0.5",
                          payment.status === "paid" && "bg-green-50 text-green-600 border-green-200",
                          payment.status === "pending" && "bg-amber-50 text-amber-600 border-amber-200",
                          payment.status === "overdue" && "bg-red-50 text-red-600 border-red-200",
                          payment.status === "partial" && "bg-blue-50 text-blue-600 border-blue-200",
                        )}>{payment.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  </div>
  );
}
