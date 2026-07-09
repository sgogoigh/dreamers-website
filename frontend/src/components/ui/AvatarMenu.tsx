"use client";

/** The user's initial in a sunset-gradient circle; opens Profile / Sign out. */
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { initials } from "@/lib/format";

export function AvatarMenu({
  name,
  email,
  onSignOut = () => signOut({ callbackUrl: "/" }),
}: {
  name?: string | null;
  email?: string | null;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="focus-sunset flex w-full items-center gap-3 rounded-2xl border border-line/60 bg-panel px-3 py-2.5 text-left transition-colors hover:border-sunset-magenta/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunset font-display text-sm font-bold text-night shadow-glow-sm">
          {initials(name, email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-star">{name || "Dreamer"}</span>
          <span className="block truncate text-xs text-star-faint">{email}</span>
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-star-faint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute bottom-full left-0 z-30 mb-2 w-full overflow-hidden rounded-2xl border border-line/70 bg-panel-2 shadow-glow"
          >
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-sunset block px-4 py-3 text-sm text-star transition-colors hover:bg-plum"
            >
              View profile
            </Link>
            <button
              role="menuitem"
              onClick={onSignOut}
              className="focus-sunset block w-full px-4 py-3 text-left text-sm text-bad transition-colors hover:bg-plum"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
