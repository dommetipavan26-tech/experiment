// Relay / ingest-event
// Receives Vercel deployment webhooks, GitHub webhooks and manual ops events,
// verifies the signature, and writes them into the realtime activity stream.
// Zero external imports: it talks to Supabase over REST so deployment is instant.

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-vercel-signature, x-github-event, x-hub-signature-256",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

const encoder = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

async function hmacHex(secret: string, payload: string, hash: "SHA-1" | "SHA-256") {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Record = {
  source: string;
  kind: string;
  message: string;
  meta: Record<string, unknown>;
};

function vercelRecord(payload: any): Record | null {
  const type = String(payload?.type ?? "");
  if (!type) return null;
  const deployment = payload?.payload?.deployment ?? {};
  const project = payload?.payload?.project ?? {};
  const projectName = project?.name ?? deployment?.name ?? "Vercel project";
  const host = deployment?.url ?? "";
  const state = type.replace("deployment.", "").replace("project.", "project ");
  const label: Record<string, string> = {
    "deployment.created": "Deployment queued",
    "deployment.succeeded": "Deployment succeeded",
    "deployment.ready": "Deployment ready",
    "deployment.error": "Deployment failed",
    "deployment.failed": "Deployment failed",
    "deployment.canceled": "Deployment canceled",
    "deployment.promoted": "Deployment promoted to production",
  };
  return {
    source: "vercel",
    kind: type,
    message: `${label[type] ?? `Vercel ${state}`} · ${projectName}${host ? ` · ${host}` : ""}`,
    meta: {
      deployment_id: deployment?.id ?? null,
      project: projectName,
      url: host ? `https://${host}` : null,
      target: deployment?.target ?? null,
      state,
    },
  };
}

function githubRecord(payload: any, event: string): Record | null {
  const repo = payload?.repository?.full_name ?? "repository";
  if (event === "push") {
    const count = Array.isArray(payload?.commits) ? payload.commits.length : 0;
    const head = payload?.head_commit?.message?.split("\n")[0] ?? "New commits";
    const branch = String(payload?.ref ?? "").replace("refs/heads/", "");
    return {
      source: "github",
      kind: "commit",
      message: `${count || 1} commit${count === 1 ? "" : "s"} pushed to ${repo} · ${head}`,
      meta: { repo, branch, commits: count, sha: payload?.after ?? null },
    };
  }
  if (event === "pull_request") {
    const pr = payload?.pull_request ?? {};
    return {
      source: "github",
      kind: "pull_request",
      message: `Pull request ${payload?.action ?? "updated"}: #${pr?.number ?? ""} ${pr?.title ?? ""} · ${repo}`,
      meta: { repo, action: payload?.action ?? null, number: pr?.number ?? null, url: pr?.html_url ?? null },
    };
  }
  if (event === "workflow_run" || event === "check_run" || event === "deployment_status") {
    const run = payload?.workflow_run ?? payload?.check_run ?? payload?.deployment_status ?? {};
    return {
      source: "github",
      kind: event,
      message: `${event.replace(/_/g, " ")} ${run?.conclusion ?? run?.state ?? payload?.action ?? ""} · ${repo}`,
      meta: { repo, status: run?.conclusion ?? run?.state ?? null, url: run?.html_url ?? null },
    };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const raw = await req.text();
  const token = url.searchParams.get("token");
  const ingestToken = Deno.env.get("INGEST_TOKEN") ?? "";
  const vercelSecret = Deno.env.get("VERCEL_WEBHOOK_SECRET") ?? "";
  const githubSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET") ?? "";
  const vercelSig = req.headers.get("x-vercel-signature") ?? "";
  const githubSig = (req.headers.get("x-hub-signature-256") ?? "").replace(/^sha256=/, "");

  if (req.method === "GET") {
    return json({ ok: true, service: "relay-ingest", realtime: "activity" });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let authorized = !!(token && ingestToken && safeEqual(token, ingestToken));
  if (!authorized && vercelSig && vercelSecret) {
    authorized = safeEqual(vercelSig, await hmacHex(vercelSecret, raw, "SHA-1")) ||
      safeEqual(vercelSig, await hmacHex(vercelSecret, raw, "SHA-256"));
  }
  if (!authorized && githubSig && githubSecret) {
    authorized = safeEqual(githubSig, await hmacHex(githubSecret, raw, "SHA-256"));
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  let payload: any = {};
  try { payload = JSON.parse(raw || "{}"); } catch { return json({ error: "invalid_json" }, 400); }

  const githubEvent = req.headers.get("x-github-event") ?? "";
  let record: Record | null = null;
  if (githubEvent) record = githubRecord(payload, githubEvent);
  else if (payload?.type && payload?.payload) record = vercelRecord(payload);
  else if (typeof payload?.message === "string") {
    record = {
      source: payload.source ?? "system",
      kind: payload.kind ?? "event",
      message: payload.message.slice(0, 300),
      meta: payload.meta ?? {},
    };
  }
  if (!record) return json({ ignored: true, reason: "unrecognised_payload" });

  const base = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("RELAY_SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("RELAY_SUPABASE_KEY") ?? "";
  if (!base || !key) return json({ error: "supabase_env_missing" }, 500);

  const res = await fetch(`${base}/rest/v1/activity`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      source: record.source,
      kind: record.kind,
      message: record.message,
      meta: record.meta,
    }),
  });
  if (!res.ok) return json({ error: "activity_insert_failed", detail: await res.text() }, 502);
  return json({ ok: true, source: record.source, kind: record.kind });
});
