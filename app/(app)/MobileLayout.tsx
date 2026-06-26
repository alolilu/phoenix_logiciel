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
    <div className="bg-white text-slate-900">
      <div>{children}</div>
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