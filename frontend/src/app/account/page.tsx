"use client";

/** Profile dashboard: identity, credits left, usage & cost graph, previously
 * generated videos, recent activity. */
import { motion } from "motion/react";
import Link from "next/link";
import { signOut } from "next-auth/react";

import { UsageChart } from "@/components/account/UsageChart";
import { useApiToken, useBalance, useDreams, useLedger, useUser } from "@/hooks/useApi";
import { thumbnailUrl, videoUrl } from "@/lib/api";
import { buildUsageSeries } from "@/lib/chart";
import { formatDateShort, formatDateTime, formatUsd, initials } from "@/lib/format";

const REASON_LABEL: Record<string, string> = {
  signup_bonus: "Signup bonus",
  generation: "Video generated",
  generation_refund: "Refund (failed dream)",
  purchase: "Credits purchased",
};

export default function AccountPage() {
  const { data: me } = useUser();
  const { data: balance } = useBalance();
  const { data: ledger } = useLedger();
  const { data: dreams } = useDreams();
  const token = useApiToken();

  const entries = ledger?.items ?? [];
  const series = buildUsageSeries(entries);
  const completed = (dreams?.items ?? []).filter((d) => d.status === "completed");

  return (
    <div className="min-h-dvh bg-night">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(124,58,237,0.18),transparent)]" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/studio" className="focus-sunset text-sm text-star-dim hover:text-star">
            ← Back to studio
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="focus-sunset rounded-full border border-line px-4 py-2 text-sm text-star-dim hover:border-bad/60 hover:text-bad"
          >
            Sign out
          </button>
        </div>

        {/* identity */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex items-center gap-5"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunset font-display text-3xl font-bold text-night shadow-glow">
            {initials(me?.name, me?.email)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-semibold text-star">
              {me?.name || "Dreamer"}
            </h1>
            <p className="truncate text-sm text-star-dim">{me?.email}</p>
            {me?.created_at && (
              <p className="mt-0.5 text-xs text-star-faint">
                Dreaming since {formatDateShort(me.created_at)}
              </p>
            )}
          </div>
        </motion.section>

        {/* stat cards */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Credits left",
              value: balance ? `${balance.balance}` : "…",
              sub: balance ? `${balance.videos_remaining} videos remaining` : "",
            },
            {
              label: "Videos created",
              value: me ? `${me.dreams_count}` : "…",
              sub: `${completed.length} completed`,
            },
            {
              label: "Total spent",
              value: formatUsd(series.totalSpent),
              sub: `${series.totalPurchased} credits purchased`,
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              className="border-gradient rounded-3xl p-5"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-star-faint">{card.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold text-gradient">{card.value}</p>
              <p className="mt-1 text-xs text-star-dim">{card.sub}</p>
            </motion.div>
          ))}
        </section>

        {/* usage & cost graph */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="border-gradient mt-6 rounded-3xl p-5 sm:p-6"
        >
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-star">Usage & cost</h2>
            <p className="text-xs text-star-faint">measured in credits · $1 = 1 credit</p>
          </div>
          <UsageChart entries={entries} />
        </motion.section>

        {/* previously generated videos */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold text-star">Your videos</h2>
            <Link href="/studio" className="focus-sunset text-xs text-sunset-gold hover:underline">
              Dream another →
            </Link>
          </div>
          {completed.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-star-faint">
              Nothing filmed yet — your finished dreams will gather here.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((d) => (
                <div key={d.id} className="group overflow-hidden rounded-2xl border border-line/60 bg-panel transition-transform hover:-translate-y-1">
                  <Link href={`/studio/${d.id}`} className="focus-sunset block">
                    <div className="relative aspect-video bg-abyss">
                      {token && d.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnailUrl(d.id, token)}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">🎬</div>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-night/0 text-3xl opacity-0 transition-all group-hover:bg-night/40 group-hover:opacity-100">
                        ▶
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-star">{d.title}</p>
                      <p className="text-[11px] text-star-faint">{formatDateShort(d.created_at)}</p>
                    </div>
                    {token && (
                      <a
                        href={videoUrl(d.id, token, true)}
                        aria-label={`Download ${d.title}`}
                        className="focus-sunset shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-star-dim hover:border-sunset-amber/60 hover:text-sunset-gold"
                      >
                        ⬇
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* recent activity */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="border-gradient mb-12 mt-6 rounded-3xl p-5 sm:p-6"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold text-star">Recent activity</h2>
            <Link href="/credits" className="focus-sunset text-xs text-sunset-gold hover:underline">
              Buy credits →
            </Link>
          </div>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-star-faint">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-line/40">
              {entries.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-star">{REASON_LABEL[e.reason] ?? e.reason}</p>
                    <p className="text-[11px] text-star-faint">{formatDateTime(e.created_at)}</p>
                  </div>
                  <span className={`shrink-0 font-semibold tabular-nums ${e.delta > 0 ? "text-ok" : "text-star-dim"}`}>
                    {e.delta > 0 ? "+" : ""}
                    {e.delta} cr
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </div>
  );
}
