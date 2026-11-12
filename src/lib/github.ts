export interface GithubCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export async function fetchCommits(repo: string, signal?: AbortSignal): Promise<GithubCommit[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=6`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => ({
    sha: String(item.sha ?? ""),
    shortSha: String(item.sha ?? "").slice(0, 7),
    message: String(item.commit?.message ?? "Commit").split("\n")[0],
    author: String(item.commit?.author?.name ?? item.author?.login ?? "Unknown"),
    date: String(item.commit?.author?.date ?? new Date().toISOString()),
    url: String(item.html_url ?? `https://github.com/${repo}`),
  }));
}
