"use client";

import { useEffect, useState } from "react";

/** Types each sample out, pauses, deletes, moves to the next — forever. */
export function useTypingLoop(
  samples: string[],
  opts: { typeMs?: number; deleteMs?: number; holdMs?: number } = {},
): string {
  const { typeMs = 45, deleteMs = 18, holdMs = 1800 } = opts;
  const [text, setText] = useState("");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("typing");

  useEffect(() => {
    if (samples.length === 0) return;
    const target = samples[sampleIdx % samples.length];
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (text.length < target.length) {
        timer = setTimeout(() => setText(target.slice(0, text.length + 1)), typeMs);
      } else {
        timer = setTimeout(() => setPhase("holding"), 10);
      }
    } else if (phase === "holding") {
      timer = setTimeout(() => setPhase("deleting"), holdMs);
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText(text.slice(0, -1)), deleteMs);
      } else {
        setSampleIdx((i) => (i + 1) % samples.length);
        setPhase("typing");
      }
    }
    return () => clearTimeout(timer);
  }, [text, phase, sampleIdx, samples, typeMs, deleteMs, holdMs]);

  return text;
}
