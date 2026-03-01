"use client";

import React, { useEffect, useMemo, useState } from "react";

type UserRole = "ADMIN" | "USER";

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type MeDTO = {
  userId: string;
  role: UserRole;
};

function slugPart(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function buildUsername(lastName: string, firstName: string) {
  const ln = slugPart(lastName);
  const fn = slugPart(firstName);
  return [ln, fn].filter(Boolean).join(".");
}

export default function AdminUtilisateursPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState<MeDTO | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [isActive, setIsActive] = useState(true);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const username = useMemo(() => buildUsername(lastName, firstName), [lastName, firstName]);

  async function loadMe() {
    try {
      const res = await fetch("/api/me");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Erreur /api/me (${res.status})`);
      if (data?.userId && data?.role) setMe({ userId: String(data.userId), role: data.role });
    } catch {
      // pas bloquant pour afficher la page, mais on ne pourra pas masquer "supprimer soi-même"
      setMe(null);
    }
  }

  async function loadUsers() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/utilisateurs");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur GET (${res.status})`);
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    loadUsers();
  }, []);

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const u = username.trim();
    const em = email.trim().toLowerCase();
    const pw = password;

    if (!lastName.trim()) return setError("Nom requis");
    if (!firstName.trim()) return setError("Prénom requis");
    if (!u) return setError("Identifiant invalide");
    if (!em) return setError("Email requis");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setError("Email invalide");
    if (!pw || pw.length < 8) return setError("Mot de passe : minimum 8 caractères");

    setLoading(true);

    try {
      const res = await fetch("/api/admin/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: u,
          email: em,
          password: pw,
          role,
          isActive,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur POST (${res.status})`);
      }

      setSuccess(`Utilisateur créé : ${data.username}`);
      setPassword("");
      await loadUsers();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, nextActive: boolean) {
    if (!confirm(nextActive ? "Réactiver cet utilisateur ?" : "Désactiver cet utilisateur ?")) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/utilisateurs?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur PUT (${res.status})`);
      }

      setSuccess(nextActive ? "Utilisateur réactivé" : "Utilisateur désactivé");
      await loadUsers();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(id: string, usernameLabel: string) {
    if (!confirm(`Supprimer ${usernameLabel} ?\nCette action est irréversible.`)) return;

    setError(null);
    setSuccess(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/admin/utilisateurs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur DELETE (${res.status})`);
      }

      setSuccess("Utilisateur supprimé");
      await loadUsers();
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setDeletingId(null);
    }
  }

  const myId = me?.userId ?? null;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>

      {error && <div className="mt-4 text-red-600 font-semibold">{error}</div>}
      {success && <div className="mt-4 text-green-600 font-semibold">{success}</div>}

      <form onSubmit={onCreateUser} className="mt-6 grid gap-4 md:grid-cols-2">
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className="border rounded-xl px-3 py-2" />
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className="border rounded-xl px-3 py-2" />
        <input value={username} readOnly className="border rounded-xl px-3 py-2 bg-neutral-100" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border rounded-xl px-3 py-2" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="border rounded-xl px-3 py-2" />

        <button type="submit" disabled={loading} className="bg-black text-white rounded-xl px-4 py-2">
          {loading ? "En cours..." : "Créer"}
        </button>
      </form>

      <div className="mt-8">
        {/* VERSION DESKTOP */}
        <div className="hidden md:block">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-neutral-100">
                <th className="px-3 py-2 text-left">Username</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Rôle</th>
                <th className="px-3 py-2 text-left">Actif</th>
                <th className="px-3 py-2 text-left">Créé</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = myId ? u.id === myId : false;
                const canDelete = !isMe; // backend revalide
                const busy = deletingId === u.id;

                return (
                  <tr key={u.id} className="border-b">
                    <td className="px-3 py-2">{u.username}</td>
                    <td className="px-3 py-2">{u.email ?? "-"}</td>
                    <td className="px-3 py-2">{u.role}</td>
                    <td className="px-3 py-2">{u.isActive ? "Oui" : "Non"}</td>
                    <td className="px-3 py-2">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(u.id, !u.isActive)}
                          className="rounded-lg border px-3 py-1 hover:bg-neutral-50 min-h-[44px]"
                        >
                          {u.isActive ? "Désactiver" : "Réactiver"}
                        </button>

                        {canDelete ? (
                          <button
                            onClick={() => deleteUser(u.id, u.username)}
                            disabled={busy}
                            className="rounded-lg border border-red-600/30 px-3 py-1 text-red-700 hover:bg-red-50 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busy ? "Suppression…" : "Supprimer"}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="rounded-lg border px-3 py-1 min-h-[44px] opacity-50 cursor-not-allowed"
                            title="Impossible de se supprimer soi-même"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* VERSION MOBILE */}
        <div className="md:hidden space-y-4">
          {users.map((u) => {
            const isMe = myId ? u.id === myId : false;
            const canDelete = !isMe;
            const busy = deletingId === u.id;

            return (
              <div key={u.id} className="border rounded-2xl p-4 shadow-sm bg-white">
                <div className="font-semibold text-lg">{u.username}</div>
                <div className="text-sm text-neutral-600">{u.email ?? "-"}</div>

                <div className="mt-2 flex justify-between text-sm">
                  <span>Rôle</span>
                  <span>{u.role}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Actif</span>
                  <span>{u.isActive ? "Oui" : "Non"}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => toggleActive(u.id, !u.isActive)}
                    className="w-full rounded-xl border py-3 font-semibold hover:bg-neutral-50 min-h-[48px]"
                  >
                    {u.isActive ? "Désactiver" : "Réactiver"}
                  </button>

                  {canDelete ? (
                    <button
                      onClick={() => deleteUser(u.id, u.username)}
                      disabled={busy}
                      className="w-full rounded-xl border border-red-600/30 py-3 font-semibold text-red-700 hover:bg-red-50 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? "Suppression…" : "Supprimer"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full rounded-xl border py-3 font-semibold min-h-[48px] opacity-50 cursor-not-allowed"
                      title="Impossible de se supprimer soi-même"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}