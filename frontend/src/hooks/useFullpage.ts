"use client";

/** Full-page section navigation: one COMPLETE transition per gesture, never a
 * partial scroll. The pure helpers are unit-tested; the hook wires them to
 * state + a transition lock. */
import { useCallback, useEffect, useRef, useState } from "react";

export function clampIndex(target: number, total: number): number {
  return Math.max(0, Math.min(total - 1, target));
}

/** Direction from a wheel delta; small jitters (trackpad noise) are ignored. */
export function wheelDirection(deltaY: number, threshold = 24): 1 | -1 | 0 {
  if (deltaY > threshold) return 1;
  if (deltaY < -threshold) return -1;
  return 0;
}

/** Direction from a touch swipe (start minus end — swiping up moves down). */
export function swipeDirection(startY: number, endY: number, threshold = 60): 1 | -1 | 0 {
  const delta = startY - endY;
  if (delta > threshold) return 1;
  if (delta < -threshold) return -1;
  return 0;
}

export function keyDirection(key: string): 1 | -1 | 0 {
  if (["ArrowDown", "PageDown", " "].includes(key)) return 1;
  if (["ArrowUp", "PageUp"].includes(key)) return -1;
  return 0;
}

/** If an inner element can still scroll in this direction, native scroll wins
 * (escape hatch for overflowing sections on small screens). */
export function innerScrollWins(el: Element | null, boundary: Element, dir: 1 | -1): boolean {
  let node: Element | null = el;
  while (node && node !== boundary) {
    const scrollable = node.scrollHeight > node.clientHeight + 1;
    if (scrollable) {
      const canDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
      const canUp = node.scrollTop > 0;
      if ((dir === 1 && canDown) || (dir === -1 && canUp)) return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function useFullpage(total: number, transitionMs = 950) {
  const [index, setIndex] = useState(0);
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const goTo = useCallback(
    (target: number): boolean => {
      const clamped = clampIndex(target, total);
      let moved = false;
      setIndex((cur) => {
        if (lockRef.current || clamped === cur) return cur;
        moved = true;
        return clamped;
      });
      if (moved) {
        lockRef.current = true;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          lockRef.current = false;
        }, transitionMs);
      }
      return moved;
    },
    [total, transitionMs],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      setIndex((cur) => {
        const target = clampIndex(cur + dir, total);
        if (lockRef.current || target === cur) return cur;
        lockRef.current = true;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          lockRef.current = false;
        }, transitionMs);
        return target;
      });
    },
    [total, transitionMs],
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { index, goTo, step };
}
