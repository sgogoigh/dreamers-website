"use client";

/** The heart of the studio.
 *
 * New dream: the Dreamers logo pops up with the chat bar at the CENTRE of the
 * pane. The moment generation starts they COLLAPSE TO THE TOP (shared
 * layoutId transitions) and the thread takes over. Deep links
 * (/studio/[dreamId]) render the collapsed state directly.
 */
import { motion, useReducedMotion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useApiToken, useBalance, useDream } from "@/hooks/useApi";
import { useGenerationEvents } from "@/hooks/useGenerationEvents";
import { ApiError, createDream, retryDream } from "@/lib/api";
import { ACTIVE_DREAM_STATUSES } from "@/types/api";

import { ConfirmModal } from "./ConfirmModal";
import { GenerationProgress } from "./GenerationProgress";
import { InsufficientCredits } from "./InsufficientCredits";
import { PromptComposer } from "./PromptComposer";
import { VideoPlayer } from "./VideoPlayer";

const COST = 5;

export function StudioExperience({ initialDreamId }: { initialDreamId: string | null }) {
  const [dreamId, setDreamId] = useState<string | null>(initialDreamId);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const token = useApiToken();
  const qc = useQueryClient();
  const { data: balance } = useBalance();
  const { data: dream } = useDream(dreamId);
  const reduced = useReducedMotion();

  const dreamActive =
    !!dreamId && (!dream || (ACTIVE_DREAM_STATUSES as string[]).includes(dream.status));
  const live = useGenerationEvents(dreamId, dreamActive);

  // Merge SSE (fast) with the polled dream (authoritative once terminal).
  const status: string = (() => {
    if (dream && (dream.status === "completed" || dream.status === "failed")) return dream.status;
    if (live.status === "completed" || live.status === "failed") return live.status;
    if (live.progress > 0 || live.segments.length > 0) return live.status;
    return dream?.status ?? "queued";
  })();
  const segments = live.segments.length > 0 ? live.segments : (dream?.job?.segments ?? []);
  const progress = Math.max(live.progress, dream?.job?.progress ?? 0);
  const message = live.message || dream?.job?.message || "";
  const isTerminal = status === "completed" || status === "failed";
  const generating = !!dreamId && !isTerminal;
  const centered = dreamId === null;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["dreams"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  const confirmCreate = async () => {
    if (!token || !confirming) return;
    setBusy(true);
    try {
      const created = await createDream(token, confirming);
      setConfirming(null);
      setFlash(null);
      setDreamId(created.id);
      window.history.replaceState(null, "", `/studio/${created.id}`);
      invalidateAll();
    } catch (err) {
      setConfirming(null);
      if (err instanceof ApiError && err.code === "INSUFFICIENT_CREDITS") {
        setFlash("Not enough credits — top up to keep dreaming.");
      } else if (err instanceof ApiError && err.code === "GENERATION_IN_PROGRESS") {
        setFlash("Your current dream is still rendering — one at a time ✦");
      } else {
        setFlash(err instanceof Error ? err.message : "Something went wrong.");
      }
      invalidateAll();
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!token || !dreamId) return;
    setBusy(true);
    try {
      await retryDream(token, dreamId);
      qc.invalidateQueries({ queryKey: ["dream", dreamId] });
      invalidateAll();
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  };

  const broke = (balance?.balance ?? COST) < COST;
  const composerDisabled = generating || busy;

  const logo = (
    <motion.img
      layoutId="dreamers-logo"
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 28 }}
      src="/art/logo.jpg"
      alt="Dreamers"
      className={
        centered
          ? "h-28 w-28 rounded-full object-cover shadow-glow ring-2 ring-sunset-amber/50 sm:h-36 sm:w-36"
          : "h-10 w-10 rounded-full object-cover ring-1 ring-sunset-amber/40"
      }
    />
  );

  const composer = broke ? (
    <InsufficientCredits balance={balance?.balance ?? 0} cost={COST} />
  ) : (
    <PromptComposer
      onSubmit={(p) => setConfirming(p)}
      disabled={composerDisabled}
      disabledReason={generating ? "Your dream is rendering — one at a time ✦" : undefined}
      balance={balance?.balance}
      costPerVideo={COST}
      compact={!centered}
      autoFocus={centered}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {centered ? (
        /* ---------- CENTERED: logo pops up with the chat bar ---------- */
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-4 pb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 20, delay: 0.05 }}
            className="animate-pulse-glow rounded-full"
          >
            {logo}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="text-center font-display text-3xl font-semibold sm:text-4xl"
          >
            What do you <span className="text-gradient">dream</span> of?
          </motion.h1>
          <motion.div
            layoutId="dreamers-composer"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            className="w-full max-w-2xl"
          >
            {composer}
          </motion.div>
          {flash && (
            <p role="status" className="text-sm text-sunset-gold">{flash}</p>
          )}
        </div>
      ) : (
        /* ---------- COLLAPSED: logo + bar docked to the top ---------- */
        <>
          <div className="border-b border-line/40 bg-night/30 px-4 pb-3 pt-14 backdrop-blur-sm sm:px-8 lg:pt-4">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              {logo}
              <motion.div layoutId="dreamers-composer" className="min-w-0 flex-1">
                {composer}
              </motion.div>
            </div>
            {flash && (
              <p role="status" className="mx-auto mt-2 max-w-3xl text-xs text-sunset-gold">
                {flash}
              </p>
            )}
          </div>

          {/* thread */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {/* prompt bubble */}
              {dream && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="self-end rounded-3xl rounded-br-md bg-sunset px-5 py-3.5 text-sm font-medium text-night shadow-glow-sm sm:max-w-[85%]"
                >
                  {dream.prompt}
                </motion.div>
              )}

              {/* progress / result bubble */}
              {generating && (
                <GenerationProgress
                  status={status}
                  progress={progress}
                  message={message}
                  segments={segments}
                  startedAt={dream?.job?.started_at ?? null}
                />
              )}

              {status === "completed" && dream && token && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  <p className="mb-3 text-sm text-star-dim">✨ Your dream is ready.</p>
                  <VideoPlayer
                    dreamId={dream.id}
                    token={token}
                    title={dream.title}
                    durationSecs={dream.duration_secs}
                  />
                </motion.div>
              )}

              {status === "failed" && dream && (
                <div className="rounded-3xl border border-bad/40 bg-bad/10 p-5">
                  <p className="font-display text-lg font-semibold text-star">
                    This dream slipped away
                  </p>
                  <p className="mt-1 text-sm text-star-dim">
                    {dream.error?.includes("restart")
                      ? "The studio restarted mid-dream."
                      : "Something went wrong while filming."}{" "}
                    <span className="text-ok">Your 5 credits were returned.</span>
                  </p>
                  <button
                    onClick={retry}
                    disabled={busy || broke}
                    className="focus-sunset mt-4 rounded-full bg-sunset px-5 py-2.5 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {busy ? "Retrying…" : `Retry (${COST} credits)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        prompt={confirming}
        cost={COST}
        busy={busy}
        onConfirm={confirmCreate}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
