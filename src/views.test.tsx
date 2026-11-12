import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverviewView } from "./views";
import { createDemoState } from "./lib/seed";

describe("Overview view", () => {
  it("renders the live situation, KPI cards, board and activity stream", () => {
    const state = createDemoState();
    render(
      <OverviewView
        state={state}
        query=""
        presence={[]}
        onSelectIncident={vi.fn()}
        onMove={vi.fn()}
        onUpdateSignal={vi.fn()}
        onNewSignal={vi.fn()}
        onViewAllIncidents={vi.fn()}
        onViewAllSignals={vi.fn()}
      />,
    );
    expect(screen.getByText("1 critical incident needs attention")).not.toBeNull();
    expect(screen.getByText("Open incidents")).not.toBeNull();
    expect(screen.getByText("Signals · last 60 min")).not.toBeNull();
    expect(screen.getByText("Incident command")).not.toBeNull();
    expect(screen.getByText("Live activity")).not.toBeNull();
    expect(screen.getByText("Field signal intake")).not.toBeNull();
    expect(screen.getAllByText("INC-2038").length).toBeGreaterThan(0);
  });

  it("respects the global search query", () => {
    const state = createDemoState();
    render(
      <OverviewView
        state={state}
        query="Penumaka"
        presence={[]}
        onSelectIncident={vi.fn()}
        onMove={vi.fn()}
        onUpdateSignal={vi.fn()}
        onNewSignal={vi.fn()}
        onViewAllIncidents={vi.fn()}
        onViewAllSignals={vi.fn()}
      />,
    );
    expect(screen.getAllByText("INC-2039").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("INC-2041")).toHaveLength(0);
  });
});
