import { ArrowUpRight, BarChart3, Filter, RadioTower, Siren } from "lucide-react";
import { ActivityStream, PresencePanel } from "./components/ActivityStream";
import {
  DeliveryPipeline,
  GithubCommitPanel,
  IntegrationPanel,
  VerificationPanel,
} from "./components/EngineeringPanel";
import { IncidentBoard } from "./components/IncidentBoard";
import { SignalList } from "./components/SignalList";
import { SituationStrip, StatCards } from "./components/StatCards";
import { EmptyState, Panel, Sparkline } from "./components/ui";
import {
  categoryLabel,
  matchQuery,
  pulseSeries,
  severityLabel,
  signalStatusLabel,
  statusLabel,
  statusOrder,
} from "./lib/format";
import type {
  Activity,
  Category,
  Incident,
  IncidentStatus,
  PresenceUser,
  RelayState,
  Severity,
  Signal,
  SignalStatus,
} from "./lib/types";

export interface BoardFilters {
  status: "all" | IncidentStatus;
  severity: "all" | Severity;
  category: "all" | Category;
}

export const defaultBoardFilters: BoardFilters = {
  status: "all",
  severity: "all",
  category: "all",
};

type Common = {
  state: RelayState;
  query: string;
  onSelectIncident: (id: string) => void;
};

export function OverviewView({
  state,
  query,
  presence,
  onSelectIncident,
  onMove,
  onUpdateSignal,
  onNewSignal,
  onViewAllIncidents,
  onViewAllSignals,
}: Common & {
  presence: PresenceUser[];
  onMove: (id: string, status: IncidentStatus) => void;
  onUpdateSignal: (id: string, patch: Partial<Signal>) => void;
  onNewSignal: () => void;
  onViewAllIncidents: () => void;
  onViewAllSignals: () => void;
}) {
  const filtered = filterIncidents(state.incidents, query, defaultBoardFilters);
  const filteredSignals = filterSignals(state.signals, query);
  const series = pulseSeries(state.signals);
  const peak = Math.max(...series, 0);
  const lastHour = state.signals.filter(
    (s) => Date.now() - new Date(s.created_at).getTime() < 3600_000,
  ).length;

  return (
    <div className="view-stack">
      <SituationStrip incidents={state.incidents} signals={state.signals} presence={presence} />
      <StatCards incidents={state.incidents} signals={state.signals} updates={state.updates} />

      <div className="overview-grid">
        <Panel
          className="overview-board"
          title="Incident command"
          subtitle="Drag a card between columns to change its status"
          actions={
            <button className="text-link with-icon" onClick={onViewAllIncidents}>
              Full board <ArrowUpRight size={13} strokeWidth={2} />
            </button>
          }
          bodyClassName="board-wrap"
        >
          <IncidentBoard
            incidents={filtered}
            signals={state.signals}
            onSelect={onSelectIncident}
            onMove={onMove}
            limitPerColumn={3}
            onViewAll={onViewAllIncidents}
          />
        </Panel>

        <div className="overview-side">
          <Panel
            title="Signal volume"
            subtitle="Reports and confirmations · last 12 hours"
            actions={<span className="panel-icon"><BarChart3 size={15} strokeWidth={1.9} /></span>}
            bodyClassName="volume-body"
          >
            <Sparkline data={series} />
            <div className="volume-scale"><span>12h ago</span><span>6h ago</span><span>Now</span></div>
            <div className="volume-stats">
              <div><strong>{state.signals.length}</strong><span>Total signals</span></div>
              <div><strong>{lastHour}</strong><span>Last 60 min</span></div>
              <div><strong>{peak}</strong><span>Peak hour</span></div>
            </div>
          </Panel>

          <Panel
            title="Live activity"
            subtitle="Operations, field and delivery events"
            actions={<span className="live-tag"><span className="pulse-dot on" /> LIVE</span>}
          >
            <ActivityStream activity={state.activity} limit={6} />
          </Panel>

          <Panel title="On console" subtitle="Responders with an open session">
            <PresencePanel presence={presence} />
          </Panel>
        </div>
      </div>

      <Panel
        title="Field signal intake"
        subtitle="Newest public and field reports requiring triage"
        actions={
          <button className="text-link with-icon" onClick={onViewAllSignals}>
            All signals <ArrowUpRight size={13} strokeWidth={2} />
          </button>
        }
      >
        <SignalList
          signals={filteredSignals.slice(0, 4)}
          incidents={state.incidents}
          onUpdate={onUpdateSignal}
          onSelectIncident={onSelectIncident}
          compact
          onNew={onNewSignal}
        />
      </Panel>
    </div>
  );
}

export function IncidentsView({
  state,
  query,
  filters,
  setFilters,
  onSelectIncident,
  onMove,
  onNewIncident,
}: Common & {
  filters: BoardFilters;
  setFilters: (f: BoardFilters) => void;
  onMove: (id: string, status: IncidentStatus) => void;
  onNewIncident: () => void;
}) {
  const filtered = filterIncidents(state.incidents, query, filters);
  const counts = statusOrder.reduce<Record<string, number>>((acc, status) => {
    acc[status] = state.incidents.filter((i) => i.status === status).length;
    return acc;
  }, {});

  return (
    <div className="view-stack">
      <div className="view-intro">
        <div>
          <span className="view-kicker">COMMAND BOARD</span>
          <h2>Coordinate every active incident</h2>
          <p>Status changes, ownership and severity are synchronised to every console in real time.</p>
        </div>
        <button className="btn btn-primary" onClick={onNewIncident}>
          <Siren size={15} strokeWidth={2} /> Open incident
        </button>
      </div>

      <div className="filter-panel">
        <span className="filter-label"><Filter size={14} strokeWidth={1.9} /> Filters</span>
        <div className="filter-group">
          <span className="filter-key">Status</span>
          <button className={`chip ${filters.status === "all" ? "active" : ""}`} onClick={() => setFilters({ ...filters, status: "all" })}>All</button>
          {statusOrder.map((status) => (
            <button key={status} className={`chip ${filters.status === status ? "active" : ""}`} onClick={() => setFilters({ ...filters, status })}>
              {statusLabel[status]} <span className="chip-count">{counts[status]}</span>
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-key">Severity</span>
          <button className={`chip ${filters.severity === "all" ? "active" : ""}`} onClick={() => setFilters({ ...filters, severity: "all" })}>All</button>
          {(["critical", "high", "medium", "low"] as Severity[]).map((severity) => (
            <button key={severity} className={`chip ${filters.severity === severity ? "active" : ""}`} onClick={() => setFilters({ ...filters, severity })}>
              {severityLabel[severity]}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-key">Category</span>
          <select className="select select-compact" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value as BoardFilters["category"] })}>
            <option value="all">All categories</option>
            {(Object.keys(categoryLabel) as Category[]).map((category) => (
              <option key={category} value={category}>{categoryLabel[category]}</option>
            ))}
          </select>
        </div>
      </div>

      <Panel
        title={`${filtered.length} incident${filtered.length === 1 ? "" : "s"}`}
        subtitle="Click a card for the full command view · drag to move between stages"
        bodyClassName="board-wrap"
      >
        <IncidentBoard
          incidents={filtered}
          signals={state.signals}
          onSelect={onSelectIncident}
          onMove={onMove}
        />
      </Panel>
    </div>
  );
}

export function SignalsView({
  state,
  query,
  statusFilter,
  setStatusFilter,
  onUpdateSignal,
  onSelectIncident,
  onNewSignal,
}: Common & {
  statusFilter: SignalStatus | "all";
  setStatusFilter: (s: SignalStatus | "all") => void;
  onUpdateSignal: (id: string, patch: Partial<Signal>) => void;
  onSelectIncident: (id: string) => void;
  onNewSignal: () => void;
}) {
  const filtered = filterSignals(state.signals, query).filter(
    (s) => statusFilter === "all" || s.status === statusFilter,
  );
  const statuses: (SignalStatus | "all")[] = ["all", "new", "verified", "actioned", "dismissed"];

  return (
    <div className="view-stack">
      <div className="view-intro">
        <div>
          <span className="view-kicker">PUBLIC INTAKE</span>
          <h2>Field signals and citizen reports</h2>
          <p>Confirm, verify and action incoming reports before they become incidents.</p>
        </div>
        <button className="btn btn-primary" onClick={onNewSignal}>
          <RadioTower size={15} strokeWidth={2} /> Submit signal
        </button>
      </div>

      <div className="filter-panel">
        <span className="filter-label"><Filter size={14} strokeWidth={1.9} /> Queue</span>
        <div className="filter-group">
          {statuses.map((status) => (
            <button key={status} className={`chip ${statusFilter === status ? "active" : ""}`} onClick={() => setStatusFilter(status)}>
              {status === "all" ? "All reports" : signalStatusLabel[status]}
              <span className="chip-count">
                {status === "all" ? state.signals.length : state.signals.filter((s) => s.status === status).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Panel title={`${filtered.length} report${filtered.length === 1 ? "" : "s"}`} subtitle="Repeat confirmations increase the weight of a report in the signal volume chart">
        {filtered.length ? (
          <SignalList
            signals={filtered}
            incidents={state.incidents}
            onUpdate={onUpdateSignal}
            onSelectIncident={onSelectIncident}
          />
        ) : (
          <EmptyState icon={<RadioTower size={22} strokeWidth={1.6} />} title="Queue is clear" detail="No reports match this filter." />
        )}
      </Panel>
    </div>
  );
}

export function ActivityView({ activity }: { activity: Activity[] }) {
  return (
    <div className="view-stack">
      <div className="view-intro">
        <div>
          <span className="view-kicker">EVENT STREAM</span>
          <h2>Everything that happened, as it happened</h2>
          <p>Operations changes, field reports, commits, deployments and escalations in one timeline.</p>
        </div>
      </div>
      <Panel title="Live event timeline" subtitle="Powered by Supabase Realtime · postgres_changes on public.activity">
        <ActivityStream activity={activity} showFilters />
      </Panel>
    </div>
  );
}

export function EngineeringView() {
  return (
    <div className="view-stack">
      <div className="view-intro">
        <div>
          <span className="view-kicker">SYSTEM HEALTH</span>
          <h2>How Relay is wired together</h2>
          <p>Every connector is live: source control, hosting, realtime data and issue tracking.</p>
        </div>
      </div>
      <DeliveryPipeline />
      <div className="engineering-grid">
        <GithubCommitPanel />
        <IntegrationPanel />
      </div>
      <VerificationPanel />
    </div>
  );
}

function filterIncidents(incidents: Incident[], query: string, filters: BoardFilters): Incident[] {
  return incidents.filter((incident) => {
    if (filters.status !== "all" && incident.status !== filters.status) return false;
    if (filters.severity !== "all" && incident.severity !== filters.severity) return false;
    if (filters.category !== "all" && incident.category !== filters.category) return false;
    return matchQuery(
      [incident.code, incident.title, incident.summary, incident.district, incident.location, incident.assignee, incident.reporter],
      query,
    );
  });
}

function filterSignals(signals: Signal[], query: string): Signal[] {
  return signals.filter((signal) =>
    matchQuery([signal.title, signal.detail, signal.district, signal.location, signal.reporter], query),
  );
}
