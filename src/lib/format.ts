import type {
  ActivitySource,
  Category,
  Incident,
  IncidentStatus,
  Severity,
  Signal,
  SignalStatus,
} from "./types";

export const categoryLabel: Record<Category, string> = {
  power: "Power",
  water: "Water",
  traffic: "Traffic",
  weather: "Weather",
  network: "Network",
  safety: "Safety",
  other: "General",
};

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const statusLabel: Record<IncidentStatus, string> = {
  triage: "Triage",
  responding: "Responding",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export const signalStatusLabel: Record<SignalStatus, string> = {
  new: "Unreviewed",
  verified: "Verified",
  actioned: "Actioned",
  dismissed: "Dismissed",
};

export const sourceLabel: Record<ActivitySource, string> = {
  ops: "Operations",
  field: "Field",
  system: "System",
  github: "GitHub",
  vercel: "Vercel",
  linear: "Linear",
};

export const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const statusOrder: IncidentStatus[] = [
  "triage",
  "responding",
  "monitoring",
  "resolved",
];

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function durationLabel(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

const istTime = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});
const istDate = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
const istClock = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

export const formatTime = (iso: string) => istTime.format(new Date(iso));
export const formatDate = (iso: string) => istDate.format(new Date(iso));
export const formatClock = (d: Date) => istClock.format(d);

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nextIncidentCode(incidents: Incident[]): string {
  const max = incidents.reduce((acc, i) => {
    const n = Number.parseInt(i.code.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 2040);
  return `INC-${max + 1}`;
}

export function pulseSeries(signals: Signal[], hours = 12, now = Date.now()): number[] {
  const buckets = Array.from({ length: hours }, () => 0);
  const start = now - hours * 3600_000;
  for (const s of signals) {
    const t = new Date(s.created_at).getTime();
    if (t < start || t > now) continue;
    const idx = Math.min(hours - 1, Math.floor((t - start) / 3600_000));
    buckets[idx] += 1 + Math.min(3, Math.floor(s.confirmations / 8));
  }
  return buckets;
}

export function medianFirstResponseMinutes(
  incidents: Incident[],
  updates: { incident_id: string; created_at: string }[],
): number | null {
  const firstByIncident = new Map<string, number>();
  for (const u of updates) {
    const t = new Date(u.created_at).getTime();
    const current = firstByIncident.get(u.incident_id);
    if (current === undefined || t < current) firstByIncident.set(u.incident_id, t);
  }
  const values: number[] = [];
  for (const incident of incidents) {
    const first = firstByIncident.get(incident.id);
    if (first === undefined) continue;
    const mins = Math.round((first - new Date(incident.created_at).getTime()) / 60000);
    if (mins >= 0 && mins < 60 * 24 * 7) values.push(mins);
  }
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
}

export function matchQuery(haystack: string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((s) => s.toLowerCase().includes(q));
}
