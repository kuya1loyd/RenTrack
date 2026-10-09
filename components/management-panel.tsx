"use client";

import { Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Home, Users, Wallet, Wrench, Clock } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./management-panel.module.css";

export function ManagementBanner({
  financial = false,
  category,
  title,
  description,
  icon,
}: {
  financial?: boolean;
  category?: string;
  title?: string;
  description?: string;
  icon?: React.ElementType;
}) {
  const Icon = icon || (financial ? CreditCard : Home);
  const defaultCategory = financial ? "Financial management" : "Property management";
  const defaultTitle = financial ? "Financial Transactions" : "Units";
  const defaultDescription = financial ? "Track and manage all tenant payments and transactions." : "Browse and manage all available units in your properties.";

  return (
    <section className={styles.banner}>
      <span className={styles.bannerIcon}><Icon aria-hidden="true" /></span>
      <div className={styles.bannerCopy}>
        <p>{category || defaultCategory}</p>
        <h1>{title || defaultTitle}</h1>
        <div>{description || defaultDescription}</div>
      </div>
    </section>
  );
}

export function UnitMetrics({ total, available, occupied, maintenance }: { total: number; available: number; occupied: number; maintenance: number }) {
  return <ManagementMetrics metrics={[
    { label: "Total Units", value: total, note: "Across all properties", icon: Building2, tone: "blue" },
    { label: "Available Units", value: available, note: `${total ? Math.round(available / total * 100) : 0}% of total`, icon: CheckCircle2, tone: "green" },
    { label: "Occupied Units", value: occupied, note: `${total ? Math.round(occupied / total * 100) : 0}% of total`, icon: Users, tone: "blue" },
    { label: "Under Maintenance", value: maintenance, note: `${total ? Math.round(maintenance / total * 100) : 0}% of total`, icon: Wrench, tone: "amber" },
  ]} />;
}

export function FinancialMetrics({ collected, pending, outstanding, transactions, pendingCount, openCount }: { collected: string; pending: string; outstanding: string; transactions: number; pendingCount: number; openCount: number }) {
  return <ManagementMetrics metrics={[
    { label: "Total Collected", value: collected, note: "Verified paid transactions", icon: Wallet, tone: "green" },
    { label: "Pending Verification", value: pending, note: `${pendingCount} pending transaction${pendingCount === 1 ? "" : "s"}`, icon: Clock, tone: "blue" },
    { label: "Outstanding Balance", value: outstanding, note: `${openCount} open transaction${openCount === 1 ? "" : "s"}`, icon: CreditCard, tone: "purple" },
    { label: "Total Transactions", value: transactions, note: "Matching your filters", icon: ClipboardList, tone: "cyan" },
  ]} />;
}

function ManagementMetrics({ metrics }: { metrics: { label: string; value: string | number; note: string; icon: typeof Home; tone: string }[] }) {
  return <section className={styles.metrics} aria-label="Portfolio metrics">{metrics.map(({ icon: Icon, ...metric }) => (
    <article key={metric.label} className={styles.metric}>
      <span className={`${styles.metricIcon} ${styles[metric.tone]}`}><Icon aria-hidden="true" /></span>
      <div className={styles.metricCopy}><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.note}</small></div>
    </article>
  ))}</section>;
}

export function UnitStatus({ status }: { status: "vacant" | "occupied" | "maintenance" }) {
  return <span className={`${styles.status} ${status === "occupied" ? styles.green : status === "maintenance" ? styles.amber : styles.blue}`}>{status === "vacant" ? "Available" : status === "occupied" ? "Occupied" : "Under Maintenance"}</span>;
}

export function PaymentStatus({ status }: { status: "paid" | "pending" | "overdue" | "partial" }) {
  return <span className={`${styles.status} ${status === "paid" ? styles.green : status === "overdue" ? styles.red : status === "partial" ? styles.blue : styles.amber}`}>{status === "paid" && <CheckCircle2 aria-hidden="true" />}{status === "paid" ? "Verified" : status === "partial" ? "Partial" : status === "pending" ? "Pending" : "Overdue"}</span>;
}

export function ManagementPagination({ page, total, pageSize = 10, noun, onPageChange }: { page: number; total: number; pageSize?: number; noun: string; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const first = Math.max(1, Math.min(current - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => first + index);
  return <div className={styles.pagination}>
    <span>Showing {total ? (current - 1) * pageSize + 1 : 0}–{Math.min(current * pageSize, total)} of {total} {noun}</span>
    <nav aria-label={`${noun} pagination`}>
      <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => onPageChange(current - 1)}><ChevronLeft aria-hidden="true" /></button>
      {numbers.map((number) => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={number === current ? "page" : undefined} className={number === current ? styles.activePage : undefined} onClick={() => onPageChange(number)}>{number}</button>)}
      <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => onPageChange(current + 1)}><ChevronRight aria-hidden="true" /></button>
    </nav>
  </div>;
}
