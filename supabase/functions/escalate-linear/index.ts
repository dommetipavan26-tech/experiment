// Relay / escalate-linear
// Creates a Linear issue for a live Relay incident and writes the identifier
// back to the incident, its timeline and the realtime activity stream.
// The Linear API key is supplied by the operator in Relay settings (browser ->
// this function -> Linear) or from the LINEAR_API_KEY project secret.

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

const base = () => Deno.env.get("SUPABASE_URL") ?? Deno.env.get("RELAY_SUPABASE_URL") ?? "";
const serviceKey = () =>
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("RELAY_SUPABASE_KEY") ?? "";

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${base()}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

const priorityMap: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };

const MUTATION = `mutation CreateRelayIssue($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { identifier url }
  }
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!base() || !serviceKey()) return json({ error: "supabase_env_missing" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const incidentId = String(body.incident_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(incidentId)) return json({ error: "invalid_incident_id" }, 400);

  const apiKey = String(body.api_key ?? Deno.env.get("LINEAR_API_KEY") ?? "").trim();
  if (!apiKey) {
    return json({
      error: "linear_key_required",
      message: "Add your Linear API key in Relay Settings to enable escalation.",
    }, 428);
  }
  const teamId = String(body.team_id ?? Deno.env.get("LINEAR_TEAM_ID") ?? "");
  if (!teamId) return json({ error: "linear_team_missing" }, 500);

  const lookup = await rest(`/rest/v1/incidents?id=eq.${incidentId}&select=*`);
  if (!lookup.ok) return json({ error: "incident_lookup_failed", detail: await lookup.text() }, 502);
  const incidents = await lookup.json();
  const incident = incidents?.[0];
  if (!incident) return json({ error: "incident_not_found" }, 404);
  if (incident.linear_id) {
    return json({ ok: true, already_linked: true, identifier: incident.linear_id, url: incident.linear_url });
  }

  const description = [
    `**Relay incident:** ${incident.code}`,
    `**Severity:** ${incident.severity}  |  **Status:** ${incident.status}`,
    `**District:** ${incident.district}  |  **Location:** ${incident.location || "not specified"}`,
    `**Reported by:** ${incident.reporter}  |  **Owner:** ${incident.assignee}`,
    "",
    incident.summary || "No summary provided.",
    "",
    "---",
    "Escalated from the Relay live operations console.",
  ].join("\n");

  const linearRes = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({
      query: MUTATION,
      variables: {
        input: {
          teamId,
          title: `[${incident.code}] ${incident.title}`.slice(0, 250),
          description,
          priority: priorityMap[incident.severity] ?? 3,
        },
      },
    }),
  });
  const linearJson: any = await linearRes.json().catch(() => ({}));
  if (!linearRes.ok || linearJson?.errors?.length) {
    return json({
      error: "linear_request_failed",
      detail: linearJson?.errors?.[0]?.message ?? `Linear returned ${linearRes.status}`,
    }, 502);
  }
  const issue = linearJson?.data?.issueCreate?.issue;
  if (!linearJson?.data?.issueCreate?.success || !issue) {
    return json({ error: "linear_issue_not_created" }, 502);
  }

  const patch = await rest(`/rest/v1/incidents?id=eq.${incidentId}`, {
    method: "PATCH",
    body: JSON.stringify({ linear_id: issue.identifier, linear_url: issue.url }),
  });
  if (!patch.ok) return json({ error: "incident_update_failed", detail: await patch.text() }, 502);

  await Promise.all([
    rest("/rest/v1/incident_updates", {
      method: "POST",
      body: JSON.stringify({
        incident_id: incidentId,
        body: `Escalated to Linear as ${issue.identifier}.`,
        author: "Relay integration",
        kind: "linear",
      }),
    }),
    rest("/rest/v1/activity", {
      method: "POST",
      body: JSON.stringify({
        source: "linear",
        kind: "escalated",
        message: `${incident.code} escalated to ${issue.identifier}`,
        meta: { incident_id: incidentId, identifier: issue.identifier, url: issue.url },
      }),
    }),
  ]);

  return json({ ok: true, identifier: issue.identifier, url: issue.url });
});
