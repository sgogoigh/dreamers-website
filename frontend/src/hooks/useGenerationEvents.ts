"use client";

/** SSE progress for a running dream (snapshot → live events → close), with
 * exponential-backoff reconnect. The server replays a snapshot on every
 * (re)connect, so state always resyncs. */
import { useEffect, useRef, useState } from "react";

import { eventsUrl } from "@/lib/api";
import type { SegmentState, SseEvent } from "@/types/api";
import { useApiToken, useInvalidateAfterGeneration } from "./useApi";

export interface LiveProgress {
  status: string;
  progress: number;
  message: string;
  segments: SegmentState[];
  error: string | null;
  connected: boolean;
}

const INITIAL: LiveProgress = {
  status: "queued",
  progress: 0,
  message: "",
  segments: [],
  error: null,
  connected: false,
};

export function useGenerationEvents(dreamId: string | null, active: boolean): LiveProgress {
  const token = useApiToken();
  const [state, setState] = useState<LiveProgress>(INITIAL);
  const invalidate = useInvalidateAfterGeneration();
  const retryRef = useRef(0);

  useEffect(() => {
    if (!dreamId || !token || !active) return;
    let es: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(eventsUrl(dreamId, token));
      es.onopen = () => {
        retryRef.current = 0;
        setState((s) => ({ ...s, connected: true }));
      };
      es.onmessage = (msg) => {
        const event: SseEvent = JSON.parse(msg.data);
        if (event.type === "snapshot") {
          setState((s) => ({
            ...s,
            status: event.status,
            progress: event.progress,
            message: event.message,
            segments: event.segments ?? [],
            error: event.error,
          }));
        } else if (event.type === "stage") {
          setState((s) => ({
            ...s,
            status: event.stage,
            progress: event.progress,
            message: event.message,
          }));
        } else if (event.type === "segment") {
          setState((s) => ({
            ...s,
            progress: event.progress,
            message: event.message,
            segments: s.segments.map((seg) =>
              seg.beat_no === event.beat_no
                ? { ...seg, status: event.status as SegmentState["status"], detail: event.detail }
                : seg,
            ),
          }));
        } else if (event.type === "status") {
          setState((s) => ({
            ...s,
            status: event.status,
            progress: event.progress ?? s.progress,
            error: event.error ?? null,
          }));
          invalidate(dreamId);
        } else if (event.type === "close") {
          closed = true;
          es?.close();
        }
      };
      es.onerror = () => {
        es?.close();
        setState((s) => ({ ...s, connected: false }));
        if (!closed) {
          const delay = Math.min(8000, 500 * 2 ** retryRef.current);
          retryRef.current += 1;
          retryTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamId, token, active]);

  return state;
}
