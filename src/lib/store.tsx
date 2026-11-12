import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG } from "./config";
import { createDemoState, demoPresence } from "./seed";
import { nextIncidentCode, statusLabel, uid } from "./format";
import type {
  Activity,
  ActivitySource,
  Identity,
  Incident,
  IncidentUpdate,
  NewIncidentInput,
  NewSignalInput,
  PresenceUser,
  RelayState,
  Signal,
  Toast,
} from "./types";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "demo";

type TableName = "incidents" | "incident_updates" | "signals" | "activity";
type StateKey = "incidents" | "updates" | "signals" | "activity";

const TABLE_MAP: Record<TableName, StateKey> = {
  incidents: "incidents",
  incident_updates: "updates",
  signals: "signals",
  activity: "activity",
};

const DEMO_KEY = "relay-demo-state-v1";
const IDENTITY_KEY = "relay-identity-v1";
const LINEAR_KEY = "relay-linear-key-v1";

const emptyState = (): RelayState => ({
  incidents: [],
  updates: [],
  signals: [],
  activity: [],
  presence: [],
  lastEventAt: Date.now(),
});

function readDemoState(): RelayState {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RelayState;
      if (Array.isArray(parsed.incidents) && parsed.incidents.length) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return createDemoState();
}

function readIdentity(): Identity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) return JSON.parse(raw) as Identity;
  } catch {
    /* fall through */
  }
  return {
    id: uid(),
    name: "Control desk",
    role: "Duty operator",
    color: "#3fd8a4",
  };
}

interface RelayContextValue {
  state: RelayState;
  presence: PresenceUser[];
  connection: ConnectionState;
  identity: Identity;
  linearKey: string;
  toasts: Toast[];
  isLive: boolean;
  setIdentity: (patch: Partial<Identity>) => void;
  setLinearKey: (key: string) => void;
  notify: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  actions: {
    createIncident: (input: NewIncidentInput) => Promise<string | null>;
    updateIncident: (id: string, patch: Partial<Incident>) => Promise<void>;
    addUpdate: (incidentId: string, body: string, kind?: IncidentUpdate["kind"]) => Promise<void>;
    createSignal: (input: NewSignalInput) => Promise<string | null>;
    updateSignal: (id: string, patch: Partial<Signal>) => Promise<void>;
    escalate: (incident: Incident) => Promise<{ ok: boolean; identifier?: string; error?: string }>;
    verifyLinearKey: (key?: string) => Promise<{ ok: boolean; message: string }>;
  };
}

const RelayContext = createContext<RelayContextValue | null>(null);

export function RelayProvider({ children }: { children: ReactNode }) {
  const client = useMemo<SupabaseClient | null>(
    () =>
      CONFIG.isLive
        ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
            realtime: { params: { eventsPerSecond: 20 } },
            auth: { persistSession: false },
          })
        : null,
    [],
  );

  const [state, setState] = useState<RelayState>(() =>
    CONFIG.isLive ? emptyState() : readDemoState(),
  );
  const [connection, setConnection] = useState<ConnectionState>(
    CONFIG.isLive ? "connecting" : "demo",
  );
  const [identity, setIdentityState] = useState<Identity>(readIdentity);
  const [linearKey, setLinearKeyState] = useState<string>(
    () => localStorage.getItem(LINEAR_KEY) ?? "",
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const demoChannel = useRef<BroadcastChannel | null>(null);

  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = uid();
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setIdentity = useCallback((patch: Partial<Identity>) => {
    setIdentityState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setLinearKey = useCallback((key: string) => {
    setLinearKeyState(key);
    localStorage.setItem(LINEAR_KEY, key);
  }, []);

  const demoMutate = useCallback((mutate: (prev: RelayState) => RelayState) => {
    setState((prev) => {
      const next = mutate(prev);
      const snapshot = JSON.stringify(next);
      try {
        localStorage.setItem(DEMO_KEY, snapshot);
        demoChannel.current?.postMessage({ type: "state", snapshot });
      } catch {
        /* storage may be unavailable; keep in-memory state */
      }
      return next;
    });
  }, []);

  const demoActivity = useCallback(
    (source: ActivitySource, kind: string, message: string, meta: Record<string, unknown> = {}): Activity => ({
      id: uid(),
      source,
      kind,
      message,
      meta,
      created_at: new Date().toISOString(),
    }),
    [],
  );

  // -------------------------------------------------------------------------
  // Cross-tab sync for the offline demo mode
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (CONFIG.isLive || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("relay-demo-v1");
    demoChannel.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type !== "state" || typeof event.data.snapshot !== "string") return;
      try {
        setState(JSON.parse(event.data.snapshot) as RelayState);
      } catch {
        /* ignore malformed messages */
      }
    };
    return () => {
      channel.close();
      demoChannel.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Initial load + postgres_changes subscriptions
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let firstSubscription = true;

    const load = async () => {
      const [incidents, updates, signals, activity] = await Promise.all([
        client.from("incidents").select("*").order("created_at", { ascending: false }).limit(300),
        client.from("incident_updates").select("*").order("created_at", { ascending: false }).limit(1000),
        client.from("signals").select("*").order("created_at", { ascending: false }).limit(500),
        client.from("activity").select("*").order("created_at", { ascending: false }).limit(400),
      ]);
      if (cancelled) return;
      const failed = [incidents, updates, signals, activity].find((r) => r.error);
      if (failed?.error) {
        setConnection("reconnecting");
        notify({ tone: "error", title: "Could not load live data", detail: failed.error.message });
        return;
      }
      setState((prev) => ({
        ...prev,
        incidents: (incidents.data ?? []) as Incident[],
        updates: (updates.data ?? []) as IncidentUpdate[],
        signals: (signals.data ?? []) as Signal[],
        activity: (activity.data ?? []) as Activity[],
      }));
    };
    void load();

    const channel = client.channel("relay-db-v1");
    for (const table of Object.keys(TABLE_MAP) as TableName[]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload: any) => {
          const key = TABLE_MAP[table];
          setState((prev) => {
            const list = [...(prev[key] as { id: string }[])];
            if (payload.eventType === "DELETE") {
              return {
                ...prev,
                [key]: list.filter((row) => row.id !== payload.old?.id),
                lastEventAt: Date.now(),
              } as RelayState;
            }
            const row = payload.new as { id: string };
            if (!row?.id) return prev;
            const index = list.findIndex((item) => item.id === row.id);
            if (index >= 0) list[index] = row as any;
            else list.unshift(row as any);
            return { ...prev, [key]: list, lastEventAt: Date.now() } as RelayState;
          });
        },
      );
    }
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        setConnection("live");
        // A reconnect can miss changes emitted while the socket was down.
        // Re-read the tables so every console converges on the same truth.
        if (firstSubscription) firstSubscription = false;
        else void load();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnection("reconnecting");
      } else if (status === "CLOSED") {
        setConnection("connecting");
      }
    });

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [client, notify]);

  // -------------------------------------------------------------------------
  // Live responder presence
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!client) return;
    const channel = client.channel("relay-presence-v1", {
      config: { presence: { key: identity.id } },
    });
    channel.on("presence", { event: "sync" }, () => {
      const snapshot = channel.presenceState();
      const users = Object.values(snapshot)
        .flat()
        .map((entry) => entry as unknown as PresenceUser)
        .filter((entry) => entry && typeof entry.name === "string");
      setState((prev) => ({ ...prev, presence: users }));
    });
    channel.subscribe(async (status: string) => {
      if (status !== "SUBSCRIBED") return;
      await channel.track({
        id: identity.id,
        name: identity.name,
        role: identity.role,
        color: identity.color,
        online_at: new Date().toISOString(),
      });
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, identity.id, identity.name, identity.role, identity.color]);

  const presence = useMemo<PresenceUser[]>(() => {
    if (CONFIG.isLive) return state.presence;
    return [
      {
        id: identity.id,
        name: identity.name,
        role: identity.role,
        color: identity.color,
        online_at: new Date().toISOString(),
      },
      ...demoPresence,
    ];
  }, [state.presence, identity]);

  const optimisticAdd = useCallback(
    <K extends StateKey>(key: K, row: RelayState[K][number]) => {
      setState((prev) => {
        const list = [...(prev[key] as { id: string }[])];
        if (list.some((item) => item.id === (row as { id: string }).id)) return prev;
        return {
          ...prev,
          [key]: [row, ...list],
          lastEventAt: Date.now(),
        } as RelayState;
      });
    },
    [],
  );

  const optimisticPatch = useCallback(
    (key: StateKey, id: string, patch: Record<string, unknown>) => {
      setState((prev) => {
        const list = (prev[key] as { id: string }[]).map((row) =>
          row.id === id ? ({ ...row, ...patch } as any) : row,
        );
        return { ...prev, [key]: list, lastEventAt: Date.now() } as RelayState;
      });
    },
    [],
  );

  const actions = useMemo<RelayContextValue["actions"]>(() => {
    const fail = (message: string) =>
      notify({ tone: "error", title: "Action failed", detail: message });

    const addUpdate = async (
      incidentId: string,
      body: string,
      kind: IncidentUpdate["kind"] = "note",
    ) => {
      const text = body.trim();
      if (!text) return;
      const row: IncidentUpdate = {
        id: uid(),
        incident_id: incidentId,
        body: text,
        author: identity.name,
        kind,
        created_at: new Date().toISOString(),
      };
      if (client) {
        const { error } = await client.from("incident_updates").insert(row);
        if (error) return fail(error.message);
        optimisticAdd("updates", row);
      } else {
        demoMutate((prev) => ({
          ...prev,
          updates: [row, ...prev.updates],
          lastEventAt: Date.now(),
        }));
      }
    };

    return {
      async createIncident(input: NewIncidentInput) {
        const now = new Date().toISOString();
        let row: Incident = {
          id: uid(),
          code: nextIncidentCode(state.incidents),
          title: input.title.trim(),
          summary: input.summary.trim(),
          category: input.category,
          severity: input.severity,
          status: "triage",
          district: input.district,
          location: input.location.trim(),
          reporter: identity.name,
          assignee: input.assignee.trim() || "Unassigned",
          linear_id: null,
          linear_url: null,
          created_at: now,
          updated_at: now,
          resolved_at: null,
        };
        if (client) {
          // Two operators can open an incident at the same moment. Retry with
          // the next code if Postgres rejects the unique constraint (23505).
          let attempt = 0;
          for (;;) {
            const { error } = await client.from("incidents").insert(row);
            if (!error) break;
            const isCollision = error.code === "23505";
            if (!isCollision || attempt >= 4) {
              fail(error.message);
              return null;
            }
            attempt += 1;
            const base = Number.parseInt(row.code.replace(/\D/g, ""), 10) || 2040;
            row = { ...row, code: `INC-${base + attempt}` };
          }
          optimisticAdd("incidents", row);
          await addUpdate(row.id, "Incident opened in Relay.", "system");
        } else {
          demoMutate((prev) => ({
            ...prev,
            incidents: [row, ...prev.incidents],
            activity: [
              demoActivity("ops", "incident_created", `${row.code} opened: ${row.title}`, {
                incident_id: row.id,
                severity: row.severity,
              }),
              ...prev.activity,
            ],
            lastEventAt: Date.now(),
          }));
        }
        notify({ tone: "success", title: `${row.code} opened`, detail: row.title });
        return row.code;
      },

      async updateIncident(id: string, patch: Partial<Incident>) {
        const incident = state.incidents.find((i) => i.id === id);
        const next: Record<string, unknown> = { ...patch };
        if (patch.status === "resolved") next.resolved_at = new Date().toISOString();
        else if (patch.status) next.resolved_at = null;
        if (client) {
          const { error } = await client.from("incidents").update(next).eq("id", id);
          if (error) return fail(error.message);
          optimisticPatch("incidents", id, next);
          if (patch.status && incident && patch.status !== incident.status) {
            await addUpdate(
              id,
              `${identity.name} moved status to ${statusLabel[patch.status]}.`,
              "status",
            );
          }
        } else {
          demoMutate((prev) => ({
            ...prev,
            incidents: prev.incidents.map((i) => (i.id === id ? ({ ...i, ...next } as Incident) : i)),
            activity: patch.status
              ? [
                  demoActivity(
                    "ops",
                    "status_changed",
                    `${incident?.code ?? "Incident"} moved to ${statusLabel[patch.status]}`,
                    { incident_id: id, status: patch.status },
                  ),
                  ...prev.activity,
                ]
              : prev.activity,
            lastEventAt: Date.now(),
          }));
        }
      },

      addUpdate,

      async createSignal(input: NewSignalInput) {
        const row: Signal = {
          id: uid(),
          title: input.title.trim(),
          detail: input.detail.trim(),
          category: input.category,
          severity: input.severity,
          status: "new",
          district: input.district,
          location: input.location.trim(),
          reporter: identity.name,
          confirmations: 0,
          incident_id: input.incident_id,
          created_at: new Date().toISOString(),
        };
        if (client) {
          const { error } = await client.from("signals").insert(row);
          if (error) {
            fail(error.message);
            return null;
          }
          optimisticAdd("signals", row);
        } else {
          demoMutate((prev) => ({
            ...prev,
            signals: [row, ...prev.signals],
            activity: [
              demoActivity("field", "signal_received", `Field report: ${row.title}`, {
                signal_id: row.id,
                district: row.district,
              }),
              ...prev.activity,
            ],
            lastEventAt: Date.now(),
          }));
        }
        notify({ tone: "success", title: "Field signal received", detail: row.title });
        return row.id;
      },

      async updateSignal(id: string, patch: Partial<Signal>) {
        const confirmationOnly =
          Object.keys(patch).length === 1 && typeof patch.confirmations === "number";
        if (client) {
          if (confirmationOnly) {
            // Atomic increment on the server: simultaneous confirmations from
            // different consoles can never overwrite one another.
            const { data, error } = await client.rpc("relay_confirm_signal", { p_id: id });
            if (error) {
              const fallback = await client
                .from("signals")
                .update({ confirmations: patch.confirmations })
                .eq("id", id);
              if (fallback.error) return fail(fallback.error.message);
              optimisticPatch("signals", id, patch as Record<string, unknown>);
            } else {
              optimisticPatch("signals", id, { confirmations: Number(data ?? 0) });
            }
            return;
          }
          const { error } = await client.from("signals").update(patch).eq("id", id);
          if (error) return fail(error.message);
          optimisticPatch("signals", id, patch as Record<string, unknown>);
          if (patch.status) {
            const signal = state.signals.find((s) => s.id === id);
            await client.from("activity").insert({
              id: uid(),
              source: "ops",
              kind: "signal_status",
              message: `Signal ${patch.status}: ${signal?.title ?? "field report"}`,
              meta: { signal_id: id, status: patch.status },
            });
          }
        } else {
          demoMutate((prev) => ({
            ...prev,
            signals: prev.signals.map((s) => (s.id === id ? { ...s, ...patch } : s)),
            lastEventAt: Date.now(),
          }));
        }
      },

      async escalate(incident: Incident) {
        if (!CONFIG.edgeBase) {
          return { ok: false, error: "Escalation requires a live Supabase connection." };
        }
        try {
          const res = await fetch(`${CONFIG.edgeBase}/escalate-linear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ incident_id: incident.id, api_key: linearKey }),
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message =
              data?.error === "linear_key_required"
                ? "Add your Linear API key in Settings to enable escalation."
                : data?.detail || data?.message || data?.error || `Request failed (${res.status})`;
            return { ok: false, error: String(message) };
          }
          if (data?.identifier) {
            optimisticPatch("incidents", incident.id, {
              linear_id: data.identifier,
              linear_url: data.url ?? null,
            });
            notify({
              tone: "success",
              title: `Escalated to ${data.identifier}`,
              detail: "The Linear issue is now linked to this incident.",
            });
          }
          return { ok: true, identifier: data?.identifier };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Network error" };
        }
      },

      async verifyLinearKey(keyOverride?: string) {
        const candidate = (keyOverride ?? linearKey).trim();
        if (!CONFIG.edgeBase) {
          return { ok: false, message: "A live Supabase connection is required." };
        }
        if (!candidate) {
          return { ok: false, message: "Add a Linear personal API key first." };
        }
        try {
          const res = await fetch(`${CONFIG.edgeBase}/escalate-linear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verify", api_key: candidate }),
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              ok: false,
              message: String(data?.detail ?? data?.message ?? data?.error ?? `HTTP ${res.status}`),
            };
          }
          return {
            ok: true,
            message: `Connected as ${data?.viewer?.name ?? "Linear user"}${data?.viewer?.email ? ` (${data.viewer.email})` : ""}.`,
          };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "Network error" };
        }
      },
    };
  }, [
    client,
    demoActivity,
    demoMutate,
    identity.name,
    linearKey,
    notify,
    optimisticAdd,
    optimisticPatch,
    state.incidents,
    state.signals,
  ]);

  const value = useMemo<RelayContextValue>(
    () => ({
      state,
      presence,
      connection,
      identity,
      linearKey,
      toasts,
      isLive: CONFIG.isLive,
      setIdentity,
      setLinearKey,
      notify,
      dismissToast,
      actions,
    }),
    [
      state,
      presence,
      connection,
      identity,
      linearKey,
      toasts,
      setIdentity,
      setLinearKey,
      notify,
      dismissToast,
      actions,
    ],
  );

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
}

export function useRelay(): RelayContextValue {
  const context = useContext(RelayContext);
  if (!context) throw new Error("useRelay must be used inside RelayProvider");
  return context;
}
