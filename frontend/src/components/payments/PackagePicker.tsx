"use client";

export interface CreditPackage {
  usd: number;
  credits: number;
  videos: number;
  tag?: string;
}

export function buildPackages(costPerVideo = 5): CreditPackage[] {
  return [5, 10, 25, 50].map((usd) => ({
    usd,
    credits: usd,
    videos: Math.floor(usd / costPerVideo),
    tag: usd === 25 ? "Most popular" : undefined,
  }));
}

export function PackagePicker({
  selected,
  onSelect,
  costPerVideo = 5,
}: {
  selected: number | null;
  onSelect: (usd: number) => void;
  costPerVideo?: number;
}) {
  const packages = buildPackages(costPerVideo);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {packages.map((p) => {
        const active = selected === p.usd;
        return (
          <button
            key={p.usd}
            onClick={() => onSelect(p.usd)}
            aria-pressed={active}
            className={`focus-sunset relative rounded-2xl border p-4 text-center transition-all hover:-translate-y-1 ${
              active
                ? "border-transparent bg-sunset text-night shadow-glow"
                : "border-line/70 bg-panel text-star hover:border-sunset-magenta/50"
            }`}
          >
            {p.tag && (
              <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${active ? "bg-night text-sunset-gold" : "bg-sunset text-night"}`}>
                {p.tag}
              </span>
            )}
            <p className="font-display text-2xl font-semibold">${p.usd}</p>
            <p className={`mt-1 text-xs ${active ? "text-night/80" : "text-star-dim"}`}>
              {p.credits} credits
            </p>
            <p className={`text-[11px] ${active ? "text-night/70" : "text-star-faint"}`}>
              {p.videos} video{p.videos === 1 ? "" : "s"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
