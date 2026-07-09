"use client";

import Link from "next/link";

/** Replaces the composer when balance < cost (business rule B3). */
export function InsufficientCredits({
  balance,
  cost = 5,
  minPurchase = 5,
}: {
  balance: number;
  cost?: number;
  minPurchase?: number;
}) {
  return (
    <div className="rounded-2xl border border-sunset-amber/40 bg-gradient-to-r from-sunset-violet/15 via-sunset-magenta/10 to-sunset-amber/15 p-5 text-center">
      <p className="font-display text-lg font-semibold text-star">
        You need {cost} credits to dream
      </p>
      <p className="mt-1 text-sm text-star-dim">
        You have {balance} credit{balance === 1 ? "" : "s"} left. Top up from ${minPurchase} —
        $1 = 1 credit.
      </p>
      <Link
        href="/credits"
        className="focus-sunset mt-4 inline-block rounded-full bg-sunset px-6 py-2.5 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
      >
        Buy credits →
      </Link>
    </div>
  );
}
