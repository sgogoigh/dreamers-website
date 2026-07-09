"use client";

import { useEffect, useRef, useState } from "react";

interface PromptComposerProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  balance?: number;
  costPerVideo?: number;
  minLen?: number;
  maxLen?: number;
  compact?: boolean;
  autoFocus?: boolean;
}

/** The chat bar. Auto-grows, counts characters, states the cost, submits on
 * the button or Ctrl/⌘+Enter. */
export function PromptComposer({
  onSubmit,
  disabled = false,
  disabledReason,
  balance,
  costPerVideo = 5,
  minLen = 3,
  maxLen = 2000,
  compact = false,
  autoFocus = false,
}: PromptComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const valid = trimmed.length >= minLen && trimmed.length <= maxLen;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, compact ? 120 : 200)}px`;
  }, [value, compact]);

  const submit = () => {
    if (disabled || !valid) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div
      className={`border-gradient rounded-2xl shadow-glow-sm transition-shadow focus-within:shadow-glow ${
        compact ? "p-2" : "p-3"
      }`}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          autoFocus={autoFocus}
          value={value}
          disabled={disabled}
          maxLength={maxLen}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={disabled ? disabledReason ?? "…" : "What do you dream of?"}
          aria-label="Describe your dream"
          className="focus-sunset max-h-52 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-star placeholder:text-star-faint disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={disabled || !valid}
          aria-label="Dream it"
          className="focus-sunset shrink-0 rounded-xl bg-sunset px-4 py-2.5 text-sm font-semibold text-night transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          Dream ✨
        </button>
      </div>
      <div className="flex items-center justify-between px-3 pb-1 pt-1.5 text-[11px] text-star-faint">
        <span>
          {disabled && disabledReason ? (
            <span className="text-sunset-gold">{disabledReason}</span>
          ) : balance !== undefined ? (
            <>
              This will use <span className="text-sunset-gold">{costPerVideo} credits</span> — you
              have {balance}
            </>
          ) : (
            <>Costs {costPerVideo} credits per video</>
          )}
        </span>
        <span data-testid="char-count" className={trimmed.length > maxLen - 100 ? "text-sunset-amber" : ""}>
          {trimmed.length}/{maxLen}
        </span>
      </div>
    </div>
  );
}
