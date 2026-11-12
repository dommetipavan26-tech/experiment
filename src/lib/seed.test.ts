import { describe, expect, it } from "vitest";
import { createDemoState, demoPresence } from "./seed";
import type { Category, IncidentStatus, Severity } from "./types";

const severities: Severity[] = ["critical", "high", "medium", "low"];
const statuses: IncidentStatus[] = ["triage", "responding", "monitoring", "resolved"];
const categories: Category[] = ["power", "water", "traffic", "weather", "network", "safety", "other"];

describe("demo seed state", () => {
  it("contains a complete, coherent shift", () => {
    const state = createDemoState();
    expect(state.incidents).toHaveLength(6);
    expect(state.updates).toHaveLength(10);
    expect(state.signals).toHaveLength(9);
    expect(state.activity.length).toBeGreaterThanOrEqual(6);
    expect(state.presence).toEqual([]);
  });

  it("uses unique ids and valid enum values", () => {
    const state = createDemoState();
    const ids = [
      ...state.incidents.map((i) => i.id),
      ...state.updates.map((u) => u.id),
      ...state.signals.map((s) => s.id),
      ...state.activity.map((a) => a.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const incident of state.incidents) {
      expect(severities).toContain(incident.severity);
      expect(statuses).toContain(incident.status);
      expect(categories).toContain(incident.category);
      expect(Number.isNaN(Date.parse(incident.created_at))).toBe(false);
    }
  });

  it("only links signals and updates to incidents that exist", () => {
    const state = createDemoState();
    const incidentIds = new Set(state.incidents.map((i) => i.id));
    for (const update of state.updates) expect(incidentIds.has(update.incident_id)).toBe(true);
    for (const signal of state.signals) {
      if (signal.incident_id) expect(incidentIds.has(signal.incident_id)).toBe(true);
      expect(signal.confirmations).toBeGreaterThanOrEqual(0);
    }
  });

  it("provides three simulated responders for offline mode", () => {
    expect(demoPresence).toHaveLength(3);
    expect(demoPresence.every((p) => p.name && p.role && p.color)).toBe(true);
  });
});
