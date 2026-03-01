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

  const isJson = (res.headers.get("content-type") || "").includes("application/json");

  if (!res.ok) {
    const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
    const msg =
      typeof payload === "string"
        ? payload
        : payload?.error
        ? String(payload.error)
        : `Erreur API (${res.status})`;
    throw new Error(msg);
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

async function patchIntervenant(
  id: string,
  payload: Partial<Pick<StaffItem, "fullName" | "phoneNumber" | "email" | "notes" | "isActive">>
): Promise<StaffItem> {
  return apiJSON<StaffItem>(`/api/intervenants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function purgeIntervenant(id: string): Promise<{ ok: true }> {
  return apiJSON<{ ok: true }>(`/api/intervenants/${encodeURIComponent(id)}/purge`, {
    method: "DELETE",
  });
}

function roleLabel(r: StaffRole) {
  if (r === "GERANT") return "Gérant";
  if (r === "PRESTATAIRE") return "Prestataire";
  if (r === "ASSISTANT") return "Assistant";
  if (r === "STAGIAIRE") return "Stagiaire";
  return "Technicien";
}

/** Modal simple */
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full h-[100dvh] rounded-none bg-white shadow-xl border flex flex-col overflow-hidden md:max-w-2xl md:h-auto md:rounded-2xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-base font-bold">{title}</div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl border hover:bg-slate-50"
            aria-label="Fermer"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [items, setItems] = useState<StaffItem[]>([]);

  // Form create
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("TECHNICIEN");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Modal edit
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

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

      setItems((prev) => [created, ...prev]);
      setSuccess(`Intervenant créé : ${created.fullName}`);

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

  function openEdit(s: StaffItem) {
    setError(null);
    setSuccess(null);
    setEditId(s.id);
    setEditFullName(s.fullName || "");
    setEditPhoneNumber(s.phoneNumber || "");
    setEditEmail(s.email || "");
    setEditNotes(s.notes || "");
    setEditIsActive(!!s.isActive);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const updated = await patchIntervenant(editId, {
        fullName: editFullName.trim(),
        phoneNumber: editPhoneNumber.trim() || null,
        email: editEmail.trim() || null,
        notes: editNotes.trim() || null,
        isActive: editIsActive,
      });

      setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      setSuccess(`Fiche mise à jour : ${updated.fullName}`);
      setEditOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Erreur modification");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: StaffItem) {
    const next = !s.isActive;
    const label = next ? "Réactiver" : "Rendre inactif";
    if (!confirm(`${label} : ${s.fullName} ?`)) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const updated = await patchIntervenant(s.id, { isActive: next });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      setSuccess(next ? "Intervenant réactivé" : "Intervenant rendu inactif");
    } catch (e: any) {
      setError(e?.message ?? "Erreur changement statut");
    } finally {
      setSaving(false);
    }
  }

  async function purge(s: StaffItem) {
    if (s.isActive) {
      setError("Purge refusée : désactive d’abord l’intervenant (Inactif), puis purge.");
      return;
    }
    if (!confirm(`SUPPRIMER DÉFINITIVEMENT : ${s.fullName} ?\n\nCette action est irréversible.`)) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await purgeIntervenant(s.id);
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      setSuccess("Intervenant supprimé définitivement.");
    } catch (e: any) {
      setError(e?.message ?? "Erreur purge");
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
              Lecture : USER + ADMIN • Ajout/MAJ/Suppression : ADMIN • Actifs : {activeCount}/{items.length}
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

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded-lg border px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                        disabled={saving}
                      >
                        Modifier
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleActive(s)}
                        className="rounded-lg border px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                        disabled={saving}
                        title={s.isActive ? "Rendre inactif (congé / non assignable)" : "Réactiver (assignable)"}
                      >
                        {s.isActive ? "Inactif" : "Actif"}
                      </button>

                      <button
                        type="button"
                        onClick={() => purge(s)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        disabled={saving}
                        title="Suppression définitive (purge)"
                      >
                        Purge
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={editOpen} title="Modifier intervenant" onClose={() => setEditOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Nom complet *</label>
            <input
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="ex : Prénom Nom"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Téléphone</label>
            <input
              value={editPhoneNumber}
              onChange={(e) => setEditPhoneNumber(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="06..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="nom@domaine.fr"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 min-h-[120px]"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold">Actif (assignable)</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 font-semibold hover:opacity-95 ${FOREST_BTN}`}
              onClick={saveEdit}
              disabled={saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}