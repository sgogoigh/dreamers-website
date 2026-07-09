"use client";

import { motion } from "motion/react";
import Link from "next/link";

export default function CheckoutCancelledPage() {
  return (
    <div className="grain relative flex min-h-dvh items-center justify-center bg-night px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-gradient w-full max-w-md rounded-3xl p-8 text-center sm:p-10"
      >
        <p className="text-5xl">🌘</p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-star">
          Checkout cancelled
        </h1>
        <p className="mt-2 text-sm text-star-dim">
          No charge was made. Your dreams will wait — whenever you're ready.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/credits"
            className="focus-sunset rounded-full bg-sunset px-6 py-3 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
          >
            Try again
          </Link>
          <Link
            href="/studio"
            className="focus-sunset rounded-full border border-line px-6 py-3 text-sm text-star-dim hover:text-star"
          >
            Back to studio
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
