"use client";

/** Session history: dreams grouped by date with status dots. */
import { groupByDate } from "@/lib/format";
import type { DreamListItem, DreamStatus } from "@/types/api";
import { ACTIVE_DREAM_STATUSES } from "@/types/api";

function StatusDot({ status }: { status: DreamStatus }) {
  if ((ACTIVE_DREAM_STATUSES as string[]).includes(status)) {
    return (
      <span
        data-testid="dot-active"
        title={status}
        className="h-2 w-2 shrink-0 animate-twinkle rounded-full bg-sunset-amber shadow-glow-sm"
      />
    );
  }
  if (status === "completed") {
    return <span data-testid="dot-completed" title="completed" className="h-2 w-2 shrink-0 rounded-full bg-ok" />;
  }
  return <span data-testid="dot-failed" title="failed" className="h-2 w-2 shrink-0 rounded-full bg-bad" />;
}

export function DreamList({
  dreams,
  activeId,
  onSelect,
}: {
  dreams: DreamListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (dreams.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-star-faint">
        No dreams yet — your history will appear here.
      </p>
    );
  }

  const groups = groupByDate(dreams);

  return (
    <nav aria-label="Dream history" className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-star-faint">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((dream) => (
              <li key={dream.id}>
                <button
                  onClick={() => onSelect(dream.id)}
                  aria-current={activeId === dream.id ? "true" : undefined}
                  className={`focus-sunset flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    activeId === dream.id
                      ? "bg-panel-2 text-star"
                      : "text-star-dim hover:bg-panel hover:text-star"
                  }`}
                >
                  <StatusDot status={dream.status} />
                  <span className="truncate text-sm">{dream.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
