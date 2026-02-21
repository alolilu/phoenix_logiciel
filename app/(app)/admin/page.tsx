import Link from "next/link";

export const runtime = "nodejs";

function Card({
  title,
  desc,
  href,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  badge?: { label: string; tone?: "dark" | "light" };
}) {
  const tone =
    badge?.tone === "dark"
      ? "bg-[#183536] text-white"
      : "bg-slate-100 text-slate-800";

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-bold text-slate-900">{title}</div>
          <div className="mt-2 text-sm text-slate-600">{desc}</div>
        </div>

        {badge ? (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${tone}`}
          >
            {badge.label}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          Ouvrir <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="text-2xl font-extrabold text-slate-900">Admin</div>
          <div className="mt-1 text-slate-600">
            Accès aux outils d’administration.
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            title="Gestion des utilisateurs"
            desc="Créer, activer/désactiver et gérer les comptes."
            href="/admin/utilisateurs"
            badge={{ label: "ADMIN", tone: "dark" }}
          />

          <Card
            title="Retour au planning"
            desc="Voir le calendrier (jour / semaine / mois) et gérer les chantiers."
            href="/"
            badge={{ label: "PLANNING", tone: "light" }}
          />

          <Card
            title="Intervenants"
            desc="Consulter la liste des intervenants."
            href="/intervenants"
            badge={{ label: "LECTURE", tone: "light" }}
          />

          <Card
            title="Archives"
            desc="Consulter les chantiers archivés."
            href="/archives"
            badge={{ label: "HISTORIQUE", tone: "light" }}
          />
        </div>
      </div>
    </main>
  );
}
