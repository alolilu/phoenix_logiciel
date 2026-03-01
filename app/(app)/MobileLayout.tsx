"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  title?: string;
  fabHref?: string;
  fabLabel?: string;
  children: React.ReactNode;
};

export default function MobileLayout({
  title = "Phoenix Ops",
  fabHref,
  fabLabel = "+",
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const showFab = !!fabHref && !pathname.startsWith("/admin") && !pathname.startsWith("/connexion");

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      {/* Header compact mobile uniquement */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:hidden">
        <div className="flex h-12 items-center justify-between px-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-[#183536] flex items-center justify-center text-white text-sm font-semibold">
              P
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">{title}</div>
              <div className="truncate text-[11px] text-slate-500 leading-tight">Terrain</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-3 text-sm font-medium active:scale-[0.99]"
            aria-label="Rafraîchir"
            title="Rafraîchir"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Zone contenu : padding bottom pour ne pas être caché par FAB */}
      <div className="pb-24 sm:pb-0">{children}</div>

      {/* FAB mobile uniquement */}
      {showFab ? (
        <button
          type="button"
          onClick={() => router.push(fabHref!)}
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#183536] text-white text-2xl shadow-lg active:scale-[0.99] sm:hidden"
          aria-label="Nouveau"
          title="Nouveau"
        >
          {fabLabel}
        </button>
      ) : null}
    </div>
  );
}