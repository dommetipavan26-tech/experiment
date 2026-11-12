import {
  Activity,
  GitBranch,
  LayoutDashboard,
  Plus,
  RadioTower,
  Settings2,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ConnectionState } from "../lib/store";
import type { PresenceUser, ViewId } from "../lib/types";
import { Avatar } from "./ui";

const NAV: { id: ViewId; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, hint: "Situation at a glance" },
  { id: "incidents", label: "Incidents", icon: Siren, hint: "Command board" },
  { id: "signals", label: "Field signals", icon: RadioTower, hint: "Public reports" },
  { id: "activity", label: "Activity", icon: Activity, hint: "Live event stream" },
  { id: "engineering", label: "Engineering", icon: GitBranch, hint: "Delivery pipeline" },
];

const connectionLabel: Record<ConnectionState, string> = {
  live: "Realtime connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  demo: "Local demo mode",
};

export function Sidebar({
  view,
  setView,
  presence,
  connection,
  openIncidents,
  mobileOpen,
  closeMobile,
  onNewIncident,
  onSettings,
}: {
  view: ViewId;
  setView: (v: ViewId) => void;
  presence: PresenceUser[];
  connection: ConnectionState;
  openIncidents: number;
  mobileOpen: boolean;
  closeMobile: () => void;
  onNewIncident: () => void;
  onSettings: () => void;
}) {
  const navigate = (id: ViewId) => {
    setView(id);
    closeMobile();
  };

  return (
    <>
      <div
        className={`sidebar-scrim ${mobileOpen ? "visible" : ""}`}
        onClick={closeMobile}
        aria-hidden="true"
      />
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="34" height="34">
              <circle cx="20" cy="20" r="3.4" fill="#3fd8a4" />
              <path d="M12.5 12.5a10.6 10.6 0 0 0 0 15" fill="none" stroke="#3fd8a4" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M27.5 12.5a10.6 10.6 0 0 1 0 15" fill="none" stroke="#3fd8a4" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M7.5 7.5a17.7 17.7 0 0 0 0 25" fill="none" stroke="#2a7c68" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M32.5 7.5a17.7 17.7 0 0 1 0 25" fill="none" stroke="#2a7c68" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>Relay</strong>
            <small>LIVE CIVIC OPS</small>
          </span>
        </div>

        <button className="sidebar-action" onClick={() => { onNewIncident(); closeMobile(); }}>
          <Plus size={16} strokeWidth={2.2} />
          <span>Open incident</span>
          <kbd>N</kbd>
        </button>

        <div className="nav-label">Workspace</div>
        <nav className="nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
                title={item.hint}
              >
                <Icon size={17} strokeWidth={1.9} />
                <span>{item.label}</span>
                {item.id === "incidents" && openIncidents > 0 && (
                  <span className="nav-count">{openIncidents}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="connection-card">
          <div className="connection-head">
            <span className={`pulse-dot ${connection === "live" ? "on" : connection === "demo" ? "demo" : "waiting"}`} />
            <span className="connection-title">{connectionLabel[connection]}</span>
          </div>
          <p className="connection-detail">
            {connection === "live"
              ? "Postgres changes + presence streaming"
              : connection === "demo"
                ? "Local state syncs across browser tabs"
                : "Waiting for the Supabase channel"}
          </p>
          <div className="connection-divider" />
          <div className="presence-head">
            <Users size={13} strokeWidth={1.9} />
            <span>On console</span>
            <strong>{presence.length}</strong>
          </div>
          <div className="avatar-row">
            {presence.slice(0, 5).map((person) => (
              <Avatar key={person.id} name={person.name} color={person.color} size={26} />
            ))}
            {presence.length > 5 && <span className="avatar-more">+{presence.length - 5}</span>}
            {presence.length === 0 && <span className="presence-empty">Waiting for responders</span>}
          </div>
        </div>

        <button className="nav-item settings-item" onClick={() => { onSettings(); closeMobile(); }}>
          <Settings2 size={17} strokeWidth={1.9} />
          <span>Settings</span>
        </button>
        <div className="sidebar-version">RELAY / 1.0.0 · APCR</div>
      </aside>
    </>
  );
}
