import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Plus, Radio, Search, Settings2 } from "lucide-react";
import { CONSTANTS } from "../lib/config";
import { formatClock } from "../lib/format";
import type { ViewId } from "../lib/types";

const TITLES: Record<ViewId, { title: string; crumb: string }> = {
  overview: { title: "Overview", crumb: "Operations / Situation room" },
  incidents: { title: "Incidents", crumb: "Operations / Command board" },
  signals: { title: "Field signals", crumb: "Operations / Public reports" },
  activity: { title: "Activity", crumb: "Operations / Event stream" },
  engineering: { title: "Engineering", crumb: "System / Delivery pipeline" },
};

export function Topbar({
  view,
  query,
  setQuery,
  onMenu,
  onNewIncident,
  onNewSignal,
  onSettings,
  onNotifications,
  unread,
}: {
  view: ViewId;
  query: string;
  setQuery: (q: string) => void;
  onMenu: () => void;
  onNewIncident: () => void;
  onNewSignal: () => void;
  onSettings: () => void;
  onNotifications: () => void;
  unread: number;
}) {
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Menu size={19} strokeWidth={1.8} />
        </button>
        <div className="topbar-titles">
          <span className="crumb">{TITLES[view].crumb}</span>
          <h1>{TITLES[view].title}</h1>
        </div>
        <span className="region-tag">
          <Radio size={13} strokeWidth={2} />
          {CONSTANTS.region}
        </span>
      </div>

      <div className="topbar-right">
        <div className="search-wrap">
          <Search size={15} strokeWidth={1.9} />
          <input
            ref={searchRef}
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search incidents, signals, locations…"
            aria-label="Search board"
          />
          <kbd>/</kbd>
        </div>
        <div className="clock-block" title="Indian Standard Time">
          <span className="clock-time">{formatClock(now)}</span>
          <span className="clock-zone">IST</span>
        </div>
        <button className="icon-btn notification-btn" onClick={onNotifications} aria-label="Open activity stream">
          <Bell size={18} strokeWidth={1.8} />
          {unread > 0 && <span className="notification-dot" />}
        </button>
        <button className="icon-btn desktop-settings" onClick={onSettings} aria-label="Settings">
          <Settings2 size={18} strokeWidth={1.8} />
        </button>
        <button className="btn btn-quiet new-signal-btn" onClick={onNewSignal}>
          <Plus size={15} strokeWidth={2.2} />
          <span>Field signal</span>
        </button>
        <button className="btn btn-primary" onClick={onNewIncident}>
          <Plus size={15} strokeWidth={2.2} />
          <span>New incident</span>
        </button>
      </div>
    </header>
  );
}
