"use client";

import React, { useEffect, useMemo, useState } from "react";

type Role = "ADMIN" | "USER";

type UserRow = {
  id: string;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const FOREST_BTN = "bg-[#183536] text-white";

function normalizePart(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
function buildUsername(lastName: string, firstName: string) {
  const ln = normalizePart(lastName);
  const fn = normalizePart(firstName);
  return `${ln}.${fn}`.replace(/\.+/g, ".").replace(/^\./, "").replace(/\.$/, "");
}

async function apiJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur API (${res.status})`);
  }
  return (await res.json()) as T;
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);

  // Form création (Option B)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

  const previewUsername = useMemo(() => buildUsername(lastName, firstName), [lastName, firstName]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJSON<UserRow[]>("/api/admin/utilisateurs", { method: "GET" });
      setUsers(data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createUser() {
    setError(null);

    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) return window.alert("Nom et prénom requis.");
    if (!password || password.length < 8) return window.alert("Mot de passe requis (min 8 caractères).");

    setSaving(true);
    try {
      const created = await apiJSON<UserRow>("/api/admin/utilisateurs", {
        method: "POST",
        body: JSON.stringify({
          firstName: fn,
          lastName: ln,
          role,
          isActive,
          password,
        }),
      });

      setUsers((prev) => [created, ...prev]);

      // reset form
      setFirstName("");
      setLastName("");
      setRole("USER");
      setIsActive(true);
      setPassword("");
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    setError(null);
    setSaving(true);
    try {
      const updated = await apiJSON<UserRow>("/api/admin/utilisateurs", {
        method: "PATCH",
        body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
      });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(u: UserRow, next: Role) {
    setError(null);
    setSaving(true);
    try {
      const updated = await apiJSON<UserRow>("/api/admin/utilisateurs", {
        method: "PATCH",
        body: JSON.stringify({ id: u.id, role: next }),
      });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(u: UserRow) {
    const next = window.prompt(`Nouveau mot de passe pour ${u.username} (min 8 caractères) :`);
    if (!next) return;
    if (next.length < 8) return window.alert("Min 8 caractères.");

    setError(null);
    setSaving(true);
    try {
      await apiJSON<UserRow>("/api/admin/utilisateurs", {
        method: "PATCH",
        body: JSON.stringify({ id: u.id, password: next }),
      });
      // on ne récupère pas le hash (normal), mais on peut rafraîchir la ligne
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(u: UserRow) {
    if (!window.confirm(`Supprimer le compte ${u.username} ?`)) return;
    setError(null);
    setSaving(true);
    try {
      await apiJSON<{ ok: true }>(`/api/admin/utilisateurs?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-slate-900 truncate">Gestion des utilisateurs</div>
            <div className="mt-1 text-slate-600 truncate">Création admin (identifiant nom.prenom) + rôles + activation</div>
          </div>

          <button
            onClick={refresh}
            disabled={loading || saving}
            className="rounded-xl border px-4 py-2 text-sm font-semibold bg-white hover:bg-slate-50"
          >
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
            <div className="font-semibold">Erreur</div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{error}</div>
          </div>
        ) : null}

        {/* Création */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Créer un utilisateur</div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Nom</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex : Dupont"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Prénom</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex : Marie"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Identifiant (auto)</label>
              <input className="w-full rounded-xl border px-3 py-2 bg-slate-50" value={previewUsername} readOnly />
              <div className="mt-1 text-xs text-slate-500">Format : nom.prenom (sans accents, en minuscules)</div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Mot de passe</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Min 8 caractères"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Rôle</label>
              <select className="w-full rounded-xl border px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-7">
              <input
                id="isActive"
                type="checkbox"
                className="h-4 w-4"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActive" className="text-sm font-semibold">
                Compte actif
              </label>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end">
            <button
              onClick={createUser}
              disabled={saving}
              className={`rounded-xl px-5 py-3 font-semibold hover:opacity-95 ${FOREST_BTN}`}
            >
              {saving ? "Création…" : "Créer"}
            </button>
          </div>
        </div>

        {/* Liste */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <div className="text-lg font-bold text-slate-900">Liste</div>
            <div className="text-sm text-slate-600 mt-1">{users.length} utilisateur(s)</div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[860px] w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold text-slate-600">
                  <th className="px-6 py-3">Identifiant</th>
                  <th className="px-6 py-3">Rôle</th>
                  <th className="px-6 py-3">Actif</th>
                  <th className="px-6 py-3">Créé</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-6 py-6 text-slate-600" colSpan={5}>
                      Chargement…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-slate-600" colSpan={5}>
                      Aucun utilisateur.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{u.username}</div>
                        <div className="text-xs text-slate-500">{u.id}</div>
                      </td>

                      <td className="px-6 py-4">
                        <select
                          className="rounded-lg border px-3 py-2 text-sm font-semibold"
                          value={u.role}
                          disabled={saving}
                          onChange={(e) => changeRole(u, e.target.value as Role)}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
                            u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          {u.isActive ? "Oui" : "Non"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {new Date(u.createdAt).toLocaleString("fr-FR")}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                            onClick={() => toggleActive(u)}
                            disabled={saving}
                          >
                            {u.isActive ? "Désactiver" : "Activer"}
                          </button>

                          <button
                            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                            onClick={() => resetPassword(u)}
                            disabled={saving}
                          >
                            Mot de passe
                          </button>

                          <button
                            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-red-50 text-red-700 border-red-200"
                            onClick={() => deleteUser(u)}
                            disabled={saving}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
