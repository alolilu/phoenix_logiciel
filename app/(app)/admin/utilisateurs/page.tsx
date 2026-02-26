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

function slugPart(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, ".") // non alphanum -> .
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [lastName, setLastName] = useState(""); // "Nom"
  const [firstName, setFirstName] = useState(""); // "Prénom"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [isActive, setIsActive] = useState(true);

  const username = useMemo(() => buildUsername(lastName, firstName), [lastName, firstName]);

  async function loadUsers() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/utilisateurs", { method: "GET" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error ? String(data.error) : `Erreur GET (${res.status})`;
        throw new Error(msg);
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!u) return setError("Identifiant (username) invalide");
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
        const msg = data?.error ? String(data.error) : `Erreur POST (${res.status})`;
        throw new Error(msg);
      }

      setSuccess(`Utilisateur créé : ${data.username}`);
      setPassword("");
      // Option : garder nom/prénom/email pour créer plusieurs comptes
      await loadUsers();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Création admin (identifiant <span className="font-mono">nom.prenom</span>) + rôles + activation
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="rounded-xl border px-4 py-2 font-semibold hover:bg-neutral-50 disabled:opacity-50"
        >
          Rafraîchir
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="font-bold text-red-800">Erreur</div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-red-800">{error}</pre>
        </div>
      ) : null}

      {success ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="font-bold text-emerald-800">OK</div>
          <div className="mt-1 text-sm text-emerald-800">{success}</div>
        </div>
      ) : null}

      {/* Formulaire création */}
      <div className="mt-6 rounded-2xl border bg-white p-4 md:p-6">
        <h2 className="text-xl font-bold">Créer un utilisateur</h2>

        <form onSubmit={onCreateUser} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">Nom</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ex: Matéo"
              autoComplete="family-name"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Prénom</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ex: Mazzer"
              autoComplete="given-name"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Identifiant (auto)</label>
            <input
              className="w-full rounded-xl border bg-neutral-50 px-3 py-2 font-mono"
              value={username}
              readOnly
            />
            <div className="mt-1 text-xs text-neutral-500">
              Format : <span className="font-mono">nom.prenom</span> (sans accents, en minuscules)
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Email</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: mateo.mazzer@phoenixnouvelleaquitaine.fr"
              type="email"
              autoComplete="email"
              required
            />
            <div className="mt-1 text-xs text-neutral-500">
              Obligatoire (ton Prisma impose <span className="font-mono">email</span> unique).
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Mot de passe</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 caractères"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Rôle</label>
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={role}
              onChange={(e) => setRole((e.target.value.toUpperCase() === "ADMIN" ? "ADMIN" : "USER") as UserRole)}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            <div className="mt-3 flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActive" className="text-sm font-semibold">
                Compte actif
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? "En cours..." : "Créer l’utilisateur"}
            </button>
          </div>
        </form>
      </div>

      {/* Liste utilisateurs */}
      <div className="mt-6 rounded-2xl border bg-white p-4 md:p-6">
        <h2 className="text-xl font-bold">Utilisateurs</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-neutral-50">
                <th className="px-3 py-2 text-left">Username</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Rôle</th>
                <th className="px-3 py-2 text-left">Actif</th>
                <th className="px-3 py-2 text-left">Créé</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-neutral-500" colSpan={5}>
                    {loading ? "Chargement..." : "Aucun utilisateur"}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="px-3 py-2 font-mono">{u.username}</td>
                    <td className="px-3 py-2">{u.email ?? "-"}</td>
                    <td className="px-3 py-2">{u.role}</td>
                    <td className="px-3 py-2">{u.isActive ? "Oui" : "Non"}</td>
                    <td className="px-3 py-2">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-neutral-500">
          Endpoint : <span className="font-mono">/api/admin/utilisateurs</span>
        </div>
      </div>
    </div>
  );
}