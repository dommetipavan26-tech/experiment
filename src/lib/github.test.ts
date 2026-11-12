import { describe, expect, it, vi } from "vitest";
import { fetchCommits } from "./github";

const payload = [
  {
    sha: "abcdef1234567890",
    html_url: "https://github.com/o/r/commit/abcdef1",
    commit: {
      message: "First line\n\nDetails",
      author: { name: "Arena Agent", date: "2026-11-12T18:00:00Z" },
    },
  },
];

describe("GitHub commit mapping", () => {
  it("normalises the API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    const commits = await fetchCommits("o/r");
    expect(commits).toHaveLength(1);
    expect(commits[0].shortSha).toBe("abcdef1");
    expect(commits[0].message).toBe("First line");
    expect(commits[0].author).toBe("Arena Agent");
    expect(fetchMock.mock.calls[0][0]).toContain("repos/o/r/commits");
  });

  it("surfaces HTTP failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(fetchCommits("o/r")).rejects.toThrow("403");
  });
});
