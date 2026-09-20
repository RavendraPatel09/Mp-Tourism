import type { Difficulty, Season, CrowdLevel } from "./types";

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (minutes % 60 === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  if (minutes < 60 * 24) {
    const h = Math.floor(hours);
    return `${h} hr ${minutes % 60} min`;
  }
  const days = +(minutes / (60 * 24)).toFixed(1);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function formatInr(amount: number) {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string, now = Date.now()) {
  const diffMs = new Date(iso).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return "just now";
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  challenging: "Challenging",
  strenuous: "Strenuous",
};

export const SEASON_LABEL: Record<Season, string> = {
  winter: "Winter (Oct–Feb)",
  summer: "Summer (Mar–Jun)",
  monsoon: "Monsoon (Jul–Sep)",
  post_monsoon: "Post-monsoon (Oct–Nov)",
  year_round: "Year round",
};

export const CROWD_LABEL: Record<CrowdLevel, string> = {
  low: "Rarely crowded",
  moderate: "Moderate crowds",
  high: "Gets crowded",
  at_capacity: "At carrying capacity",
};

export const DURATION_BUCKETS = [
  { value: "2h", label: "Up to 2 hours", maxMin: 120 },
  { value: "half_day", label: "Half day", maxMin: 300 },
  { value: "full_day", label: "Full day", maxMin: 600 },
  { value: "multi_day", label: "Multi-day", maxMin: Number.MAX_SAFE_INTEGER },
] as const;

export function slugToTitle(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
