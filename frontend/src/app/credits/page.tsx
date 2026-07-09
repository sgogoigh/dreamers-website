"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { AmountStepper } from "@/components/payments/AmountStepper";
import { PackagePicker } from "@/components/payments/PackagePicker";
import { useApiToken, useBalance } from "@/hooks/useApi";
import { ApiError, createCheckout } from "@/lib/api";

export default function CreditsPage() {
  const token = useApiToken();
  const { data: balance } = useBalance();
  const [selected, setSelected] = useState<number | null>(25);
  const [custom, setCustom] = useState(15);
  const [useCustom, setUseCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = useCustom ? custom : (selected ?? 0);

  const checkout = async () => {
    if (!token || amount < 5) return;
    setBusy(true);
    setError(null);
    try {
      const { checkout_url } = await createCheckout(token, amount);
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed — try again.");
      setBusy(false);
    }
  };

  return (
    <div className="grain relative min-h-dvh bg-night">
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-80 bg-[radial-gradient(ellipse_70%_100%_at_50%_100%,rgba(245,158,11,0.14),transparent)]" aria-hidden />
      <div className="relative mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/studio" className="focus-sunset text-sm text-star-dim hover:text-star">
          ← Back to studio
        </Link>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
          <h1 className="font-display text-4xl font-semibold">
            Refill your <span className="text-gradient">dream fuel</span>
          </h1>
          <p className="mt-2 text-sm text-star-dim">
            $1 = 1 credit · one video = 5 credits · minimum $5, in steps of $5
          </p>
          {balance && (
            <p className="mt-3 inline-block rounded-full border border-line px-4 py-1.5 text-xs text-sunset-gold">
              Current balance: {balance.balance} credits
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border-gradient mt-8 space-y-6 rounded-3xl p-6 sm:p-8"
        >
          <PackagePicker
            selected={useCustom ? null : selected}
            onSelect={(usd) => {
              setSelected(usd);
              setUseCustom(false);
            }}
          />

          <div className="flex items-center gap-3 text-xs text-star-faint">
            <span className="h-px flex-1 bg-line/60" />
            or pick your own
            <span className="h-px flex-1 bg-line/60" />
          </div>

          <div
            className={`rounded-2xl border p-5 transition-colors ${
              useCustom ? "border-sunset-amber/60 bg-sunset-amber/5" : "border-line/60"
            }`}
            onClick={() => setUseCustom(true)}
            role="group"
            aria-label="Custom amount"
          >
            <AmountStepper
              value={custom}
              onChange={(v) => {
                setCustom(v);
                setUseCustom(true);
              }}
            />
          </div>

          {error && (
            <p role="alert" className="text-center text-sm text-bad">{error}</p>
          )}

          <button
            onClick={checkout}
            disabled={busy || !token || amount < 5}
            className="focus-sunset w-full rounded-2xl bg-sunset py-4 text-base font-semibold text-night shadow-glow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? "Opening checkout…" : `Buy ${amount} credits for $${amount}`}
          </button>
          <p className="text-center text-[11px] text-star-faint">
            Secure payment via Stripe. Credits appear moments after payment.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
