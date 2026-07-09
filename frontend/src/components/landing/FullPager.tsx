"use client";

/** The landing page engine: stacked 100dvh sections translated as one column.
 * Wheel / swipe / keys move exactly ONE section per gesture (complete
 * transitions, no partial scrolls); nav tabs and dots jump directly. */
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { innerScrollWins, keyDirection, swipeDirection, wheelDirection } from "@/hooks/useFullpage";

export interface SectionDef {
  id: string;
  label: string;
}

interface FullPagerProps {
  sections: SectionDef[];
  index: number;
  goTo: (i: number) => boolean;
  step: (dir: 1 | -1) => void;
  children: React.ReactNode[];
}

export function FullPager({ sections, index, goTo, step, children }: FullPagerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const reduced = useReducedMotion();

  // The landing page owns the viewport: no page scroll while mounted.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // Deep link: /#about lands on the About section.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const i = sections.findIndex((s) => s.id === hash);
    if (i > 0) goTo(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the hash in sync so sections are shareable.
  useEffect(() => {
    const id = sections[index]?.id;
    if (id) window.history.replaceState(null, "", index === 0 ? " " : `#${id}`);
  }, [index, sections]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      const dir = wheelDirection(e.deltaY);
      if (dir === 0) return;
      if (innerScrollWins(e.target as Element, container, dir)) return;
      e.preventDefault();
      step(dir);
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY.current == null) return;
      const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
      const dir = swipeDirection(touchStartY.current, endY);
      touchStartY.current = null;
      if (dir === 0) return;
      if (innerScrollWins(e.target as Element, container, dir)) return;
      step(dir);
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        goTo(sections.length - 1);
        return;
      }
      const dir = keyDirection(e.key);
      if (dir === 0) return;
      e.preventDefault();
      step(dir);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [goTo, step, sections.length]);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-night">
      <motion.div
        animate={{ y: `-${index * 100}dvh` }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.85, ease: [0.72, 0, 0.22, 1] }
        }
        className="h-full w-full"
      >
        {children.map((child, i) => (
          <section
            key={sections[i]?.id ?? i}
            id={sections[i]?.id}
            aria-label={sections[i]?.label}
            className="relative h-[100dvh] w-full overflow-hidden"
          >
            {child}
          </section>
        ))}
      </motion.div>
    </div>
  );
}
