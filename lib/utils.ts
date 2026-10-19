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


export function formatDisplayId(id?: string | null): string {
  if (!id) return "00000000";
  const s = String(id).trim();
  // If the ID contains an embedded numeric timestamp/sequence (e.g. usr_1791791116893_b8vs)
  const numMatch = s.match(/\d{6,}/);
  if (numMatch) {
    return numMatch[0];
  }
  const digitsOnly = s.replace(/\D/g, "");
  if (digitsOnly.length >= 4) {
    return digitsOnly;
  }
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000000;
  return String(h).padStart(8, "0");
}

// Helper function to extract GCash Reference Number from OCR text
export function parseGcashReference(text: string): string | null {
  if (!text) return null;

  const clean = text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");

  // 1. Matches "Ref No.", "Reference No.", "Ref. No.", "Ref:", "Reference #", "Transaction No.", etc.
  // Also tolerate letter O or o mistranscribed for 0
  const normalizedForDigits = clean.replace(/(?:ref(?:erence)?|trans(?:action)?)[^0-9a-z]*([0-9o\s.-]{7,28})/i, (match, p1) => {
    return "REF_" + p1.replace(/[oO]/g, "0");
  });

  const labeledRegex = /(?:REF_|ref(?:erence)?(?:\s*(?:no\.?|num(?:ber)?|#))?[:\s.-]*)([0-9][0-9\s.-]{7,25}[0-9])/i;
  const match = normalizedForDigits.match(labeledRegex) || clean.match(labeledRegex);
  if (match && match[1]) {
    const digits = match[1].replace(/[^0-9]/g, "");
    if (digits.length >= 8 && digits.length <= 18) {
      if (digits.length >= 12 && digits.length <= 15) {
        return digits.slice(0, 4) + " " + digits.slice(4, 8) + " " + digits.slice(8);
      }
      return digits;
    }
  }

  // 2. Common GCash 4-4-4 or 4-4-5 grouping: e.g. "1002 9841 8294" or "0012 8492 8421"
  const groupedRegex = /\b([0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4,5})\b/;
  const groupedMatch = clean.match(groupedRegex);
  if (groupedMatch && groupedMatch[1]) {
    const rawGroup = groupedMatch[1].replace(/[^0-9]/g, "");
    if (rawGroup.length >= 12) {
      return rawGroup.slice(0, 4) + " " + rawGroup.slice(4, 8) + " " + rawGroup.slice(8);
    }
    return groupedMatch[1].trim();
  }

  // 3. Fallback: Any 11-16 digit standalone sequence (ignoring typical 09xxxxxxxxx phone numbers unless >11 digits)
  const digitsRegex = /\b([0-9]{11,16})\b/g;
  const allDigits = clean.match(digitsRegex);
  if (allDigits && allDigits.length > 0) {
    const nonMobile = allDigits.find((d) => !d.startsWith("09") || d.length > 11);
    const chosen = (nonMobile || allDigits[0]).replace(/[^0-9]/g, "");
    if (chosen.length >= 12 && chosen.length <= 15) {
      return chosen.slice(0, 4) + " " + chosen.slice(4, 8) + " " + chosen.slice(8);
    }
    return chosen;
  }

  return null;
}


