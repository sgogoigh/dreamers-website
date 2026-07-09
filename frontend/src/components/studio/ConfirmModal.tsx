"use client";

/** Business rule B5: the single, final gate before generation. Once confirmed
 * there is no way to stop — the copy says so, and confirm fires exactly once. */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  prompt: string | null;
  cost?: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ prompt, cost = 5, busy = false, onConfirm, onCancel }: ConfirmModalProps) {
  const firedRef = useRef(false);
  const open = prompt !== null;

  useEffect(() => {
    if (open) firedRef.current = false;
  }, [open, prompt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  const confirm = () => {
    if (firedRef.current || busy) return;
    firedRef.current = true;
    onConfirm();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-labelledby="confirm-title"
        >
          <motion.div
            initial={{ scale: 0.94, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="border-gradient w-full max-w-lg rounded-3xl p-6 shadow-glow sm:p-8"
          >
            <h2 id="confirm-title" className="font-display text-2xl font-semibold text-star">
              Is this prompt final?
            </h2>
            <blockquote className="mt-4 max-h-40 overflow-y-auto rounded-2xl bg-night/60 px-4 py-3 text-sm italic leading-relaxed text-star-dim">
              “{prompt}”
            </blockquote>
            <p className="mt-4 text-sm leading-relaxed text-star-dim">
              Generation <span className="font-semibold text-sunset-gold">cannot be stopped</span>{" "}
              once it starts and will use{" "}
              <span className="font-semibold text-sunset-gold">{cost} credits</span>.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={onCancel}
                disabled={busy}
                className="focus-sunset rounded-full border border-line px-6 py-2.5 text-sm text-star-dim transition-colors hover:text-star disabled:opacity-40"
              >
                Edit prompt
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="focus-sunset rounded-full bg-sunset px-6 py-2.5 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy ? "Starting…" : "Dream it ✨"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
