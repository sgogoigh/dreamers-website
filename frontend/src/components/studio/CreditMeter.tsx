"use client";

import Link from "next/link";

import type { BalanceOut } from "@/types/api";

/** Balance card with a videos-remaining ring. Low state (< 1 video) switches
 * to a warm warning treatment with a Buy CTA. */
export function CreditMeter({ balance }: { balance?: BalanceOut }) {
  if (!balance) {
    return (
      <div data-testid="credit-meter-loading" className="shimmer h-28 rounded-2xl border border-line/60 bg-panel" />
    );
  }
  const low = balance.balance < balance.credits_per_video;
  const ringPct = Math.min(
    100,
    Math.round(((balance.balance % balance.credits_per_video === 0 && balance.balance > 0
      ? balance.credits_per_video
      : balance.balance % balance.credits_per_video) /
      balance.credits_per_video) * 100),
  );

  return (
    <div
      className={`rounded-2xl border p-4 ${
        low
          ? "border-sunset-amber/50 bg-gradient-to-br from-sunset-amber/10 to-sunset-magenta/10"
          : "border-line/60 bg-panel"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-sunset-amber) ${ringPct}%, var(--color-line) 0)`,
          }}
          aria-hidden
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-panel font-display text-lg font-bold text-sunset-gold">
            {balance.balance}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-star">
            {balance.balance} credit{balance.balance === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-star-dim">
            {balance.videos_remaining} video{balance.videos_remaining === 1 ? "" : "s"} left ·{" "}
            {balance.credits_per_video} cr / video
          </p>
          {balance.held > 0 && (
            <p className="mt-0.5 text-[11px] text-sunset-gold">
              {balance.held} held for the current dream
            </p>
          )}
        </div>
      </div>
      {low && (
        <p className="mt-3 text-xs text-sunset-gold">
          You need {balance.credits_per_video} credits to dream.
        </p>
      )}
      <Link
        href="/credits"
        className={`focus-sunset mt-3 block rounded-xl py-2 text-center text-xs font-semibold transition-transform hover:-translate-y-0.5 ${
          low ? "bg-sunset text-night" : "border border-line text-star-dim hover:text-star"
        }`}
      >
        Buy credits
      </Link>
    </div>
  );
}
