import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Database,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Github,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Triangle,
  UserRound,
  Workflow,
} from "lucide-react";
import { CONFIG, CONSTANTS } from "../lib/config";
import { fetchCommits, type GithubCommit } from "../lib/github";
import { timeAgo } from "../lib/format";
import { useRelay } from "../lib/store";
import { Panel } from "./ui";

const pipeline = [
  {
    icon: Github,
    name: "GitHub",
    role: "Source of truth",
    detail: `${CONFIG.githubRepo} · main`,
    href: CONSTANTS.githubUrl,
    tone: "muted",
  },
  {
    icon: Triangle,
    name: "Vercel",
    role: "Production hosting",
    detail: `${CONSTANTS.vercelProject} · auto-deploy`,
    href: CONFIG.productionUrl,
    tone: "amber",
  },
  {
    icon: Database,
    name: "Supabase",
    role: "Realtime data",
    detail: `${CONSTANTS.projectRef} · ap-south-1`,
    href: "https://supabase.com/dashboard",
    tone: "teal",
  },
  {
    icon: Layers,
    name: "Linear",
    role: "Escalation + tracking",
    detail: `Team ${CONFIG.linearTeamKey} · issues`,
    href: CONSTANTS.linearProjectUrl,
    tone: "sky",
  },
] as const;

export function DeliveryPipeline() {
  return (
    <Panel
      title="Delivery pipeline"
      subtitle="Four connected systems, one live operational loop"
      actions={
        <a className="text-link with-icon" href={CONSTANTS.linearProjectUrl} target="_blank" rel="noreferrer">
          Linear project <ArrowUpRight size={13} strokeWidth={2} />
        </a>
      }
    >
      <div className="pipeline">
        {pipeline.map((step, index) => {
          const Icon = step.icon;
          return (
            <div className="pipeline-step" key={step.name}>
              <a className="pipeline-card" href={step.href} target="_blank" rel="noreferrer">
                <span className={`pipeline-icon tone-${step.tone}`}><Icon size={19} strokeWidth={1.9} /></span>
                <span className="pipeline-label">{step.role}</span>
                <strong>{step.name}</strong>
                <span className="pipeline-detail">{step.detail}</span>
                <ExternalLink size={13} strokeWidth={1.9} className="pipeline-ext" />
              </a>
              {index < pipeline.length - 1 && <span className="pipeline-link"><ArrowUpRight size={13} strokeWidth={2} /></span>}
            </div>
          );
        })}
      </div>
      <div className="pipeline-footer">
        <Workflow size={14} strokeWidth={1.9} />
        <span>
          Vercel deployment events are signed and streamed into the Relay activity feed via the{" "}
          <code>ingest-event</code> Edge Function.
        </span>
      </div>
    </Panel>
  );
}

export function GithubCommitPanel() {
  const [commits, setCommits] = useState<GithubCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommits(CONFIG.githubRepo, signal);
      setCommits(data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Unable to reach GitHub");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <Panel
      title="Recent commits"
      subtitle={`Live from the GitHub API · ${CONFIG.githubRepo}`}
      actions={
        <button className="icon-btn" onClick={() => void load()} aria-label="Refresh commits" title="Refresh commits">
          <RefreshCw size={15} strokeWidth={1.9} className={loading ? "spin" : ""} />
        </button>
      }
    >
      <div className="commit-list">
        {commits.map((commit) => (
          <a className="commit-row" key={commit.sha} href={commit.url} target="_blank" rel="noreferrer">
            <span className="commit-sha">{commit.shortSha}</span>
            <span className="commit-copy">
              <strong>{commit.message}</strong>
              <small>{commit.author} · {timeAgo(commit.date)}</small>
            </span>
            <ExternalLink size={13} strokeWidth={1.9} />
          </a>
        ))}
        {loading && commits.length === 0 && <p className="commit-empty">Fetching commit history…</p>}
        {!loading && error && <p className="commit-empty">GitHub is unavailable right now: {error}</p>}
        {!loading && !error && commits.length === 0 && <p className="commit-empty">No commits found yet.</p>}
      </div>
      <div className="commit-footer">
        <GitBranch size={13} strokeWidth={1.9} />
        <span>Release branch is merged into <code>main</code>; Vercel builds production from it.</span>
      </div>
    </Panel>
  );
}

export function IntegrationPanel() {
  const { connection } = useRelay();
  const rows = [
    { label: "Database", value: `${CONSTANTS.projectRef} · Postgres 17`, detail: "incidents, incident_updates, signals, activity", icon: Database },
    { label: "Realtime", value: "supabase_realtime publication", detail: "postgres_changes + presence channel relay-presence-v1", icon: Workflow },
    { label: "Edge Functions", value: "ingest-event · escalate-linear", detail: "Signature-verified webhooks and Linear issue creation", icon: Server },
    { label: "Build", value: "Vite + React + TypeScript", detail: `Encrypted VITE_* variables · connection ${connection}`, icon: GitBranch },
  ];
  return (
    <Panel title="Integration detail" subtitle="What is running behind this console">
      <div className="integration-rows">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div className="integration-row" key={row.label}>
              <span className="integration-icon"><Icon size={16} strokeWidth={1.9} /></span>
              <div className="integration-copy">
                <span className="integration-label">{row.label}</span>
                <strong>{row.value}</strong>
                <small>{row.detail}</small>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function VerificationPanel() {
  const { connection } = useRelay();
  return (
    <Panel
      title="Verification and tester"
      subtitle="Who checks this release, and what they check"
      actions={
        <a className="text-link with-icon" href={CONSTANTS.linearQaIssueUrl} target="_blank" rel="noreferrer">
          QA sign-off <ArrowUpRight size={13} strokeWidth={2} />
        </a>
      }
    >
      <div className="qa-identities">
        <div className="qa-identity">
          <span className="qa-icon"><FlaskConical size={18} strokeWidth={1.9} /></span>
          <div className="qa-identity-copy">
            <span>Automated tester</span>
            <strong>{CONSTANTS.qaSuite}</strong>
            <small>27 checks run on every push and pull request before deployment.</small>
          </div>
        </div>
        <div className="qa-identity">
          <span className="qa-icon"><UserRound size={18} strokeWidth={1.9} /></span>
          <div className="qa-identity-copy">
            <span>Human tester and reviewer</span>
            <strong>{CONFIG.qaReviewer}</strong>
            <small>Only human member of Linear team {CONFIG.linearTeamKey}; owns the QA sign-off issue.</small>
          </div>
        </div>
      </div>
      <div className="qa-checklist">
        {CONSTANTS.qaChecks.map((item) => (
          <div className="qa-check" key={item}>
            <Check size={13} strokeWidth={2.2} />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="qa-footer">
        <ShieldCheck size={14} strokeWidth={1.9} />
        <span>
          Release {CONSTANTS.version} · guardrails migration 0002 · realtime link {connection}
        </span>
      </div>
    </Panel>
  );
}
