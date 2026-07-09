"use client";

import type { SectionDef } from "./FullPager";

export function SectionDots({
  sections,
  index,
  goTo,
}: {
  sections: SectionDef[];
  index: number;
  goTo: (i: number) => boolean;
}) {
  return (
    <div
      aria-label="Section indicator"
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 sm:flex"
    >
      {sections.map((s, i) => (
        <button
          key={s.id}
          onClick={() => goTo(i)}
          aria-label={`Go to ${s.label}`}
          aria-current={index === i}
          className={`focus-sunset h-2.5 w-2.5 rounded-full transition-all duration-300 ${
            index === i
              ? "scale-125 bg-sunset shadow-glow-sm"
              : "bg-star-faint/40 hover:bg-star-faint"
          }`}
        />
      ))}
    </div>
  );
}
