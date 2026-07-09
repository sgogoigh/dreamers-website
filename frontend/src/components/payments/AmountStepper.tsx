"use client";

export const MIN_USD = 5;
export const STEP_USD = 5;
export const MAX_USD = 500;

export function clampAmount(value: number): number {
  const snapped = Math.round(value / STEP_USD) * STEP_USD;
  return Math.max(MIN_USD, Math.min(MAX_USD, snapped));
}

export function AmountStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        aria-label="Decrease amount"
        onClick={() => onChange(clampAmount(value - STEP_USD))}
        disabled={value <= MIN_USD}
        className="focus-sunset h-11 w-11 rounded-full border border-line text-xl text-star-dim transition-colors hover:border-sunset-magenta/60 hover:text-star disabled:opacity-30"
      >
        −
      </button>
      <div className="min-w-28 text-center">
        <p data-testid="stepper-amount" className="font-display text-4xl font-semibold text-gradient">
          ${value}
        </p>
        <p className="text-xs text-star-faint">= {value} credits</p>
      </div>
      <button
        aria-label="Increase amount"
        onClick={() => onChange(clampAmount(value + STEP_USD))}
        disabled={value >= MAX_USD}
        className="focus-sunset h-11 w-11 rounded-full border border-line text-xl text-star-dim transition-colors hover:border-sunset-magenta/60 hover:text-star disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
