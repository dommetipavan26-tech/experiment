import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { formatTime, sourceLabel, timeAgo } from "../lib/format";
import type { Activity, ActivitySource } from "../lib/types";
import { EmptyState, SourceIcon } from "./ui";

const SOURCES: (ActivitySource | "all")[] = [
  "all",
  "ops",
  "field",
  "github",
  "vercel",
  "linear",
  "system",
];

export function ActivityStream({
  activity,
  limit,
  showFilters = false,
}: {
  activity: Activity[];
  limit?: number;
  showFilters?: boolean;
}) {
  const [filter, setFilter] = useState<ActivitySource | "all">("all");
  const sorted = useMemo(
    () =>
      [...activity]
        .filter((item) => filter === "all" || item.source === filter)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [activity, filter],
  );
  const shown = limit ? sorted.slice(0, limit) : sorted;

  return (
    <div className="activity-stream">
      {showFilters && (
        <div className="filter-row">
          {SOURCES.map((source) => (
            <button
              key={source}
              className={`chip ${filter === source ? "active" : ""}`}
              onClick={() => setFilter(source)}
            >
              {source === "all" ? "All sources" : sourceLabel[source]}
            </button>
          ))}
        </div>
      )}
      <div className="stream-live">
        <span className="pulse-dot on" />
        <span>Streaming live</span>
        <span className="stream-live-rule" />
        <span>{activity.length} events</span>
      </div>
      <div className="activity-list">
        {shown.map((item) => (
          <div className="activity-item" key={item.id}>
            <SourceIcon source={item.source} />
            <div className="activity-content">
              <p className="activity-message">{item.message}</p>
              <div className="activity-meta">
                <span className={`activity-source source-text-${item.source}`}>
                  {sourceLabel[item.source]}
                </span>
                <span className="activity-sep">·</span>
                <span title={formatTime(item.created_at)}>{timeAgo(item.created_at)}</span>
                <span className="activity-sep">·</span>
                <span className="activity-clock">{formatTime(item.created_at)} IST</span>
              </div>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <EmptyState
            icon={<Radio size={22} strokeWidth={1.6} />}
            title="No events in this channel"
            detail="New operations, field and deployment events will appear here instantly."
          />
        )}
      </div>
    </div>
  );
}

export function PresencePanel({ presence }: { presence: { id: string; name: string; role: string; color: string }[] }) {
  return (
    <div className="presence-list">
      {presence.length === 0 && (
        <p className="presence-empty-block">No responders connected yet. Open this board in another tab to see presence update live.</p>
      )}
      {presence.slice(0, 8).map((person) => (
        <div className="presence-row" key={person.id}>
          <span className="presence-avatar-wrap">
            <span
              className="avatar"
              style={{
                width: 30,
                height: 30,
                fontSize: 10,
                color: person.color,
                borderColor: `${person.color}55`,
                background: `${person.color}12`,
              }}
            >
              {person.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")}
            </span>
            <span className="presence-online" />
          </span>
          <div className="presence-copy">
            <strong>{person.name}</strong>
            <span>{person.role}</span>
          </div>
          <span className="presence-state">Online</span>
        </div>
      ))}
    </div>
  );
}
