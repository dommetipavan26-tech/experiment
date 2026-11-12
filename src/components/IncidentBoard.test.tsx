import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncidentBoard } from "./IncidentBoard";
import { createDemoState } from "../lib/seed";

describe("incident command board", () => {
  it("groups seeded incidents into the four workflow columns", () => {
    const state = createDemoState();
    render(
      <IncidentBoard
        incidents={state.incidents}
        signals={state.signals}
        onSelect={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    expect(screen.getByText("Triage")).not.toBeNull();
    expect(screen.getByText("Responding")).not.toBeNull();
    expect(screen.getByText("Monitoring")).not.toBeNull();
    expect(screen.getByText("Resolved")).not.toBeNull();
    expect(screen.getByText("Feeder tripped near Velagapudi")).not.toBeNull();
    expect(screen.getByText("INC-2041")).not.toBeNull();
  });

  it("shows an empty-state message when filters match nothing", () => {
    render(
      <IncidentBoard incidents={[]} signals={[]} onSelect={vi.fn()} onMove={vi.fn()} />,
    );
    expect(screen.getByText("No incidents match these filters")).not.toBeNull();
  });
});
