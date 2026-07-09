"use client";

/** Post-checkout landing. The webhook is the source of truth — this page just
 * polls the balance until it rises (30s cap) and celebrates. */
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useBalance } from "@/hooks/useApi";

const POLL_MS = 2000;
const MAX_WAIT_MS = 30_000;

export default function CheckoutSuccessPage() {
  const { data: balance, refetch } = useBalance();
  const qc = useQueryClient();
  const initialRef = useRef<number | null>(null);
  const [state, setState] = useState<"waiting" | "credited" | "slow">("waiting");

  useEffect(() => {
    if (balance && initialRef.current === null) initialRef.current = balance.balance;
    if (
      balance &&
      initialRef.current !== null &&
      balance.balance > initialRef.current &&
      state === "waiting"
    ) {
      setState("credited");
      qc.invalidateQueries({ queryKey: ["ledger"] });
    }
  }, [balance, state, qc]);

  useEffect(() => {
    if (state !== "waiting") return;
    const poll = setInterval(() => refetch(), POLL_MS);
    const cap = setTimeout(() => setState((s) => (s === "waiting" ? "slow" : s)), MAX_WAIT_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(cap);
    };
  }, [state, refetch]);

  return (
    <div className="grain relative flex min-h-dvh items-center justify-center bg-night px-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_45%,rgba(217,70,160,0.14),transparent)]" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="border-gradient relative w-full max-w-md rounded-3xl p-8 text-center shadow-glow sm:p-10"
      >
        {state === "credited" ? (
          <>
            <motion.p
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="text-6xl"
            >
              🌌
            </motion.p>
            <h1 className="mt-4 font-display text-3xl font-semibold">
              Credits <span className="text-gradient">landed</span>
            </h1>
            <p className="mt-2 text-sm text-star-dim">
              Your balance is now{" "}
              <span className="font-semibold text-sunset-gold">{balance?.balance} credits</span>.
              Time to dream.
            </p>
          </>
        ) : state === "slow" ? (
          <>
            <p className="text-5xl">🌙</p>
            <h1 className="mt-4 font-display text-2xl font-semibold text-star">
              Payment received — credits arriving
            </h1>
            <p className="mt-2 text-sm text-star-dim">
              Stripe confirmed your payment; the credits will appear on your balance
              shortly. You can head back — they'll be there.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-line border-t-sunset-amber" />
            <h1 className="mt-5 font-display text-2xl font-semibold text-star">
              Confirming your payment…
            </h1>
            <p className="mt-2 text-sm text-star-dim">This usually takes a few seconds.</p>
          </>
        )}
        <Link
          href="/studio"
          className="focus-sunset mt-8 inline-block rounded-full bg-sunset px-7 py-3 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
        >
          Back to the studio →
        </Link>
      </motion.div>
    </div>
  );
}
