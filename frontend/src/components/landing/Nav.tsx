"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";

import type { SectionDef } from "./FullPager";

interface NavProps {
  sections: SectionDef[];
  index: number;
  goTo: (i: number) => boolean;
}

export function Nav({ sections, index, goTo }: NavProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const jump = (i: number) => {
    setMenuOpen(false);
    goTo(i);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          onClick={() => jump(0)}
          className="focus-sunset flex items-center gap-2.5"
          aria-label="Dreamers — back to top"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/art/logo.jpg"
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-sunset-amber/40"
          />
          <span className="font-display text-xl font-semibold tracking-wide text-gradient-soft">
            Dreamers
          </span>
        </button>

        {/* desktop tabs */}
        <nav
          aria-label="Sections"
          className="hidden items-center gap-1 rounded-full border border-line/60 bg-plum/60 px-1.5 py-1 backdrop-blur-md md:flex"
        >
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => jump(i)}
              aria-current={index === i ? "page" : undefined}
              className={`focus-sunset relative rounded-full px-4 py-1.5 text-sm transition-colors ${
                index === i ? "text-night" : "text-star-dim hover:text-star"
              }`}
            >
              {index === i && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-sunset"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative z-10 font-medium">{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <Link
              href="/studio"
              className="focus-sunset rounded-full bg-sunset px-4 py-2 text-sm font-semibold text-night shadow-glow-sm transition-transform hover:-translate-y-0.5"
            >
              Open studio
            </Link>
          ) : (
            <Link
              href="/signin?next=/studio"
              className="focus-sunset rounded-full border border-sunset-amber/50 px-4 py-2 text-sm font-medium text-sunset-gold transition-colors hover:bg-sunset-amber/10"
            >
              Sign in
            </Link>
          )}
          {/* mobile menu button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="focus-sunset rounded-full border border-line/60 bg-plum/60 p-2 backdrop-blur-md md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* mobile sheet */}
      {menuOpen && (
        <div className="mx-4 rounded-2xl border border-line/60 bg-plum/90 p-2 backdrop-blur-xl md:hidden">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => jump(i)}
              className={`focus-sunset block w-full rounded-xl px-4 py-3 text-left text-sm ${
                index === i ? "bg-sunset text-night font-semibold" : "text-star-dim"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
