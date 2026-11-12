import { ArrowUpRight, Clock3, RadioTower, Siren, Timer } from "lucide-react";
import { medianFirstResponseMinutes } from "../lib/format";
import type { Incident, IncidentUpdate, PresenceUser, Signal } from "../lib/types";

export function SituationStrip({
  incidents,
  signals,
  presence,
}: {
  incidents: Incident[];
  signals: Signal[];
  presence: PresenceUser[];
}) {
  const open = incidents.filter((i) => i.status !== "resolved");
  const critical = open.filter((i) => i.severity === "critical");
  const unreviewed = signals.filter((s) => s.status === "new");
  const headline = critical.length
    ? `${critical.length} critical incident${critical.length > 1 ? "s" : ""} ${critical.length > 1 ? "need" : "needs"} attention`
    : open.length
      ? `${open.length} active incident${open.length > 1 ? "s" : ""} under coordination`
      : "No active incidents in the region";

  return (
    <section className="situation-strip">
      <div className="situation-main">
        <div className="situation-eyebrow">
          <span className="pulse-dot on" />
          LIVE SITUATION
          <span className="situation-rule" />
          <span>AMARAVATI CAPITAL REGION</span>
        </div>
        <h2>{headline}</h2>
        <p>
          {open.length} active · {signals.length} field signals logged · responders coordinating across{" "}
          {new Set(incidents.map((i) => i.district)).size} districts
        </p>
      </div>
      <div className="situation-metrics">
        <div className="situation-metric">
          <span className="metric-value">{open.length}</span>
          <span className="metric-label">Active</span>
        </div>
        <div className="situation-divider" />
        <div className="situation-metric">
          <span className="metric-value metric-coral">{critical.length}</span>
          <span className="metric-label">Critical</span>
        </div>
        <div className="situation-divider" />
        <div className="situation-metric">
          <span className="metric-value metric-amber">{unreviewed.length}</span>
          <span className="metric-label">Unreviewed</span>
        </div>
        <div className="situation-divider" />
        <div className="situation-metric">
          <span className="metric-value metric-teal">{presence.length}</span>
          <span className="metric-label">On console</span>
        </div>
      </div>
    </section>
  );
}

export function StatCards({
  incidents,
  signals,
  updates,
}: {
  incidents: Incident[];
  signals: Signal[];
  updates: IncidentUpdate[];
}) {
  const open = incidents.filter((i) => i.status !== "resolved");
  const elevated = open.filter((i) => i.severity === "critical" || i.severity === "high");
  const recent = signals.filter((s) => Date.now() - new Date(s.created_at).getTime() < 3600_000);
  const median = medianFirstResponseMinutes(incidents, updates);
  const resolved = incidents.filter((i) => i.status === "resolved");

  const cards = [
    {
      label: "Open incidents",
      value: String(open.length).padStart(2, "0"),
      caption: `${resolved.length} resolved on this board`,
      icon: Siren,
      tone: "teal",
    },
    {
      label: "Elevated severity",
      value: String(elevated.length).padStart(2, "0"),
      caption: "Critical and high priority",
      icon: ArrowUpRight,
      tone: "coral",
    },
    {
      label: "Signals · last 60 min",
      value: String(recent.length).padStart(2, "0"),
      caption: `${signals.length} reports in total`,
      icon: RadioTower,
      tone: "amber",
    },
    {
      label: "First response",
      value: median === null ? "—" : `${median}m`,
      caption: median === null ? "Awaiting first update" : "Median across incidents",
      icon: median === null ? Clock3 : Timer,
      tone: "sky",
    },
  ] as const;

  return (
    <div className="stat-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div className="stat-card" key={card.label}>
            <div className="stat-top">
              <span className="stat-label">{card.label}</span>
              <span className={`stat-icon tone-${card.tone}`}>
                <Icon size={17} strokeWidth={1.9} />
              </span>
            </div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-caption">{card.caption}</div>
            <span className={`stat-accent tone-${card.tone}`} />
          </div>
        );
      })}
    </div>
  );
}
