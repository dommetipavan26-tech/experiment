import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  ExternalLink,
  Layers,
  MapPin,
  Send,
  UserRound,
} from "lucide-react";
import { categoryLabel, durationLabel, formatTime, statusLabel, statusOrder } from "../lib/format";
import { useRelay } from "../lib/store";
import type { Category, Incident, IncidentUpdate, Severity, Signal } from "../lib/types";
import { CategoryIcon, Field, SeverityBadge } from "./ui";

const severities: Severity[] = ["critical", "high", "medium", "low"];

export function IncidentDrawer({
  incident,
  updates,
  signals,
  onClose,
  onOpenSettings,
}: {
  incident: Incident;
  updates: IncidentUpdate[];
  signals: Signal[];
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const { actions, identity, linearKey } = useRelay();
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState(incident.assignee);
  const [saving, setSaving] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalationError, setEscalationError] = useState<string | null>(null);

  useEffect(() => {
    setAssignee(incident.assignee);
    setEscalationError(null);
  }, [incident.id, incident.assignee]);

  const timeline = useMemo(
    () =>
      updates
        .filter((u) => u.incident_id === incident.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [updates, incident.id],
  );
  const linkedSignals = signals.filter((s) => s.incident_id === incident.id);

  const submitNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await actions.addUpdate(incident.id, note.trim(), "note");
    setNote("");
    setSaving(false);
  };

  const escalate = async () => {
    setEscalating(true);
    setEscalationError(null);
    const result = await actions.escalate(incident);
    if (!result.ok) setEscalationError(result.error ?? "Escalation failed.");
    setEscalating(false);
  };

  return (
    <div className="overlay drawer-overlay" onMouseDown={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${incident.code} detail`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <div className="drawer-head-top">
            <span className="drawer-code">{incident.code}</span>
            <SeverityBadge severity={incident.severity} />
            <button className="icon-btn drawer-close" onClick={onClose} aria-label="Close incident detail">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h2>{incident.title}</h2>
          <p className="drawer-summary">{incident.summary || "No summary provided for this incident."}</p>
        </header>

        <div className="drawer-body">
          <div className="drawer-facts">
            <div className="fact">
              <span className="fact-label">Category</span>
              <span className="fact-value">
                <CategoryIcon category={incident.category} size={14} />
                {categoryLabel[incident.category as Category]}
              </span>
            </div>
            <div className="fact">
              <span className="fact-label">District</span>
              <span className="fact-value">{incident.district}</span>
            </div>
            <div className="fact">
              <span className="fact-label">Open for</span>
              <span className="fact-value"><Clock3 size={13} />{durationLabel(incident.created_at)}</span>
            </div>
            <div className="fact">
              <span className="fact-label">Opened at</span>
              <span className="fact-value">{formatTime(incident.created_at)} IST</span>
            </div>
            <div className="fact fact-wide">
              <span className="fact-label">Location</span>
              <span className="fact-value"><MapPin size={13} />{incident.location || "Not specified"}</span>
            </div>
            <div className="fact fact-wide">
              <span className="fact-label">Reported by</span>
              <span className="fact-value">{incident.reporter}</span>
            </div>
          </div>

          <section className="drawer-section">
            <h3 className="section-heading">Status</h3>
            <div className="status-grid">
              {statusOrder.map((status) => (
                <button
                  key={status}
                  className={`status-option ${incident.status === status ? "active" : ""}`}
                  onClick={() => void actions.updateIncident(incident.id, { status })}
                  disabled={incident.status === status}
                >
                  <span className={`status-marker status-${status}`} />
                  {statusLabel[status]}
                </button>
              ))}
            </div>
          </section>

          <section className="drawer-section">
            <h3 className="section-heading">Assignment</h3>
            <div className="inline-form">
              <div className="input-with-icon">
                <UserRound size={15} strokeWidth={1.9} />
                <input
                  className="input"
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                  placeholder="Owner or team"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && assignee !== incident.assignee) {
                      void actions.updateIncident(incident.id, { assignee });
                    }
                  }}
                />
              </div>
              <button
                className="btn btn-quiet"
                disabled={assignee === incident.assignee}
                onClick={() => void actions.updateIncident(incident.id, { assignee })}
              >
                Save
              </button>
            </div>
            <div className="severity-row">
              <Field label="Severity">
                <select
                  className="select"
                  value={incident.severity}
                  onChange={(event) =>
                    void actions.updateIncident(incident.id, {
                      severity: event.target.value as Severity,
                    })
                  }
                >
                  {severities.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity[0].toUpperCase() + severity.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="severity-hint">Changes sync to every connected console instantly.</div>
            </div>
          </section>

          <section className="drawer-section">
            <h3 className="section-heading">Linear escalation</h3>
            {incident.linear_id ? (
              <a className="linear-linked" href={incident.linear_url ?? "#"} target="_blank" rel="noreferrer">
                <Layers size={16} strokeWidth={1.9} />
                <span>
                  <strong>{incident.linear_id}</strong>
                  <small>Tracked in Linear · open issue</small>
                </span>
                <ExternalLink size={15} strokeWidth={1.9} />
              </a>
            ) : (
              <div className="escalate-box">
                <p>Create a tracked issue in Linear with this incident's details, severity and location.</p>
                <button className="btn btn-primary btn-block" onClick={() => void escalate()} disabled={escalating}>
                  {escalating ? "Creating issue…" : "Escalate to Linear"}
                  {!escalating && <ArrowUpRight size={15} strokeWidth={2} />}
                </button>
                {escalationError && <p className="inline-error">{escalationError}</p>}
                {!linearKey && (
                  <button className="text-link" onClick={onOpenSettings}>
                    Add a Linear API key in Settings
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="drawer-section">
            <div className="section-heading-row">
              <h3 className="section-heading">Timeline</h3>
              <span className="section-count">{timeline.length} updates · {linkedSignals.length} signals</span>
            </div>
            <div className="note-composer">
              <textarea
                className="textarea"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={`Add an update as ${identity.name}…`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submitNote();
                }}
              />
              <button className="btn btn-primary note-send" onClick={() => void submitNote()} disabled={!note.trim() || saving}>
                <Send size={14} strokeWidth={2} /> Post
              </button>
            </div>
            <div className="timeline">
              {timeline.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <span className={`timeline-dot kind-${item.kind}`} />
                  <div className="timeline-content">
                    <p>{item.body}</p>
                    <span className="timeline-meta">
                      {item.author} · {formatTime(item.created_at)} IST · {item.kind}
                    </span>
                  </div>
                </div>
              ))}
              {timeline.length === 0 && <p className="timeline-empty">No updates yet. Post the first one above.</p>}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
