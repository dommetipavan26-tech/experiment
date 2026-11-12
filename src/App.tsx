import { useEffect, useState } from "react";
import { IncidentDrawer } from "./components/IncidentDrawer";
import { NewIncidentModal, NewSignalModal, SettingsModal } from "./components/Modals";
import { Sidebar } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import { Topbar } from "./components/Topbar";
import { RelayProvider, useRelay } from "./lib/store";
import type { IncidentStatus, Signal, SignalStatus, ViewId } from "./lib/types";
import {
  ActivityView,
  defaultBoardFilters,
  EngineeringView,
  IncidentsView,
  OverviewView,
  SignalsView,
  type BoardFilters,
} from "./views";

type Modal = "incident" | "signal" | "settings" | null;

export default function App() {
  return (
    <RelayProvider>
      <Console />
    </RelayProvider>
  );
}

function Console() {
  const relay = useRelay();
  const { state, presence, connection, actions } = relay;
  const [view, setView] = useState<ViewId>("overview");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<BoardFilters>(defaultBoardFilters);
  const [signalFilter, setSignalFilter] = useState<SignalStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const selectedIncident = state.incidents.find((i) => i.id === selectedId) ?? null;
  const openIncidents = state.incidents.filter((i) => i.status !== "resolved").length;
  const unread = state.signals.filter((s) => s.status === "new").length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setSelectedId(null);
        setMobileNav(false);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      if (modal || selectedId) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setModal("incident");
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setModal("signal");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, selectedId]);

  const common = {
    state,
    query,
    onSelectIncident: setSelectedId,
  };

  const moveIncident = (id: string, status: IncidentStatus) => {
    const incident = state.incidents.find((i) => i.id === id);
    if (!incident || incident.status === status) return;
    void actions.updateIncident(id, { status });
  };

  const updateSignal = (id: string, patch: Partial<Signal>) => {
    void actions.updateSignal(id, patch);
  };

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        presence={presence}
        connection={connection}
        openIncidents={openIncidents}
        mobileOpen={mobileNav}
        closeMobile={() => setMobileNav(false)}
        onNewIncident={() => setModal("incident")}
        onSettings={() => setModal("settings")}
      />

      <main className="main">
        <Topbar
          view={view}
          query={query}
          setQuery={setQuery}
          onMenu={() => setMobileNav((open) => !open)}
          onNewIncident={() => setModal("incident")}
          onNewSignal={() => setModal("signal")}
          onSettings={() => setModal("settings")}
          onNotifications={() => setView("activity")}
          unread={unread}
        />
        <div className="content">
          {view === "overview" && (
            <OverviewView
              {...common}
              presence={presence}
              onMove={moveIncident}
              onUpdateSignal={updateSignal}
              onNewSignal={() => setModal("signal")}
              onViewAllIncidents={() => setView("incidents")}
              onViewAllSignals={() => setView("signals")}
            />
          )}
          {view === "incidents" && (
            <IncidentsView
              {...common}
              filters={filters}
              setFilters={setFilters}
              onMove={moveIncident}
              onNewIncident={() => setModal("incident")}
            />
          )}
          {view === "signals" && (
            <SignalsView
              {...common}
              statusFilter={signalFilter}
              setStatusFilter={setSignalFilter}
              onUpdateSignal={updateSignal}
              onSelectIncident={setSelectedId}
              onNewSignal={() => setModal("signal")}
            />
          )}
          {view === "activity" && <ActivityView activity={state.activity} />}
          {view === "engineering" && <EngineeringView />}
        </div>
        <footer className="app-footer">
          <span>Relay · Live Civic Operations</span>
          <span className="footer-sep">·</span>
          <span>Amaravati Capital Region</span>
          <span className="footer-spacer" />
          <span className={`footer-connection ${connection === "live" ? "on" : ""}`}>
            <span className={`pulse-dot ${connection === "live" ? "on" : connection === "demo" ? "demo" : "waiting"}`} />
            {connection === "live" ? "Realtime connected" : connection === "demo" ? "Local demo mode" : "Connecting"}
          </span>
        </footer>
      </main>

      {selectedIncident && (
        <IncidentDrawer
          incident={selectedIncident}
          updates={state.updates}
          signals={state.signals}
          onClose={() => setSelectedId(null)}
          onOpenSettings={() => {
            setSelectedId(null);
            setModal("settings");
          }}
        />
      )}
      {modal === "incident" && <NewIncidentModal onClose={() => setModal(null)} />}
      {modal === "signal" && <NewSignalModal incidents={state.incidents} onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal(null)} />}
      <Toasts />
    </div>
  );
}
