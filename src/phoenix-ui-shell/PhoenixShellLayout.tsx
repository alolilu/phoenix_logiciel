"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";

type NavItem = {
  label: string;
  href: string;
  requiresAdmin?: boolean;
};

export function PhoenixShellLayout(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session } = useSession();

  const role = (session as any)?.user?.role ?? null;
  const isAdmin = role === "ADMIN";

  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Accueil (Planning)", href: "/" },
      { label: "Intervenants", href: "/intervenants" },
      { label: "Historique", href: "/historique" },
      { label: "Archives", href: "/archives" },
      { label: "Admin", href: "/admin", requiresAdmin: true },
    ],
    []
  );

  const visibleNavItems = navItems.filter(
    (item) => !item.requiresAdmin || isAdmin
  );

  async function handleLogout() {
    await signOut({
      callbackUrl: "/connexion",
    });
  }

  return (
    <div className="min-h-screen bg-phoenixOffWhite text-phoenixInk">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-phoenixGreen text-phoenixOffWhite">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 hover:bg-white/15"
            onClick={() => setIsMenuOpen(true)}
          >
            ☰
          </button>

          <div className="flex flex-col">
            <span className="text-sm opacity-90">
              Phoenix Nouvelle-Aquitaine
            </span>
            <span className="text-base font-semibold text-phoenixCopper">
              Planning Interventions
            </span>
          </div>

          <div className="ml-auto text-xs opacity-80">
            {isAdmin ? "ADMIN" : "USER"}
          </div>
        </div>
      </header>

      {/* OVERLAY */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* MENU LATERAL */}
      <aside
        className={[
          "fixed left-0 top-0 z-[60] h-full w-72",
          "bg-phoenixOffWhite shadow-2xl",
          "transition-transform duration-200",
          isMenuOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-semibold">
            Menu
            <div className="text-xs font-normal opacity-70">Navigation</div>
          </div>

          <button
            type="button"
            className="h-9 w-9 rounded-xl border border-black/10 bg-white hover:bg-black/5"
            onClick={() => setIsMenuOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="p-3">
          <ul className="space-y-2">
            {visibleNavItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={[
                      "flex items-center justify-between rounded-xl px-3 py-3",
                      "border border-black/10 bg-white hover:bg-black/5",
                      isActive ? "ring-2 ring-phoenixCopper/50" : "",
                    ].join(" ")}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs opacity-60">›</span>
                  </Link>
                  
                </li>
              );
            })}
          </ul>
        </nav>

        {/* LOGOUT */}
        <div className="mt-auto border-t border-black/10 p-4">
          <button
            onClick={handleLogout}
            className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* CONTENU */}
      <main className="mx-auto max-w-6xl p-4">{props.children}</main>
    </div>
  );
}
