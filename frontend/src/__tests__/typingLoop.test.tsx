import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTypingLoop } from "@/hooks/useTypingLoop";

/** Timers are (re)scheduled inside effects after each state update, so we
 * advance in small acted steps to let every effect flush. */
const tick = (ms: number, step = 5) => {
  for (let t = 0; t < ms; t += step) {
    act(() => {
      vi.advanceTimersByTime(step);
    });
  }
};

describe("useTypingLoop (hero prompt animation)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("types the sample out character by character", () => {
    const { result } = renderHook(() =>
      useTypingLoop(["abc"], { typeMs: 10, deleteMs: 5, holdMs: 500 }),
    );
    expect(result.current).toBe("");
    tick(15);
    expect(result.current).toBe("a");
    tick(30);
    expect(result.current).toBe("abc");
  });

  it("holds, deletes, then cycles to the next sample", () => {
    const { result } = renderHook(() =>
      useTypingLoop(["ab", "xy"], { typeMs: 10, deleteMs: 5, holdMs: 40 }),
    );
    tick(25);
    expect(result.current).toBe("ab"); // fully typed
    tick(60); // hold elapses, deletion runs
    expect(result.current.length).toBeLessThan(2);
    tick(60); // second sample types out
    expect(result.current).toBe("xy");
  });

  it("is inert with no samples", () => {
    const { result } = renderHook(() => useTypingLoop([]));
    tick(200);
    expect(result.current).toBe("");
  });
});
