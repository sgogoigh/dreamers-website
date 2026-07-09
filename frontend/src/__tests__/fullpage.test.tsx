import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clampIndex,
  innerScrollWins,
  keyDirection,
  swipeDirection,
  useFullpage,
  wheelDirection,
} from "@/hooks/useFullpage";

describe("gesture helpers", () => {
  it("clamps section indexes", () => {
    expect(clampIndex(-3, 4)).toBe(0);
    expect(clampIndex(2, 4)).toBe(2);
    expect(clampIndex(99, 4)).toBe(3);
  });
  it("ignores trackpad jitter below the wheel threshold", () => {
    expect(wheelDirection(10)).toBe(0);
    expect(wheelDirection(80)).toBe(1);
    expect(wheelDirection(-80)).toBe(-1);
  });
  it("maps swipes to directions (swipe up = next)", () => {
    expect(swipeDirection(500, 380)).toBe(1);
    expect(swipeDirection(380, 500)).toBe(-1);
    expect(swipeDirection(500, 470)).toBe(0); // too small
  });
  it("maps keys", () => {
    expect(keyDirection("ArrowDown")).toBe(1);
    expect(keyDirection("PageUp")).toBe(-1);
    expect(keyDirection("a")).toBe(0);
  });
});

describe("innerScrollWins (overflow escape hatch)", () => {
  const makeScrollable = (scrollTop: number) => {
    const boundary = document.createElement("div");
    const inner = document.createElement("div");
    boundary.appendChild(inner);
    Object.defineProperty(inner, "scrollHeight", { value: 400 });
    Object.defineProperty(inner, "clientHeight", { value: 200 });
    inner.scrollTop = scrollTop;
    return { boundary, inner };
  };

  it("lets native scroll win while content remains below", () => {
    const { boundary, inner } = makeScrollable(0);
    expect(innerScrollWins(inner, boundary, 1)).toBe(true);
    expect(innerScrollWins(inner, boundary, -1)).toBe(false); // already at top
  });
  it("hands control back at the bottom edge", () => {
    const { boundary, inner } = makeScrollable(200); // 200 + 200 = 400 → at end
    expect(innerScrollWins(inner, boundary, 1)).toBe(false);
    expect(innerScrollWins(inner, boundary, -1)).toBe(true);
  });
  it("non-scrollable content never captures", () => {
    const boundary = document.createElement("div");
    const inner = document.createElement("div");
    boundary.appendChild(inner);
    expect(innerScrollWins(inner, boundary, 1)).toBe(false);
  });
});

describe("useFullpage — complete transitions with a lock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("navigates one section per gesture and locks during the transition", () => {
    const { result } = renderHook(() => useFullpage(4, 900));
    act(() => result.current.step(1));
    expect(result.current.index).toBe(1);

    // locked: further gestures during the transition are swallowed
    act(() => result.current.step(1));
    act(() => result.current.step(1));
    expect(result.current.index).toBe(1);

    act(() => vi.advanceTimersByTime(950));
    act(() => result.current.step(1));
    expect(result.current.index).toBe(2);
  });

  it("goTo jumps directly to any section (nav tabs)", () => {
    const { result } = renderHook(() => useFullpage(4, 900));
    act(() => result.current.goTo(3));
    expect(result.current.index).toBe(3);
    act(() => vi.advanceTimersByTime(950));
    act(() => result.current.goTo(0));
    expect(result.current.index).toBe(0);
  });

  it("clamps out-of-range targets and never steps past the ends", () => {
    const { result } = renderHook(() => useFullpage(4, 100));
    act(() => result.current.step(-1));
    expect(result.current.index).toBe(0); // no move → no lock
    act(() => result.current.goTo(99));
    expect(result.current.index).toBe(3);
  });

  it("same-index goTo does not lock", () => {
    const { result } = renderHook(() => useFullpage(4, 900));
    act(() => result.current.goTo(0)); // no-op
    act(() => result.current.step(1)); // must not be locked
    expect(result.current.index).toBe(1);
  });
});
