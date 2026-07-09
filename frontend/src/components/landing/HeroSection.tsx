"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { useTypingLoop } from "@/hooks/useTypingLoop";
import { StarField } from "./StarField";

const SAMPLE_PROMPTS = [
  "a lighthouse keeper who befriends a storm…",
  "the last librarian of a drowned city…",
  "two rival street magicians fall in love mid-duel…",
  "a paper boat sailing a thunderstorm of fireflies…",
  "an astronaut who plants a garden on a comet…",
];

export function HeroSection({ goToCatalogue }: { goToCatalogue: () => void }) {
  const typed = useTypingLoop(SAMPLE_PROMPTS);

  return (
    <div className="grain relative flex h-full w-full items-center justify-center">
      {/* reference night-sky art + sunset wash */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/art/background.jpg)" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/40 to-night" aria-hidden />
      <div
        className="absolute -bottom-40 left-1/2 h-96 w-[140%] -translate-x-1/2 rounded-[100%] bg-gradient-to-t from-sunset-amber/25 via-sunset-magenta/15 to-transparent blur-3xl animate-drift"
        aria-hidden
      />
      <StarField />

      {/* floating aurora orbs — small perpetual motion */}
      <div className="absolute left-[12%] top-[22%] h-40 w-40 rounded-full bg-sunset-violet/25 blur-3xl animate-float" aria-hidden />
      <div className="absolute right-[14%] top-[30%] h-52 w-52 rounded-full bg-sunset-magenta/20 blur-3xl animate-float-slow" aria-hidden />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="mb-5 rounded-full border border-sunset-amber/30 bg-plum/50 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-sunset-gold backdrop-blur"
        >
          AI cinema · one-minute films
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/art/banner.jpg"
            alt="Dreamers"
            className="mx-auto w-full max-w-2xl rounded-2xl object-cover shadow-glow [mask-image:radial-gradient(ellipse_85%_75%_at_center,black_55%,transparent_100%)]"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl"
        >
          <span className="text-gradient">Dream it. Watch it.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mt-3 max-w-xl text-base text-star-dim sm:text-lg"
        >
          Type a single line. Our studio writes the film, shoots it with Veo, and
          hands you a one-minute cinematic video. Your first two dreams are free.
        </motion.p>

        {/* live typing loop in a faux prompt bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.7 }}
          className="border-gradient mt-7 flex w-full max-w-xl items-center gap-3 rounded-2xl px-5 py-3.5 text-left shadow-glow-sm"
          aria-hidden
        >
          <span className="text-sunset-gold">✦</span>
          <span className="min-h-6 flex-1 truncate text-sm text-star-dim sm:text-base">
            {typed}
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-twinkle bg-sunset-gold align-middle" />
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href="/studio"
            className="focus-sunset animate-pulse-glow rounded-full bg-sunset px-8 py-3.5 text-base font-semibold text-night transition-transform hover:-translate-y-0.5 hover:scale-[1.02]"
          >
            Generate your dream →
          </Link>
          <button
            onClick={goToCatalogue}
            className="focus-sunset rounded-full border border-line px-6 py-3.5 text-sm text-star-dim transition-colors hover:border-sunset-magenta/60 hover:text-star"
          >
            Explore the catalogue
          </button>
        </motion.div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-float text-xs tracking-widest text-star-faint">
        SCROLL ↓
      </div>
    </div>
  );
}
