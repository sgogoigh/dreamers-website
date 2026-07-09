import { describe, expect, it } from "vitest";

import { buildUsageSeries, linePath, makeScales, yTicks } from "@/lib/chart";
import type { LedgerEntryOut } from "@/types/api";

const entry = (
  id: number,
  delta: number,
  reason: LedgerEntryOut["reason"],
  balance_after: number,
  iso: string,
): LedgerEntryOut => ({
  id,
  delta,
  reason,
  reference_type: null,
  reference_id: null,
  balance_after,
  created_at: iso,
});

// API returns newest-first — fixture mirrors that on purpose.
const LEDGER: LedgerEntryOut[] = [
  entry(4, 25, "purchase", 25, "2026-07-04T10:00:00Z"),
  entry(3, 5, "generation_refund", 0 + 5, "2026-07-03T10:00:01Z"),
  entry(2, -5, "generation", 0, "2026-07-03T10:00:00Z"),
  entry(1, -5, "generation", 5, "2026-07-02T10:00:00Z"),
  entry(0, 10, "signup_bonus", 10, "2026-07-01T10:00:00Z"),
];

describe("buildUsageSeries", () => {
  it("orders points chronologically and tracks balance_after", () => {
    const s = buildUsageSeries(LEDGER);
    expect(s.points).toHaveLength(5);
    expect(s.points[0].balance).toBe(10); // signup first
    expect(s.points.at(-1)!.balance).toBe(25); // purchase last
    expect(s.tMin).toBeLessThan(s.tMax);
  });

  it("accumulates NET spend — refunds cancel their charge", () => {
    const s = buildUsageSeries(LEDGER);
    // charge 5 → spent 5; charge 5 → 10; refund 5 → back to 5; purchase → unchanged
    expect(s.points.map((p) => p.spent)).toEqual([0, 5, 10, 5, 5]);
    expect(s.totalSpent).toBe(5);
  });

  it("totals purchases separately", () => {
    expect(buildUsageSeries(LEDGER).totalPurchased).toBe(25);
  });

  it("handles an empty ledger", () => {
    const s = buildUsageSeries([]);
    expect(s.points).toEqual([]);
    expect(s.totalSpent).toBe(0);
  });
});

describe("scales & paths", () => {
  it("yTicks produce a zero-based nice axis", () => {
    expect(yTicks(23)[0]).toBe(0);
    expect(yTicks(23).at(-1)!).toBeGreaterThanOrEqual(23);
    expect(yTicks(23)).toHaveLength(5);
  });

  it("linePath emits one segment per point", () => {
    const s = buildUsageSeries(LEDGER);
    const { x, y } = makeScales(s, 640, 260, { l: 40, r: 100, t: 16, b: 30 });
    const d = linePath(s.points, "balance", x, y);
    expect(d.startsWith("M")).toBe(true);
    expect(d.split("L")).toHaveLength(5); // M + 4×L
  });

  it("scales map domain edges onto the padded plot area", () => {
    const s = buildUsageSeries(LEDGER);
    const pad = { l: 40, r: 100, t: 16, b: 30 };
    const { x, y } = makeScales(s, 640, 260, pad);
    expect(x(s.tMin)).toBe(pad.l);
    expect(x(s.tMax)).toBe(640 - pad.r);
    expect(y(0)).toBe(260 - pad.b);
  });

  it("empty series yields an empty path", () => {
    const s = buildUsageSeries([]);
    const { x, y } = makeScales(s, 640, 260, { l: 40, r: 100, t: 16, b: 30 });
    expect(linePath(s.points, "spent", x, y)).toBe("");
  });
});
