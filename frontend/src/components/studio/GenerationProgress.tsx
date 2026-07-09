"use client";

/** Truthful long-render progress: stage stepper, per-segment tiles that light
 * up from SSE events, gradient progress bar, elapsed timer. Deliberately NO
 * cancel affordance (business rule B5). */
import { useEffect, useState } from "react";

import { elapsedSince } from "@/lib/format";
import type { SegmentState } from "@/types/api";

export const STAGES = [
  { key: "scripting", label: "Scripting" },
  { key: "prompting", label: "Prompting" },
  { key: "rendering", label: "Rendering" },
  { key: "stitching", label: "Stitching" },
] as const;

export function stageState(
  current: string,
  stageKey: string,
): "done" | "active" | "pending" {
  const order = ["queued", ...STAGES.map((s) => s.key), "completed"];
  const cur = order.indexOf(current === "failed" ? "queued" : current);
  const mine = order.indexOf(stageKey);
  if (current === "completed") return "done";
  if (cur > mine) return "done";
  if (cur === mine) return "active";
  return "pending";
}

interface GenerationProgressProps {
  status: string;
  progress: number;
  message: string;
  segments: SegmentState[];
  startedAt: string | null;
}

export function GenerationProgress({
  status,
  progress,
  message,
  segments,
  startedAt,
}: GenerationProgressProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const done = segments.filter((s) => s.status === "completed").length;

  return (
    <div className="border-gradient rounded-3xl p-5 sm:p-6" data-testid="generation-progress">
      {/* stage stepper */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs sm:text-sm">
        {STAGES.map((stage, i) => {
          const st = stageState(status, stage.key);
          return (
            <li key={stage.key} className="flex items-center gap-2">
              <span
                data-testid={`stage-${stage.key}`}
                data-state={st}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
                  st === "done"
                    ? "bg-ok/15 text-ok"
                    : st === "active"
                      ? "bg-sunset text-night shadow-glow-sm"
                      : "bg-panel text-star-faint"
                }`}
              >
                {st === "done" ? "✓" : st === "active" ? (
                  <span className="inline-block h-2 w-2 animate-twinkle rounded-full bg-night" />
                ) : null}
                {stage.label}
              </span>
              {i < STAGES.length - 1 && <span className="text-star-faint">→</span>}
            </li>
          );
        })}
      </ol>

      {/* progress bar */}
      <div className="relative mt-5 h-2.5 overflow-hidden rounded-full bg-night/70">
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-full rounded-full bg-sunset transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(2, progress * 100)}%` }}
        />
        <div className="shimmer absolute inset-0" aria-hidden />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-star-dim">
        <span className="truncate">{message || "warming up the projector…"}</span>
        <span className="ml-3 shrink-0 tabular-nums">
          {Math.round(progress * 100)}% · {elapsedSince(startedAt, now)}
        </span>
      </div>

      {/* segment tiles */}
      {segments.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-star-faint">
            Shots {done}/{segments.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {segments.map((seg) => (
              <div
                key={seg.beat_no}
                data-testid={`segment-${seg.beat_no}`}
                data-status={seg.status}
                title={seg.detail || `shot ${seg.beat_no}`}
                className={`flex h-11 w-14 items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-500 ${
                  seg.status === "completed"
                    ? "border-transparent bg-sunset text-night shadow-glow-sm"
                    : seg.status === "running"
                      ? "animate-twinkle border-sunset-amber/60 bg-panel text-sunset-gold"
                      : "border-line/60 bg-night/50 text-star-faint"
                }`}
              >
                {seg.is_title_card ? "✦" : seg.beat_no}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-star-faint">
        Dreams take a few minutes to film — this one can't be stopped, but you can leave
        and come back: it will be waiting in your history.
      </p>
    </div>
  );
}
