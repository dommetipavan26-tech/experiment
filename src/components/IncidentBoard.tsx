import { useState, type DragEvent } from "react";
import { ArrowUpRight, Clock3, Layers, MapPin, UserRound } from "lucide-react";
import { durationLabel, statusLabel, statusOrder } from "../lib/format";
import type { Incident, IncidentStatus, Signal } from "../lib/types";
import { CategoryIcon, EmptyState, SeverityBadge } from "./ui";

function IncidentCard({
  incident,
  signals,
  onSelect,
  onDragStart,
}: {
  incident: Incident;
  signals: Signal[];
  onSelect: () => void;
  onDragStart: (event: DragEvent) => void;
}) {
  const linked = signals.filter((s) => s.incident_id === incident.id).length;
  return (
    <article
      className={`incident-card severity-${incident.severity}`}
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="card-top">
        <span className="card-code">{incident.code}</span>
        <SeverityBadge severity={incident.severity} />
      </div>
      <h3 className="card-title">{incident.title}</h3>
      <div className="card-meta">
        <CategoryIcon category={incident.category} size={14} />
        <span className="card-location" title={incident.location || incident.district}>
          <MapPin size={12} strokeWidth={1.9} />
          {incident.location || incident.district}
        </span>
      </div>
      <div className="card-foot">
        <span className="card-owner">
          <UserRound size={12} strokeWidth={1.9} />
          {incident.assignee}
        </span>
        <span className="card-time">
          <Clock3 size={12} strokeWidth={1.9} />
          {durationLabel(incident.created_at)}
        </span>
      </div>
      <div className="card-extras">
        {linked > 0 && <span className="card-linked">{linked} linked signal{linked > 1 ? "s" : ""}</span>}
        {incident.linear_id && (
          <span className="card-linear">
            <Layers size={12} strokeWidth={1.9} />
            {incident.linear_id}
          </span>
        )}
        <ArrowUpRight className="card-open" size={14} strokeWidth={1.9} />
      </div>
    </article>
  );
}

export function IncidentBoard({
  incidents,
  signals,
  onSelect,
  onMove,
  limitPerColumn,
  onViewAll,
}: {
  incidents: Incident[];
  signals: Signal[];
  onSelect: (id: string) => void;
  onMove: (id: string, status: IncidentStatus) => void;
  limitPerColumn?: number;
  onViewAll?: () => void;
}) {
  const [dragOver, setDragOver] = useState<IncidentStatus | null>(null);

  return (
    <div className="board">
      {statusOrder.map((status) => {
        const all = incidents
          .filter((i) => i.status === status)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const shown = limitPerColumn ? all.slice(0, limitPerColumn) : all;
        return (
          <div
            key={status}
            className={`board-col ${dragOver === status ? "drag-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver((current) => (current === status ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/relay-incident");
              setDragOver(null);
              if (id) onMove(id, status);
            }}
          >
            <div className="board-col-head">
              <div className="board-col-title">
                <span className={`status-marker status-${status}`} />
                {statusLabel[status]}
              </div>
              <span className="board-count">{all.length}</span>
            </div>
            <div className="board-col-body">
              {shown.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  signals={signals}
                  onSelect={() => onSelect(incident.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/relay-incident", incident.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))}
              {all.length === 0 && (
                <div className="board-empty">Drop an incident here</div>
              )}
              {limitPerColumn && all.length > limitPerColumn && (
                <button className="board-more" onClick={onViewAll}>
                  +{all.length - limitPerColumn} more in this column
                </button>
              )}
            </div>
          </div>
        );
      })}
      {incidents.length === 0 && (
        <div className="board-full-empty">
          <EmptyState
            icon={<Layers size={22} strokeWidth={1.6} />}
            title="No incidents match these filters"
            detail="Try clearing the search or changing the severity filter."
          />
        </div>
      )}
    </div>
  );
}
