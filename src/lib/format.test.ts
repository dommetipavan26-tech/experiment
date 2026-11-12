import { describe, expect, it } from "vitest";
import {
  durationLabel,
  initials,
  matchQuery,
  medianFirstResponseMinutes,
  nextIncidentCode,
  pulseSeries,
  severityRank,
  statusLabel,
  timeAgo,
} from "./format";
import type { Incident, Signal } from "./types";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe("time formatting", () => {
  it("renders relative time in minutes, hours and days", () => {
    expect(timeAgo(ago(0))).toBe("just now");
    expect(timeAgo(ago(5))).toBe("5m ago");
    expect(timeAgo(ago(130))).toBe("2h ago");
    expect(timeAgo(ago(1500))).toBe("1d ago");
  });

  it("renders elapsed duration", () => {
    expect(durationLabel(ago(30))).toBe("30m");
    expect(durationLabel(ago(95))).toBe("1h 35m");
    expect(durationLabel(ago(1500))).toBe("1d 1h");
  });
});

describe("identity and codes", () => {
  it("builds two-letter initials", () => {
    expect(initials("K. Rao")).toBe("KR");
    expect(initials("Control desk")).toBe("CD");
    expect(initials("S. Devi / Water")).toBe("SD");
  });

  it("increments the highest incident code", () => {
    const incidents = [
      { code: "INC-2041" },
      { code: "INC-2039" },
    ] as Incident[];
    expect(nextIncidentCode(incidents)).toBe("INC-2042");
    expect(nextIncidentCode([])).toBe("INC-2041");
  });
});

describe("derived metrics", () => {
  it("buckets signals into the 12-hour pulse series with confirmation weight", () => {
    const now = Date.now();
    const signals = [
      { created_at: new Date(now - 30 * 60_000).toISOString(), confirmations: 8 },
      { created_at: new Date(now - 90 * 60_000).toISOString(), confirmations: 0 },
      { created_at: new Date(now - 20 * 3600_000).toISOString(), confirmations: 100 },
    ] as Signal[];
    const series = pulseSeries(signals, 12, now);
    expect(series).toHaveLength(12);
    expect(series.reduce((a, b) => a + b, 0)).toBe(3);
    expect(series[11]).toBe(2);
    expect(series[10]).toBe(1);
  });

  it("computes the median first-response time", () => {
    const incidents = [{ id: "a", created_at: ago(20) }] as Incident[];
    const updates = [{ incident_id: "a", created_at: ago(10) }];
    expect(medianFirstResponseMinutes(incidents, updates)).toBe(10);
    expect(medianFirstResponseMinutes(incidents, [])).toBeNull();
  });
});

describe("search and labels", () => {
  it("matches queries case-insensitively across fields", () => {
    expect(matchQuery(["Rayapudi", "Guntur"], "raya")).toBe(true);
    expect(matchQuery(["Rayapudi", "Guntur"], "vijayawada")).toBe(false);
    expect(matchQuery(["Rayapudi"], "  ")).toBe(true);
  });

  it("uses stable operator vocabulary", () => {
    expect(statusLabel.responding).toBe("Responding");
    expect(statusLabel.resolved).toBe("Resolved");
    expect(severityRank.critical).toBeLessThan(severityRank.low);
  });
});
