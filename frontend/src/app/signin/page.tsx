"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { StarField } from "@/components/landing/StarField";

function SignInInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/studio";
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }> | null>(null);

  useEffect(() => {
    getProviders().then((p) => setProviders(p as never));
  }, []);

  return (
    <div className="grain relative flex min-h-dvh items-center justify-center overflow-hidden bg-night px-4">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: "url(/art/background.jpg)" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-night/60 via-night/70 to-night" aria-hidden />
      <StarField count={90} />

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="border-gradient relative z-10 w-full max-w-md rounded-3xl p-8 text-center shadow-glow sm:p-10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/art/logo.jpg"
          alt="Dreamers"
          className="mx-auto h-20 w-20 rounded-full object-cover shadow-glow ring-2 ring-sunset-amber/50"
        />
        <h1 className="mt-5 font-display text-3xl font-semibold">
          Step into the <span className="text-gradient">dream</span>
        </h1>
        <p className="mt-2 text-sm text-star-dim">
          Sign in to start filming. Your first two dreams are free —{" "}
          <span className="text-sunset-gold">10 credits</span> on us.
        </p>

        <div className="mt-8 space-y-3">
          {providers?.google && (
            <button
              onClick={() => signIn("google", { callbackUrl: next })}
              className="focus-sunset flex w-full items-center justify-center gap-3 rounded-2xl bg-star px-5 py-3.5 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a7.2 7.2 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>
          )}
          {providers?.dev && (
            <button
              onClick={() => signIn("dev", { callbackUrl: next })}
              className="focus-sunset w-full rounded-2xl border border-sunset-amber/40 px-5 py-3.5 text-sm font-medium text-sunset-gold transition-colors hover:bg-sunset-amber/10"
            >
              ✦ Dev login (local only)
            </button>
          )}
          {providers && !providers.google && !providers.dev && (
            <p className="text-sm text-bad">
              No sign-in providers configured. Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
              (or AUTH_DEV_LOGIN=1) in .env.local.
            </p>
          )}
          {!providers && <div className="shimmer h-12 rounded-2xl bg-panel" />}
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-star-faint">
          By continuing you agree that generated videos cost 5 credits each and cannot
          be cancelled once confirmed.
        </p>
        <Link href="/" className="focus-sunset mt-4 inline-block text-xs text-star-dim hover:text-star">
          ← Back to the night sky
        </Link>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInInner />
    </Suspense>
  );
}
