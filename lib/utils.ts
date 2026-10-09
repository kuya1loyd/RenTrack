import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null): string {
  const numericAmount = typeof amount === "number" && !Number.isNaN(amount) ? amount : (Number(amount) || 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
  }).format(numericAmount);
}

export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function formatDateTime(date: Date | string | undefined | null): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parsed);
}

export function formatDateFull(date: Date | string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

export function getTimeAgo(date: Date | string): string {
  const now = new Date();
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  const diffMs = now.getTime() - parsed.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function getInitials(name?: string): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const SAMPLE_ACCOUNT_EMAILS = [
  "admin@renttrack.com",
  "renttrackowner@gmail.com",
] as const;

export function isSampleAccount(email: string): boolean {
  const lower = email.toLowerCase();
  return lower === "admin@renttrack.com" || lower === "renttrackowner@gmail.com";
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    paid: "text-green-600 bg-green-50 border-green-200",
    pending: "text-amber-600 bg-amber-50 border-amber-200",
    overdue: "text-red-600 bg-red-50 border-red-200",
    occupied: "text-blue-600 bg-blue-50 border-blue-200",
    vacant: "text-gray-600 bg-gray-50 border-gray-200",
    active: "text-green-600 bg-green-50 border-green-200",
    inactive: "text-gray-600 bg-gray-50 border-gray-200",
    approved: "text-green-600 bg-green-50 border-green-200",
    rejected: "text-red-600 bg-red-50 border-red-200",
    verified: "text-green-600 bg-green-50 border-green-200",
    unverified: "text-amber-600 bg-amber-50 border-amber-200",
  };
  return colors[status] || "text-gray-600 bg-gray-50 border-gray-200";
}

