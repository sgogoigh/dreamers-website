"use client";

import { motion } from "motion/react";

const STEPS = [
  {
    n: "01",
    title: "You write a line",
    body: "One sentence is enough — a mood, a place, a person. That line is the seed of the whole film.",
    icon: "✍️",
  },
  {
    n: "02",
    title: "We write the film",
    body: "Gemini turns your line into a structured trailer script: an 8-shot blueprint with cast, pacing, and dialogue that never drifts.",
    icon: "🎬",
  },
  {
    n: "03",
    title: "Veo shoots it",
    body: "Seven chained Veo 3.1 shots plus a composed title card, stitched with fades into one ~60-second cinematic cut, ready to download.",
    icon: "✨",
  },
];

export function AboutSection({ active }: { active: boolean }) {
  return (
    <div className="grain relative flex h-full w-full items-center bg-gradient-to-b from-night via-plum to-night">
      <div
        className="absolute right-[8%] top-[12%] h-64 w-64 rounded-full bg-sunset-violet/15 blur-3xl animate-float-slow"
        aria-hidden
      />
      <div className="mx-auto w-full max-w-6xl overflow-y-auto px-6 py-24 max-h-full">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={active ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-xs uppercase tracking-[0.28em] text-sunset-gold"
        >
          How it works
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          animate={active ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mt-3 max-w-2xl font-display text-3xl font-semibold sm:text-5xl"
        >
          From one line to a <span className="text-gradient">one-minute film</span>
        </motion.h2>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <motion.article
              key={step.n}
              initial={{ opacity: 0, y: 28 }}
              animate={active ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.15 + i * 0.14 }}
              className="border-gradient group relative overflow-hidden rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1.5"
            >
              <div className="absolute -right-6 -top-6 text-7xl opacity-10 transition-opacity group-hover:opacity-25">
                {step.icon}
              </div>
              <span className="font-display text-sm text-sunset-magenta">{step.n}</span>
              <h3 className="mt-2 font-display text-xl font-semibold text-star">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-star-dim">{step.body}</p>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={active ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.6 }}
          className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl bg-gradient-to-r from-sunset-violet/20 via-sunset-magenta/15 to-sunset-amber/20 p-6 sm:mt-12 sm:flex-row sm:items-center sm:p-8"
        >
          <div>
            <h3 className="font-display text-2xl font-semibold text-star">
              Your first two dreams are free.
            </h3>
            <p className="mt-1 text-sm text-star-dim">
              Then top up whenever the next idea strikes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-night/60 px-3.5 py-2 text-sunset-gold">10 credits on signup</span>
            <span className="rounded-full bg-night/60 px-3.5 py-2 text-sunset-gold">5 credits per video</span>
            <span className="rounded-full bg-night/60 px-3.5 py-2 text-sunset-gold">$1 = 1 credit</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
