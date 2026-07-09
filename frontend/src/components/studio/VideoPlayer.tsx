"use client";

import { thumbnailUrl, videoUrl } from "@/lib/api";
import { formatDuration } from "@/lib/format";

export function VideoPlayer({
  dreamId,
  token,
  title,
  durationSecs,
}: {
  dreamId: string;
  token: string;
  title: string;
  durationSecs?: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line/60 bg-night/60 shadow-glow">
      <video
        data-testid="dream-video"
        controls
        playsInline
        preload="metadata"
        poster={thumbnailUrl(dreamId, token)}
        src={videoUrl(dreamId, token)}
        className="aspect-video w-full bg-black"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-star">{title}</p>
          <p className="text-xs text-star-faint">
            {formatDuration(durationSecs)} · 720p · MP4
          </p>
        </div>
        <a
          data-testid="download-link"
          href={videoUrl(dreamId, token, true)}
          className="focus-sunset rounded-full bg-sunset px-5 py-2.5 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
        >
          ⬇ Download
        </a>
      </div>
    </div>
  );
}
