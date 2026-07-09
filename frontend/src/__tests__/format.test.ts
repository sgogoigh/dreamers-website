import { describe, expect, it } from "vitest";

import {
  dateGroup,
  elapsedSince,
  formatCredits,
  formatDuration,
  formatUsd,
  groupByDate,
  initials,
} from "@/lib/format";

describe("initials (avatar icon)", () => {
  it("uses first+last name initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Sunny Kumar Gogoi")).toBe("SG");
  });
  it("uses single-name initial", () => {
    expect(initials("Plato")).toBe("P");
  });
  it("falls back to email, then ?", () => {
    expect(initials("", "zoe@example.com")).toBe("Z");
    expect(initials(null, null)).toBe("?");
    expect(initials("   ", "")).toBe("?");
  });
});

describe("formatting", () => {
  it("pluralizes credits", () => {
    expect(formatCredits(1)).toBe("1 credit");
    expect(formatCredits(5)).toBe("5 credits");
    expect(formatCredits(0)).toBe("0 credits");
  });
  it("formats usd", () => {
    expect(formatUsd(25)).toBe("$25");
    expect(formatUsd(1000)).toBe("$1,000");
  });
  it("formats durations", () => {
    expect(formatDuration(58)).toBe("58s");
    expect(formatDuration(75)).toBe("1m 15s");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("date grouping (sidebar history)", () => {
  // Local-time ISO strings (no Z): grouping is by the USER's local day.
  const now = new Date("2026-07-08T15:00:00");
  it("labels today / yesterday / this week / earlier", () => {
    expect(dateGroup("2026-07-08T09:00:00", now)).toBe("Today");
    expect(dateGroup("2026-07-07T22:00:00", now)).toBe("Yesterday");
    expect(dateGroup("2026-07-03T10:00:00", now)).toBe("This week");
    expect(dateGroup("2026-06-20T10:00:00", now)).toBe("Earlier");
  });
  it("groups in fixed order, omitting empty buckets", () => {
    const items = [
      { created_at: "2026-06-20T10:00:00", id: "old" },
      { created_at: "2026-07-08T09:00:00", id: "new" },
    ];
    const groups = groupByDate(items, now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Earlier"]);
    expect(groups[0].items[0].id).toBe("new");
  });
});

describe("elapsedSince", () => {
  it("formats m:ss from a start time", () => {
    const now = new Date("2026-07-08T15:02:05Z");
    expect(elapsedSince("2026-07-08T15:00:00Z", now)).toBe("2:05");
    expect(elapsedSince(null, now)).toBe("0:00");
  });
});
