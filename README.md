# Relay — Live Civic Operations

Relay is a real-time operations console for time-critical, real-world problems: power failures, water main breaches, traffic signal outages, waterlogging, network cuts and public safety reports. It gives a duty team one shared, instantly-synchronised view of what is happening in the field, what is being done about it, and who is on console.

The board is seeded for the **Amaravati Capital Region** (Amaravati, Guntur, NTR) so it opens with a believable, in-progress situation rather than an empty screen.

Built against four connected systems: **GitHub** (source + CI), **Supabase** (Postgres, Realtime, Edge Functions), **Vercel** (production hosting + deployment webhook) and **Linear** (rollout tracking + incident escalation).

---

## What actually works

| Capability | Behaviour |
| --- | --- |
| Live incident command | Create, move (drag between columns), re-severity, reassign and resolve incidents. Every change propagates to all connected browsers through `postgres_changes` on `public.incidents`. |
| Field signal intake | Submit citizen/field reports, confirm them, verify/action/dismiss, and link them to an incident. New reports appear instantly on every console. |
| Live responder presence | A Supabase Realtime presence channel (`relay-presence-v1`) tracks who has the console open, with name and role. |
| Streaming activity timeline | Database triggers log incident creation, status changes and new signals; Vercel deployment webhooks stream in through the `ingest-event` Edge Function. All appear live, filterable by source. |
| Linear escalation | One click creates a Linear issue from an incident (title, severity priority, district, location, summary), then writes the identifier back into the incident, its timeline and the activity stream. |
| Engineering view | A delivery pipeline, live commit list from the GitHub API, and a breakdown of the integration. |
| Offline demo mode | If Supabase env vars are absent, the app runs fully functional local state with cross-tab sync via `BroadcastChannel` and `localStorage`. Useful for reviewing the UI without credentials. |

Keyboard shortcuts: `N` opens a new incident, `S` submits a field signal, `/` focuses search, `Esc` closes the drawer or dialog.

---

## Architecture

```
Browser (React + TypeScript + Vite)
   |
   |  @supabase/supabase-js
   |  - REST reads / writes
   |  - postgres_changes (incidents, incident_updates, signals, activity)
   |  - presence (relay-presence-v1)
   v
Supabase  txbgovhxqxvlioszevbe (ap-south-1)
   |- public.incidents           RLS + realtime + activity triggers
   |- public.incident_updates    RLS + realtime
   |- public.signals             RLS + realtime + activity trigger
   |- public.activity            RLS + realtime
   |- ingest-event               verifies Vercel/GitHub webhook signatures, inserts activity
   `- escalate-linear            Linear GraphQL issueCreate + writes identifier back
          ^                                  ^
          | Vercel webhook                    | Linear GraphQL API
   Vercel relay-live-ops               Linear team PAV
          ^                                  ^
          | git push to main                 | rollout issues
   GitHub dommetipavan26-tech/experiment    Linear project "Relay — Live Civic Operations"
```

### Database

`supabase/migrations/0001_relay_init.sql` is the source of truth. It creates the four tables, indexes, permissive demo RLS policies, adds the tables to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, installs `updated_at` and activity-logging triggers, and seeds six incidents, ten timeline updates, nine field signals and baseline activity.

Re-running the migration is safe: tables use `IF NOT EXISTS`, policies are dropped and recreated, and seed inserts are guarded by `WHERE NOT EXISTS`.

### Edge Functions

- **`ingest-event`** — accepts Vercel deployment webhooks (`x-vercel-signature`, HMAC SHA-1/SHA-256), GitHub webhooks (`x-hub-signature-256`, HMAC SHA-256) and token-authenticated manual events. Verifies the signature, normalises the payload and inserts a row into `public.activity`. `GET` returns a health response.
- **`escalate-linear`** — reads the incident, calls Linear's `issueCreate` mutation with the incident metadata, then patches `linear_id` / `linear_url` and inserts a timeline update plus an activity event. The operator's personal API key is supplied from Relay Settings (stored only in that browser) or from a `LINEAR_API_KEY` project secret.

Runtime secrets configured on the Supabase project: `INGEST_TOKEN`, `VERCEL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, `LINEAR_TEAM_ID`, `LINEAR_TEAM_KEY`, `RELAY_SUPABASE_URL`, `RELAY_SUPABASE_KEY`. No secret is committed to this repository.

### Vercel

Project `relay-live-ops` is linked to `dommetipavan26-tech/experiment`, production branch `main`, framework Vite, build `npm run build`, output `dist`. Encrypted `VITE_*` environment variables are configured for production, preview and development. A project-scoped webhook forwards `deployment.created`, `deployment.succeeded`, `deployment.error` and `deployment.canceled` into `ingest-event`.

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm run dev                  # http://localhost:5173
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server, bound to `0.0.0.0` |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Typecheck + production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |

Environment variables (all optional except the first two for live mode):

| Variable | Example |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` (publishable/anon key is browser-safe) |
| `VITE_GITHUB_REPO` | `dommetipavan26-tech/experiment` |
| `VITE_LINEAR_TEAM_KEY` | `PAV` |
| `VITE_PRODUCTION_URL` | `https://relay-live-ops.vercel.app` |

`.env.local` is gitignored. The service-role key is never used in the browser or committed.

---

## Verifying realtime behaviour

1. Open the production URL in two browser windows (or two devices).
2. Drag an incident to another status column, or change severity in the detail drawer. Both boards update within a second.
3. Submit a field signal in one window: it appears in the intake queue and the activity stream of the other, and the "On console" count reflects both sessions.
4. Push a commit / trigger a Vercel deployment: the signed webhook appears in the Activity view with source `Vercel`.
5. Open Settings, add a Linear personal API key, then use **Escalate to Linear** on an incident. The Linear identifier appears on the card, in the drawer and in the activity stream.

Verification performed: both migrations applied (four realtime tables, guardrails and `relay_qa_snapshot`), `ingest-event` returned `200` and inserted a row, `escalate-linear` returned the expected `428 linear_key_required` without a key, the atomic `relay_confirm_signal` helper was exercised, `npm test` (27 checks), `npm run typecheck` and `npm run build` all passed in CI.

---

## Security note

RLS policies intentionally allow anonymous reads and writes so that public field reporting works without sign-in. Release 1.1 adds defence in depth without hurting the demo: length/range constraints on every client-writable column, a `relay_guard_signal_insert` trigger that normalises text and caps intake at 60 reports per minute, and an atomic `relay_confirm_signal` RPC that prevents lost confirmation updates.

Before a real public launch, still enable Supabase Auth and scope incident mutations to authenticated responders. Anonymous sign-ins are not enabled on this project and there is no SMTP provider configured, so a full email sign-in flow is deliberately deferred rather than faked. This follow-up remains tracked as `PAV-10` in Linear.

---

## Interface notes

Dark operations-console visual system: deep slate surfaces, hairline borders, teal / amber / coral / sky status accents, monospace identifiers and timestamps. All iconography is inline SVG (`lucide-react`). No purple or violet gradients, no emoji. Layout is responsive from wide command displays down to a single-column mobile board, with a slide-in navigation rail, a detail drawer and keyboard shortcuts.

---

## Release 1.1 updates

| Area | Change |
| --- | --- |
| Automated QA | 27 Vitest checks across seven test files covering formatting/metrics, seed integrity, demo store actions, component rendering, the overview view and GitHub commit mapping. `npm test` runs in CI before the build. |
| Named tester | **Automated tester:** the Vitest suite in GitHub Actions CI. **Human tester and reviewer:** Pavan Dommeti, the only human member of Linear team `PAV`, tracked by `PAV-11` (`qa` label). Both are shown in the Engineering → Verification and tester panel. |
| Realtime resilience | A `postgres_changes` reconnect now re-reads all four tables so events missed while the socket was down are recovered. A live/demo/linking chip is visible in the topbar. |
| Concurrency | Simultaneous incident creation retries on a `23505` unique-code collision; signal confirmations use the atomic `relay_confirm_signal(uuid)` function instead of a read-modify-write. |
| Linear readiness | `escalate-linear` now supports `action: "verify"`, which validates a Linear API key against the `viewer` query without creating an issue. Settings has a **Test connection** button and a CONFIGURED / NOT SET indicator. |
| Database guardrails | `supabase/migrations/0002_relay_guardrails.sql`: validation constraints, intake rate limiting, atomic confirmations, and the `relay_qa_snapshot` view. |
| Presentation | Version `1.1.0`, a `QA tester` operator role, connection chip, key-verification UI and the verification panel. Palette remains teal / amber / coral / sky; no purple gradients, no emojis. |

### Why a Linear API key is still needed

Linear escalation calls Linear's GraphQL API at runtime. The Linear connector in this workspace exposes issue/project management but does not expose a personal API key or OAuth token, so no server-side key can be provisioned automatically. The escalation function already reads a `LINEAR_API_KEY` project secret if an admin sets one; otherwise the operator pastes a personal key in Settings (stored only in that browser). **Test connection** makes that setup verifiable without creating a throwaway issue.

Run locally with `npm test`, or open the Engineering view in production to see exactly who tested what.
