import { useState } from "react";
import {
  ArrowUpRight,
  Database,
  GitBranch,
  KeyRound,
  Layers,
  Radio,
  Server,
  ShieldCheck,
} from "lucide-react";
import { CONFIG, CONSTANTS } from "../lib/config";
import { categoryLabel, severityLabel } from "../lib/format";
import { useRelay } from "../lib/store";
import type { Category, Incident, Severity } from "../lib/types";
import { Field, ModalShell } from "./ui";

const categories = CONSTANTS.categories;
const severities: Severity[] = ["critical", "high", "medium", "low"];

export function NewIncidentModal({ onClose }: { onClose: () => void }) {
  const { actions, identity } = useRelay();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<Category>("power");
  const [severity, setSeverity] = useState<Severity>("high");
  const [district, setDistrict] = useState<string>(CONSTANTS.districts[0]);
  const [location, setLocation] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    await actions.createIncident({
      title,
      summary,
      category,
      severity,
      district,
      location,
      assignee: assignee || identity.name,
    });
    setBusy(false);
    onClose();
  };

  return (
    <ModalShell
      title="Open a new incident"
      subtitle="Every connected console sees this incident immediately."
      onClose={onClose}
      width={600}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={!title.trim() || busy}>
            {busy ? "Opening…" : "Open incident"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Incident title" className="span-2">
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Feeder outage near Rayapudi"
            autoFocus
          />
        </Field>
        <Field label="Summary" className="span-2">
          <textarea
            className="textarea"
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What happened, who is affected, and what is already in motion?"
          />
        </Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {categories.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select className="select" value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}>
            {severities.map((s) => <option key={s} value={s}>{severityLabel[s]}</option>)}
          </select>
        </Field>
        <Field label="District">
          <select className="select" value={district} onChange={(event) => setDistrict(event.target.value)}>
            {CONSTANTS.districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Assigned to">
          <input className="input" value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder={identity.name} />
        </Field>
        <Field label="Location" className="span-2">
          <input className="input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Street, junction, substation or landmark" />
        </Field>
      </div>
    </ModalShell>
  );
}

export function NewSignalModal({
  incidents,
  onClose,
}: {
  incidents: Incident[];
  onClose: () => void;
}) {
  const { actions } = useRelay();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [category, setCategory] = useState<Category>("power");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [district, setDistrict] = useState<string>(CONSTANTS.districts[0]);
  const [location, setLocation] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    await actions.createSignal({
      title,
      detail,
      category,
      severity,
      district,
      location,
      incident_id: incidentId || null,
    });
    setBusy(false);
    onClose();
  };

  return (
    <ModalShell
      title="Submit a field signal"
      subtitle="Citizen and field reports land in the live intake queue."
      onClose={onClose}
      width={600}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={!title.trim() || busy}>
            {busy ? "Submitting…" : "Submit signal"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="What did you observe?" className="span-2">
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. No supply since 06:10 in Rayapudi" autoFocus />
        </Field>
        <Field label="Additional detail" className="span-2">
          <textarea className="textarea" rows={3} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Add any context that helps the duty operator triage this report." />
        </Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {categories.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select className="select" value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}>
            {severities.map((s) => <option key={s} value={s}>{severityLabel[s]}</option>)}
          </select>
        </Field>
        <Field label="District">
          <select className="select" value={district} onChange={(event) => setDistrict(event.target.value)}>
            {CONSTANTS.districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Location">
          <input className="input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Street or landmark" />
        </Field>
        <Field label="Link to incident" className="span-2" hint="Optional — attach this report to an ongoing incident.">
          <select className="select" value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>
            <option value="">No linked incident</option>
            {incidents
              .filter((i) => i.status !== "resolved")
              .map((i) => <option key={i.id} value={i.id}>{i.code} · {i.title}</option>)}
          </select>
        </Field>
      </div>
    </ModalShell>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { identity, setIdentity, linearKey, setLinearKey, connection, isLive, presence, notify, actions } = useRelay();
  const [name, setName] = useState(identity.name);
  const [role, setRole] = useState(identity.role);
  const [key, setKey] = useState(linearKey);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const testKey = async () => {
    setVerifying(true);
    setVerifyResult(null);
    setVerifyResult(await actions.verifyLinearKey(key));
    setVerifying(false);
  };

  const save = () => {
    setIdentity({ name: name.trim() || "Control desk", role });
    setLinearKey(key.trim());
    notify({ tone: "success", title: "Settings saved", detail: "Your presence and escalation settings are updated." });
    onClose();
  };

  const connections = [
    { icon: Database, label: "Supabase", value: `${CONSTANTS.projectRef} · ap-south-1`, tone: "teal" },
    { icon: Radio, label: "Realtime", value: connection === "live" ? "Streaming · 4 tables" : connection, tone: "sky" },
    { icon: Server, label: "Vercel", value: `${CONSTANTS.vercelProject} · production`, tone: "amber" },
    { icon: GitBranch, label: "GitHub", value: `${CONFIG.githubRepo} · main`, tone: "muted" },
    { icon: Layers, label: "Linear", value: `Team ${CONFIG.linearTeamKey} · escalation`, tone: "coral" },
  ];

  return (
    <ModalShell
      title="Console settings"
      subtitle="Your operator identity, escalation key and connected systems."
      onClose={onClose}
      width={620}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save changes</button>
        </>
      }
    >
      <div className="settings-section">
        <div className="settings-heading">
          <ShieldCheck size={16} strokeWidth={1.9} />
          <span>Operator identity</span>
        </div>
        <div className="form-grid">
          <Field label="Display name">
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Role">
            <select className="select" value={role} onChange={(event) => setRole(event.target.value)}>
              {CONSTANTS.roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <p className="settings-hint">
          {presence.length} responder{presence.length === 1 ? "" : "s"} currently visible on the console. Presence updates as soon as you save.
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-heading">
          <KeyRound size={16} strokeWidth={1.9} />
          <span>Linear API key</span>
          <span className={`settings-key-state ${key.trim() ? "on" : ""}`}>
            {key.trim() ? "CONFIGURED" : "NOT SET"}
          </span>
        </div>
        <Field
          label="Personal API key"
          hint="Stored only in this browser and sent directly to the Relay escalation function. Create one in Linear under Settings → API → Personal API keys."
        >
          <input
            className="input mono-input"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="lin_api_…"
            autoComplete="off"
          />
        </Field>
        <div className="key-test-row">
          <button className="btn btn-quiet" onClick={() => void testKey()} disabled={!key.trim() || verifying}>
            {verifying ? "Checking…" : "Test connection"}
          </button>
          {verifyResult && (
            <span className={`key-test-result ${verifyResult.ok ? "ok" : "bad"}`}>{verifyResult.message}</span>
          )}
        </div>
        <a className="text-link with-icon" href="https://linear.app/settings/api" target="_blank" rel="noreferrer">
          Open Linear API settings <ArrowUpRight size={13} strokeWidth={2} />
        </a>
      </div>

      <div className="settings-section">
        <div className="settings-heading">
          <Server size={16} strokeWidth={1.9} />
          <span>Connected systems</span>
          <span className={`settings-live ${isLive ? "on" : ""}`}>{isLive ? "LIVE" : "DEMO"}</span>
        </div>
        <div className="connection-rows">
          {connections.map((item) => {
            const Icon = item.icon;
            return (
              <div className="connection-row" key={item.label}>
                <span className={`connection-icon tone-${item.tone}`}><Icon size={15} strokeWidth={1.9} /></span>
                <span className="connection-name">{item.label}</span>
                <span className="connection-value">{item.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}
