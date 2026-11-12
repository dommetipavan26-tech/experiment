import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { RelayProvider, useRelay } from "./store";

type Ctx = ReturnType<typeof useRelay>;

function mount() {
  let context: Ctx | undefined;
  function Probe() {
    context = useRelay();
    return <div data-testid="count">{context.state.incidents.length}</div>;
  }
  render(
    <RelayProvider>
      <Probe />
    </RelayProvider>,
  );
  if (!context) throw new Error("RelayProvider did not publish its context");
  return () => context as Ctx;
}

describe("Relay store (offline demo mode)", () => {
  it("starts in demo mode with seed data and simulated presence", () => {
    const get = mount();
    expect(get().connection).toBe("demo");
    expect(get().isLive).toBe(false);
    expect(get().state.incidents).toHaveLength(6);
    expect(get().state.signals).toHaveLength(9);
    expect(get().presence).toHaveLength(4);
  });

  it("opens an incident with the next code and logs activity", async () => {
    const get = mount();
    const before = get().state.activity.length;
    let code: string | null = null;
    await act(async () => {
      code = await get().actions.createIncident({
        title: "Transformer overload at Nidamarru",
        summary: "Thermal alarm on the 33 kV transformer.",
        category: "power",
        severity: "high",
        district: "Guntur",
        location: "Nidamarru substation",
        assignee: "K. Rao",
      });
    });
    expect(code).toBe("INC-2042");
    expect(get().state.incidents).toHaveLength(7);
    expect(get().state.incidents[0].status).toBe("triage");
    expect(get().state.activity.length).toBe(before + 1);
  });

  it("moves an incident to resolved and records the transition", async () => {
    const get = mount();
    const target = get().state.incidents.find((i) => i.code === "INC-2038");
    const before = get().state.activity.length;
    await act(async () => {
      await get().actions.updateIncident(target!.id, { status: "resolved" });
    });
    const updated = get().state.incidents.find((i) => i.id === target!.id);
    expect(updated?.status).toBe("resolved");
    expect(updated?.resolved_at).not.toBeNull();
    expect(get().state.activity.length).toBe(before + 1);
  });

  it("accepts a field signal and updates its confirmation count", async () => {
    const get = mount();
    let id: string | null = null;
    await act(async () => {
      id = await get().actions.createSignal({
        title: "Streetlight pole leaning on service road",
        detail: "Pole tilted after the storm.",
        category: "safety",
        severity: "medium",
        district: "NTR",
        location: "NH-16 service road",
        incident_id: null,
      });
    });
    expect(get().state.signals).toHaveLength(10);
    await act(async () => {
      await get().actions.updateSignal(id!, { confirmations: 4, status: "verified" });
    });
    const signal = get().state.signals.find((s) => s.id === id);
    expect(signal?.confirmations).toBe(4);
    expect(signal?.status).toBe("verified");
  });

  it("reflects operator identity changes in presence", async () => {
    const get = mount();
    await act(async () => {
      get().setIdentity({ name: "Pavan Dommeti", role: "QA tester" });
    });
    expect(get().presence[0].name).toBe("Pavan Dommeti");
    expect(get().presence[0].role).toBe("QA tester");
  });
});
