"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useBalance, useDreams } from "@/hooks/useApi";
import { AvatarMenu } from "@/components/ui/AvatarMenu";
import { CreditMeter } from "./CreditMeter";
import { DreamList } from "./DreamList";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const { data: dreams } = useDreams();
  const { data: balance } = useBalance();
  const router = useRouter();
  const pathname = usePathname();
  const activeId = pathname?.startsWith("/studio/") ? pathname.split("/")[2] : null;

  const select = (id: string) => {
    onNavigate?.();
    router.push(`/studio/${id}`);
  };

  return (
    <aside className="flex h-full w-full flex-col gap-4 bg-abyss/80 p-4">
      {/* brand */}
      <Link
        href="/"
        onClick={onNavigate}
        className="focus-sunset flex items-center gap-2.5 px-1 pt-1"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/logo.jpg" alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-sunset-amber/40" />
        <span className="font-display text-lg font-semibold text-gradient-soft">Dreamers</span>
      </Link>

      {/* new dream */}
      <button
        onClick={() => {
          onNavigate?.();
          router.push("/studio");
        }}
        className="focus-sunset rounded-2xl bg-sunset px-4 py-3 text-sm font-semibold text-night shadow-glow-sm transition-transform hover:-translate-y-0.5"
      >
        ✦ New dream
      </button>

      {/* session history */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <DreamList dreams={dreams?.items ?? []} activeId={activeId} onSelect={select} />
      </div>

      {/* usage */}
      <CreditMeter balance={balance} />

      {/* account */}
      <AvatarMenu name={session?.user?.name} email={session?.user?.email} />
    </aside>
  );
}
