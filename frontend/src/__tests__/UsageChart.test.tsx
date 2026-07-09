import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SERIES, UsageChart } from "@/components/account/UsageChart";
import type { LedgerEntryOut } from "@/types/api";

const entry = (
  id: number,
  delta: number,
  reason: LedgerEntryOut["reason"],
  balance_after: number,
  iso: string,
): LedgerEntryOut => ({
  id, delta, reason, reference_type: null, reference_id: null, balance_after, created_at: iso,
});

const LEDGER = [
  entry(2, -5, "generation", 5, "2026-07-03T10:00:00Z"),
  entry(1, 10, "signup_bonus", 10, "2026-07-01T10:00:00Z"),
];

describe("UsageChart (usage & cost line graph)", () => {
  it("uses the CVD-validated dark palette", () => {
    // amber-600 + violet-500 — validated by the dataviz palette script
    expect(SERIES.map((s) => s.color)).toEqual(["#d97706", "#8b5cf6"]);
  });

  it("renders one 2px line per series with a legend", () => {
    render(<UsageChart entries={LEDGER} />);
    expect(screen.getByTestId("line-balance")).toHaveAttribute("stroke-width", "2");
    expect(screen.getByTestId("line-spent")).toHaveAttribute("stroke-width", "2");
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("Spent (cumulative)")).toBeInTheDocument();
  });

  it("labels the chart for screen readers", () => {
    render(<UsageChart entries={LEDGER} />);
    expect(
      screen.getByRole("img", { name: /Credits balance and cumulative spend/ }),
    ).toBeInTheDocument();
  });

  it("shows the empty state below two points", () => {
    render(<UsageChart entries={[LEDGER[1]]} />);
    expect(screen.getByText(/usage graph appears after your first dream/)).toBeInTheDocument();
    render(<UsageChart entries={[]} />);
    expect(screen.getAllByText(/usage graph appears/)).toHaveLength(2);
  });
});
