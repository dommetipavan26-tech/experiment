import { Check, CheckCheck, CircleDashed, ExternalLink, MapPin, ThumbsUp, X } from "lucide-react";
import { categoryLabel, signalStatusLabel, timeAgo } from "../lib/format";
import type { Incident, Signal, SignalStatus } from "../lib/types";
import { Badge, CategoryIcon, EmptyState, type Tone } from "./ui";

const statusTone: Record<SignalStatus, Tone> = {
  new: "amber",
  verified: "sky",
  actioned: "teal",
  dismissed: "muted",
};

export function SignalList({
  signals,
  incidents,
  onUpdate,
  onSelectIncident,
  compact = false,
  onNew,
}: {
  signals: Signal[];
  incidents: Incident[];
  onUpdate: (id: string, patch: Partial<Signal>) => void;
  onSelectIncident: (id: string) => void;
  compact?: boolean;
  onNew?: () => void;
}) {
  if (signals.length === 0) {
    return (
      <EmptyState
        icon={<CircleDashed size={22} strokeWidth={1.6} />}
        title="No signals match"
        detail="Field and citizen reports appear here the moment they are submitted."
      />
    );
  }

  return (
    <div className="signal-list">
      {signals.map((signal) => {
        const incident = incidents.find((i) => i.id === signal.incident_id);
        return (
          <article className={`signal-row severity-${signal.severity}`} key={signal.id}>
            <CategoryIcon category={signal.category} size={17} />
            <div className="signal-main">
              <div className="signal-head">
                <h3>{signal.title}</h3>
                <Badge tone={statusTone[signal.status]} dot>
                  {signalStatusLabel[signal.status]}
                </Badge>
              </div>
              <p className="signal-detail">{signal.detail || categoryLabel[signal.category]}</p>
              <div className="signal-meta">
                <span><MapPin size={12} strokeWidth={1.9} />{signal.location || signal.district}</span>
                <span className="meta-sep">·</span>
                <span>{signal.district}</span>
                <span className="meta-sep">·</span>
                <span>{signal.reporter}</span>
                <span className="meta-sep">·</span>
                <span>{timeAgo(signal.created_at)}</span>
                {incident && (
                  <button className="signal-link" onClick={() => onSelectIncident(incident.id)}>
                    {incident.code} <ExternalLink size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
            <div className="signal-side">
              <button
                className="confirm-btn"
                onClick={() => onUpdate(signal.id, { confirmations: signal.confirmations + 1 })}
                title="Confirm this report"
              >
                <ThumbsUp size={13} strokeWidth={1.9} />
                {signal.confirmations}
              </button>
              {!compact && (
                <div className="signal-actions">
                  {signal.status !== "verified" && (
                    <button className="mini-btn" onClick={() => onUpdate(signal.id, { status: "verified" })} title="Mark verified">
                      <Check size={13} strokeWidth={2} /> Verify
                    </button>
                  )}
                  {signal.status !== "actioned" && (
                    <button className="mini-btn" onClick={() => onUpdate(signal.id, { status: "actioned" })} title="Mark actioned">
                      <CheckCheck size={13} strokeWidth={2} /> Action
                    </button>
                  )}
                  {signal.status !== "dismissed" && (
                    <button className="mini-btn mini-danger" onClick={() => onUpdate(signal.id, { status: "dismissed" })} title="Dismiss">
                      <X size={13} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
      {compact && onNew && (
        <button className="signal-add" onClick={onNew}>
          Submit another field signal
        </button>
      )}
    </div>
  );
}
