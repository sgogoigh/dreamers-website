"use client";

/** Usage & cost line chart (SVG, no chart lib).
 *
 * Dataviz rules applied: ONE axis, one unit (credits; $1 = 1 credit stated in
 * the subtitle — never a second y-scale). Two series, hues validated for the
 * dark panel surface (#d97706 amber / #8b5cf6 violet — lightness band, chroma,
 * CVD ΔE and contrast all pass). 2px lines, ≥8px hover markers, crosshair +
 * tooltip, legend + direct labels, recessive grid, text in text tokens.
 */
import { useMemo, useRef, useState } from "react";

import { buildUsageSeries, linePath, makeScales, yTicks } from "@/lib/chart";
import { formatDateShort } from "@/lib/format";
import type { LedgerEntryOut } from "@/types/api";

export const SERIES = [
  { key: "balance" as const, label: "Balance", color: "#d97706" },
  { key: "spent" as const, label: "Spent (cumulative)", color: "#8b5cf6" },
];

const W = 640;
const H = 260;
const PAD = { l: 40, r: 116, t: 16, b: 30 };

export function UsageChart({ entries }: { entries: LedgerEntryOut[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const series = useMemo(() => buildUsageSeries(entries), [entries]);
  const { x, y, yTop } = useMemo(() => makeScales(series, W, H, PAD), [series]);
  const ticks = useMemo(() => yTicks(series.yMax), [series.yMax]);

  if (series.points.length < 2) {
    return (
      <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-star-faint">
        Your usage graph appears after your first dream ✦
      </div>
    );
  }

  const pts = series.points;
  const hover = hoverIdx != null ? pts[hoverIdx] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(x(p.t) - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  return (
    <div>
      {/* legend (2 series → always present) */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-star-dim">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Credits balance and cumulative spend over time"
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* recessive grid + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)}
              stroke="var(--color-line)" strokeOpacity="0.5" strokeWidth="1"
            />
            <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-star-faint)">
              {t}
            </text>
          </g>
        ))}
        {/* x labels: first / last */}
        <text x={x(series.tMin)} y={H - 8} fontSize="10" fill="var(--color-star-faint)">
          {formatDateShort(new Date(series.tMin).toISOString())}
        </text>
        <text x={x(series.tMax)} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-star-faint)">
          {formatDateShort(new Date(series.tMax).toISOString())}
        </text>

        {/* lines (2px) + direct labels at line ends */}
        {SERIES.map((s) => {
          const d = linePath(pts, s.key, x, y);
          const last = pts[pts.length - 1];
          return (
            <g key={s.key}>
              <path data-testid={`line-${s.key}`} d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(last.t)} cy={y(last[s.key])} r="3" fill={s.color} />
              <text
                x={x(last.t) + 8} y={y(last[s.key]) + 3.5}
                fontSize="11" fill="var(--color-star-dim)"
              >
                {s.label.split(" ")[0]} {last[s.key]}
              </text>
            </g>
          );
        })}

        {/* crosshair + hover markers + tooltip */}
        {hover && (
          <g data-testid="chart-tooltip">
            <line
              x1={x(hover.t)} x2={x(hover.t)} y1={PAD.t} y2={H - PAD.b}
              stroke="var(--color-star-faint)" strokeDasharray="3 3" strokeWidth="1"
            />
            {SERIES.map((s) => (
              <circle
                key={s.key}
                cx={x(hover.t)} cy={y(hover[s.key])} r="4.5"
                fill={s.color} stroke="var(--color-panel)" strokeWidth="2"
              />
            ))}
            {(() => {
              const boxX = Math.min(x(hover.t) + 10, W - PAD.r - 130);
              const boxY = Math.max(PAD.t, Math.min(y(Math.max(hover.balance, hover.spent)) - 14, H - 86));
              return (
                <g>
                  <rect x={boxX} y={boxY} width="126" height="58" rx="8" fill="var(--color-abyss)" stroke="var(--color-line)" />
                  <text x={boxX + 10} y={boxY + 17} fontSize="10" fill="var(--color-star-faint)">
                    {formatDateShort(new Date(hover.t).toISOString())}
                  </text>
                  <text x={boxX + 10} y={boxY + 33} fontSize="11" fill="var(--color-star)">
                    Balance: {hover.balance} cr
                  </text>
                  <text x={boxX + 10} y={boxY + 49} fontSize="11" fill="var(--color-star)">
                    Spent: {hover.spent} cr (${hover.spent})
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* baseline */}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--color-line)" strokeWidth="1" />
        <text x={PAD.l} y={12} fontSize="0" aria-hidden>{yTop}</text>
      </svg>
    </div>
  );
}
