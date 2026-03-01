"use client";

import React, { useEffect, useMemo, useState } from "react";

type StaffRole = "GERANT" | "TECHNICIEN" | "PRESTATAIRE" | "ASSISTANT" | "STAGIAIRE";

type StaffItem = {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  role: StaffRole;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const FOREST_BTN = "bg-[#183536] text-white";
const COPPER_BTN = "bg-[#C46A1A] text-white";

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
    // tes API renvoient souvent du JSON {error:"..."} : on garde le texte brut
    throw new Error(text || `Erreur API (${res.status})`);
  }

  return (await res.json()) as T;
}

async function fetchIntervenants(): Promise<StaffItem[]> {
  return apiJSON<StaffItem[]>("/api/intervenants", { method: "GET" });
}

async function createIntervenant(payload: {
  fullName: string;
  role: StaffRole;
  email?: string | null;
  phoneNumber?: string | null;
  notes?: string | null;
  isActive?: boolean;
}): Promise<StaffItem> {
  return apiJSON<StaffItem>("/api/intervenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function roleLabel(r: StaffRole) {
  if (r === "GERANT") return "Gérant";
  if (r === "PRESTATAIRE") return "Prestataire";
  if (r === "ASSISTANT") return "Assistant";
  if (r === "STAGIAIRE") return "Stagiaire";
  return "Technicien";
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [items, setItems] = useState<StaffItem[]>([]);

  // Form
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("TECHNICIEN");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIntervenants();
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate() {
    setError(null);
    setSuccess(null);

    const name = fullName.trim();
    if (!name) return setError("fullName requis");

    setSaving(true);
    try {
      const created = await createIntervenant({
        fullName: name,
        role,
        phoneNumber: phoneNumber.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        isActive,
      });

      // Ajoute en haut
      setItems((prev) => [created, ...prev]);

      setSuccess(`Intervenant créé : ${created.fullName}`);

      // reset form
      setFullName("");
      setPhoneNumber("");
      setEmail("");
      setRole("TECHNICIEN");
      setNotes("");
      setIsActive(true);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Supprimer (désactiver) l’intervenant : ${label} ?`)) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/intervenants/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur DELETE (${res.status})`);
      }

      setSuccess(`Intervenant désactivé : ${label}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erreur suppression intervenant");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = useMemo(() => items.filter((x) => x.isActive).length, [items]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-3xl font-bold truncate">Intervenants</div>
            <div className="text-slate-600 mt-1 truncate">
              Lecture : USER + ADMIN • Ajout : ADMIN uniquement • Actifs : {activeCount}/{items.length}
            </div>
          </div>

          <button
            onClick={refresh}
            className="shrink-0 rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50"
            disabled={loading || saving}
          >
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
            <div className="font-semibold">Erreur</div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{error}</div>
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-900">
            <div className="font-semibold">OK</div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{success}</div>
          </div>
        ) : null}

        {/* Form */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-xl font-bold mb-4">Ajouter un intervenant</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Nom complet *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="ex : David Mazzer"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Rôle</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className="w-full rounded-xl border px-3 py-2"
              >
                <option value="GERANT">Gérant</option>
                <option value="TECHNICIEN">Technicien</option>
                <option value="PRESTATAIRE">Prestataire</option>
                <option value="ASSISTANT">Assistant</option>
                <option value="STAGIAIRE">Stagiaire</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Téléphone</label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="06..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="nom@domaine.fr"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 min-h-[90px]"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="active" className="text-sm font-semibold">
                Actif
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 font-semibold hover:opacity-95 ${COPPER_BTN}`}
              onClick={() => {
                setError(null);
                setSuccess(null);
                setFullName("");
                setPhoneNumber("");
                setEmail("");
                setRole("TECHNICIEN");
                setNotes("");
                setIsActive(true);
              }}
              disabled={saving}
            >
              Effacer
            </button>

            <button
              type="button"
              className={`rounded-xl px-4 py-2 font-semibold hover:opacity-95 ${FOREST_BTN}`}
              onClick={onCreate}
              disabled={saving}
            >
              {saving ? "Création…" : "Créer"}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-xl font-bold">Liste</div>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-slate-50 p-4 text-slate-700">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="text-slate-600">Aucun intervenant.</div>
          ) : (
            <div className="space-y-3">
              {items.map((s) => (
                <div key={s.id} className="rounded-xl border p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {s.fullName}{" "}
                      <span className="ml-2 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {roleLabel(s.role)}
                      </span>
                      {!s.isActive ? (
                        <span className="ml-2 inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                          Inactif
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-sm text-slate-700 space-y-1">
                      <div>Tél : {s.phoneNumber ?? "—"}</div>
                      <div>Email : {s.email ?? "—"}</div>
                      <div className="text-slate-600">Notes : {s.notes ?? "—"}</div>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2 whitespace-nowrap">
                    <div className="text-xs text-slate-500">
                      MAJ : {new Date(s.updatedAt).toLocaleString()}
                    </div>

                    {s.isActive ? (
                      <button
                        type="button"
                        onClick={() => onDelete(s.id, s.fullName)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 min-h-[32px]"
                        disabled={saving}
                        title="Désactiver (soft delete)"
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}