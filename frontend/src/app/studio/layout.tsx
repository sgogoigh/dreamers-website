"use client";

/** Studio shell: fixed sidebar (drawer on mobile) + the chat pane, which sits
 * on a slightly LIGHTER warm hue than the sidebar so the workspace reads as
 * layered and organized. */
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Sidebar } from "@/components/studio/Sidebar";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-night">
      {/* desktop sidebar */}
      <div className="hidden w-72 shrink-0 border-r border-line/50 lg:block">
        <Sidebar />
      </div>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-night/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-line/50 lg:hidden"
            >
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* chat pane — lighter warm hue */}
      <main className="relative min-w-0 flex-1 bg-chat">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(217,70,160,0.07),transparent),radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(245,158,11,0.06),transparent)]"
          aria-hidden
        />
        {/* mobile top bar */}
        <div className="absolute left-3 top-3 z-30 lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="focus-sunset rounded-xl border border-line/60 bg-panel/80 p-2.5 backdrop-blur"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
