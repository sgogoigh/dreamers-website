"use client";

/** Poster wall: two counter-scrolling marquee rows of CSS-art posters.
 * Hover pauses the row and lifts the poster; click opens a lightbox. */
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

export interface Poster {
  id: string;
  title: string;
  prompt: string;
  duration: string;
  gradient: string; // tailwind gradient classes
  emblem: string;
}

export const POSTERS: Poster[] = [
  { id: "storm-keeper", title: "The Storm Keeper", prompt: "a lighthouse keeper who befriends a storm", duration: "0:58", gradient: "from-indigo-950 via-purple-800 to-amber-500", emblem: "🌩️" },
  { id: "drowned-library", title: "Drowned Library", prompt: "the last librarian of a sunken city", duration: "1:00", gradient: "from-slate-950 via-cyan-900 to-emerald-600", emblem: "📚" },
  { id: "comet-garden", title: "Comet Garden", prompt: "an astronaut plants a garden on a comet", duration: "0:56", gradient: "from-violet-950 via-fuchsia-800 to-rose-500", emblem: "☄️" },
  { id: "paper-armada", title: "Paper Armada", prompt: "a paper boat sailing a thunderstorm of fireflies", duration: "0:59", gradient: "from-amber-950 via-orange-800 to-yellow-500", emblem: "⛵" },
  { id: "midnight-duel", title: "Midnight Duel", prompt: "rival street magicians fall in love mid-duel", duration: "1:00", gradient: "from-purple-950 via-pink-800 to-orange-400", emblem: "🎩" },
  { id: "clockwork-sea", title: "Clockwork Sea", prompt: "a tide made of ticking brass gears", duration: "0:57", gradient: "from-stone-950 via-amber-900 to-amber-400", emblem: "⚙️" },
  { id: "wolf-of-embers", title: "Wolf of Embers", prompt: "a wolf woven from campfire sparks guards a village", duration: "0:58", gradient: "from-red-950 via-rose-900 to-amber-500", emblem: "🔥" },
  { id: "aurora-express", title: "Aurora Express", prompt: "a night train that runs on the northern lights", duration: "1:00", gradient: "from-blue-950 via-violet-800 to-teal-400", emblem: "🚂" },
];

function PosterCard({ poster, onOpen }: { poster: Poster; onOpen: (p: Poster) => void }) {
  return (
    <button
      onClick={() => onOpen(poster)}
      className={`focus-sunset group relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br sm:w-48 ${poster.gradient} p-4 text-left shadow-lg transition-transform duration-300 hover:-translate-y-2 hover:rotate-1 hover:shadow-glow`}
      aria-label={`Preview ${poster.title}`}
    >
      <div className="absolute inset-0 grain" />
      <span className="text-3xl drop-shadow">{poster.emblem}</span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3.5">
        <p className="font-display text-sm font-semibold leading-tight text-white">
          {poster.title}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] text-white/70">“{poster.prompt}”</p>
        <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/90">
          ▶ {poster.duration}
        </span>
      </div>
    </button>
  );
}

function MarqueeRow({
  posters,
  reverse,
  onOpen,
}: {
  posters: Poster[];
  reverse?: boolean;
  onOpen: (p: Poster) => void;
}) {
  const doubled = [...posters, ...posters];
  return (
    <div className="group/row relative w-full overflow-hidden">
      <div
        className="flex w-max gap-4 py-2 group-hover/row:[animation-play-state:paused]"
        style={{
          animation: `${reverse ? "marquee-right" : "marquee-left"} 42s linear infinite`,
        }}
      >
        {doubled.map((p, i) => (
          <PosterCard key={`${p.id}-${i}`} poster={p} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export function CatalogueSection({ active }: { active: boolean }) {
  const [open, setOpen] = useState<Poster | null>(null);

  return (
    <div className="grain relative flex h-full w-full flex-col justify-center bg-gradient-to-b from-night via-[#140b21] to-night">
      <div className="mx-auto w-full max-w-6xl px-6 pb-4">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={active ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-xs uppercase tracking-[0.28em] text-sunset-gold"
        >
          Catalogue
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          animate={active ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mt-3 font-display text-3xl font-semibold sm:text-5xl"
        >
          Dreams other people <span className="text-gradient">dared to watch</span>
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mt-6 space-y-4"
      >
        <MarqueeRow posters={POSTERS.slice(0, 4)} onOpen={setOpen} />
        <MarqueeRow posters={POSTERS.slice(4)} reverse onOpen={setOpen} />
      </motion.div>

      {/* lightbox */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-night/85 p-6 backdrop-blur-sm"
            onClick={() => setOpen(null)}
            role="dialog"
            aria-modal
            aria-label={open.title}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className={`grain relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br p-8 ${open.gradient} shadow-glow`}
            >
              <span className="text-5xl">{open.emblem}</span>
              <h3 className="mt-4 font-display text-3xl font-semibold text-white">{open.title}</h3>
              <p className="mt-2 text-sm italic text-white/80">“{open.prompt}”</p>
              <p className="mt-4 text-xs text-white/60">
                {open.duration} · 720p · generated from one line
              </p>
              <div className="mt-6 flex gap-3">
                <Link
                  href="/studio"
                  className="focus-sunset rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
                >
                  Dream your own →
                </Link>
                <button
                  onClick={() => setOpen(null)}
                  className="focus-sunset rounded-full border border-white/40 px-5 py-2.5 text-sm text-white/90"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
