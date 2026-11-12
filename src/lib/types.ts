export type Severity = "critical" | "high" | "medium" | "low";
export type Category =
  | "power"
  | "water"
  | "traffic"
  | "weather"
  | "network"
  | "safety"
  | "other";
export type IncidentStatus = "triage" | "responding" | "monitoring" | "resolved";
export type SignalStatus = "new" | "verified" | "actioned" | "dismissed";
export type UpdateKind = "note" | "status" | "assignment" | "system" | "linear";
export type ActivitySource = "ops" | "field" | "system" | "github" | "vercel" | "linear";

export interface Incident {
  id: string;
  code: string;
  title: string;
  summary: string;
  category: Category;
  severity: Severity;
  status: IncidentStatus;
  district: string;
  location: string;
  reporter: string;
  assignee: string;
  linear_id: string | null;
  linear_url: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  body: string;
  author: string;
  kind: UpdateKind;
  created_at: string;
}

export interface Signal {
  id: string;
  title: string;
  detail: string;
  category: Category;
  severity: Severity;
  status: SignalStatus;
  district: string;
  location: string;
  reporter: string;
  confirmations: number;
  incident_id: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  source: ActivitySource;
  kind: string;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface PresenceUser {
  id: string;
  name: string;
  role: string;
  online_at: string;
  color: string;
}

export interface Identity {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface RelayState {
  incidents: Incident[];
  updates: IncidentUpdate[];
  signals: Signal[];
  activity: Activity[];
  presence: PresenceUser[];
  lastEventAt: number;
}

export interface NewIncidentInput {
  title: string;
  summary: string;
  category: Category;
  severity: Severity;
  district: string;
  location: string;
  assignee: string;
}

export interface NewSignalInput {
  title: string;
  detail: string;
  category: Category;
  severity: Severity;
  district: string;
  location: string;
  incident_id: string | null;
}

export type ViewId = "overview" | "incidents" | "signals" | "activity" | "engineering";

export interface Toast {
  id: string;
  title: string;
  detail?: string;
  tone: "info" | "success" | "warn" | "error";
}
