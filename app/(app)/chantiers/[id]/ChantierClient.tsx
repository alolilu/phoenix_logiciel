"use client";

import React, { useEffect, useMemo, useState } from "react";

type ChantierStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE";

type ChantierEvent = {
  id: string;
  type: string;
  title: string;
  startDate: string;
  endDate: string;
  status: ChantierStatus;
  archived: boolean;
  intervenants: string[];
  notes?: string | null;

  siteAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

type ProductUsed = {
  id: string;
  jobId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  createdAt: string;
};

type Attachment = {
  id: string;
  jobId: string;
  kind: "PHOTO" | "DOCUMENT";
  fileLabel: string;
  fileType: string;
  fileUrl: string;
  uploadedByUserId: string | null;
  uploadedAt: string;
};

const FOREST_BTN = "bg-[#183536] text-white";
const CARD = "rounded-2xl border bg-white p-6 shadow-sm";
const INPUT = "w-full rounded-xl border px-3 py-2";

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

function statusLabelFR(s: ChantierStatus) {
  return s === "EN_ATTENTE" ? "En attente" : s === "EN_COURS" ? "En cours" : "Terminé";
}

export default function ChantierClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [job, setJob] = useState<ChantierEvent | null>(null);

  // form job
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<ChantierStatus>("EN_ATTENTE");
  const [archived, setArchived] = useState(false);
  const [notes, setNotes] = useState("");

  const [siteAddress, setSiteAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // products
  const [products, setProducts] = useState<ProductUsed[]>([]);
  const [pName, setPName] = useState("");
  const [pQty, setPQty] = useState<string>("");
  const [pUnit, setPUnit] = useState("");
  const [pNotes, setPNotes] = useState("");

  // attachments
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [docs, setDocs] = useState<Attachment[]>([]);
  const [aKind, setAKind] = useState<"PHOTO" | "DOCUMENT">("PHOTO");
  const [aLabel, setALabel] = useState("");
  const [aType, setAType] = useState("");
  const [aUrl, setAUrl] = useState("");

  const canSave = useMemo(() => {
    if (!title.trim()) return false;
    if (!startDate || !endDate) return false;
    if (endDate < startDate) return false;
    return true;
  }, [title, startDate, endDate]);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const j = await apiJSON<ChantierEvent>(`/api/chantiers/${encodeURIComponent(id)}`, { method: "GET" });
      setJob(j);

      setTitle(j.title ?? "");
      setType(j.type ?? "");
      setStartDate(j.startDate ?? "");
      setEndDate(j.endDate ?? "");
      setStatus(j.status);
      setArchived(!!j.archived);
      setNotes(j.notes ?? "");

      setSiteAddress(j.siteAddress ?? "");
      setContactName(j.contactName ?? "");
      setContactPhone(j.contactPhone ?? "");
      setContactEmail(j.contactEmail ?? "");

      const prods = await apiJSON<ProductUsed[]>(`/api/chantiers/${encodeURIComponent(id)}/products`, { method: "GET" });
      setProducts(prods);

      const attAll = await apiJSON<Attachment[]>(
        `/api/chantiers/${encodeURIComponent(id)}/attachments`,
        { method: "GET" }
      );

      setPhotos(attAll.filter((x) => x.kind === "PHOTO"));
      setDocs(attAll.filter((x) => x.kind === "DOCUMENT"));
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openPdf() {
    window.open(`/api/chantiers/${encodeURIComponent(id)}/pdf`, "_blank", "noopener,noreferrer");
  }

  async function saveJob() {
    setError(null);
    if (!canSave) {
      window.alert("Vérifie : titre + dates valides (fin >= début).");
      return;
    }

    setSaving(true);
    try {
      const updated = await apiJSON<ChantierEvent>(`/api/chantiers/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          type: type,
          startDate,
          endDate,
          status,
          archived,
          notes: notes,

          siteAddress: siteAddress,
          contactName,
          contactPhone,
          contactEmail,
        }),
      });
      setJob(updated);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function addProduct() {
    setError(null);
    const name = pName.trim();
    if (!name) return window.alert("Nom produit requis");

    setSaving(true);
    try {
      const created = await apiJSON<ProductUsed>(`/api/chantiers/${encodeURIComponent(id)}/products`, {
        method: "POST",
        body: JSON.stringify({
          name,
          quantity: pQty === "" ? null : Number(pQty),
          unit: pUnit.trim() || null,
          notes: pNotes.trim() || null,
        }),
      });
      setProducts((prev) => [...prev, created]);
      setPName("");
      setPQty("");
      setPUnit("");
      setPNotes("");
    } catch (e: any) {
      setError(e?.message ?? "Erreur ajout produit");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(productId: string) {
    if (!window.confirm("Supprimer ce produit ?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiJSON<{ ok: true }>(`/api/chantiers/${encodeURIComponent(id)}/products?productId=${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      setProducts((prev) => prev.filter((x) => x.id !== productId));
    } catch (e: any) {
      setError(e?.message ?? "Erreur suppression produit");
    } finally {
      setSaving(false);
    }
  }

  async function addAttachment() {
    setError(null);
    if (!aUrl.trim()) return window.alert("URL requise");
    if (!aType.trim()) return window.alert("fileType requis (ex: image/jpeg ou application/pdf)");
    if (!aLabel.trim()) return window.alert("fileLabel requis");

    setSaving(true);
    try {
      const created = await apiJSON<Attachment>(`/api/chantiers/${encodeURIComponent(id)}/attachments`, {
        method: "POST",
        body: JSON.stringify({
          kind: aKind,
          fileUrl: aUrl.trim(),
          fileType: aType.trim(),
          fileLabel: aLabel.trim(),
        }),
      });

      if (created.kind === "PHOTO") setPhotos((prev) => [...prev, created]);
      else setDocs((prev) => [...prev, created]);

      setALabel("");
      setAType("");
      setAUrl("");
    } catch (e: any) {
      setError(e?.message ?? "Erreur ajout pièce jointe");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!window.confirm("Supprimer cette pièce jointe ?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiJSON<{ ok: true }>(
        `/api/chantiers/${encodeURIComponent(id)}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" }
      );
      setPhotos((prev) => prev.filter((x) => x.id !== attachmentId));
      setDocs((prev) => prev.filter((x) => x.id !== attachmentId));
    } catch (e: any) {
      setError(e?.message ?? "Erreur suppression pièce jointe");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className={CARD}>Chargement…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-3xl font-bold truncate">Fiche chantier</div>
            <div className="text-slate-600 mt-1 truncate">ID : {id}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openPdf}
              className="rounded-xl border px-4 py-3 font-semibold hover:bg-slate-50"
              type="button"
            >
              Ouvrir PDF
            </button>

            <button
              onClick={saveJob}
              className={`rounded-xl px-5 py-3 font-semibold hover:opacity-95 ${FOREST_BTN}`}
              disabled={saving || !canSave}
              type="button"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
            <div className="font-semibold">Erreur</div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{error}</div>
          </div>
        ) : null}

        <div className={CARD}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-bold">Infos générales</div>
              <div className="text-slate-600 mt-1">
                Statut : <span className="font-semibold">{statusLabelFR(status)}</span>
                {archived ? <span className="ml-2 inline-block rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold">ARCHIVÉ</span> : null}
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              <span className="text-sm font-semibold">Archivé</span>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Titre</label>
              <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Type</label>
              <input className={INPUT} value={type} onChange={(e) => setType(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Date début</label>
              <input className={INPUT} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Date fin</label>
              <input className={INPUT} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Statut</label>
              <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value as ChantierStatus)}>
                <option value="EN_ATTENTE">En attente</option>
                <option value="EN_COURS">En cours</option>
                <option value="TERMINE">Terminé</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Intervenants</label>
              <div className="rounded-xl border px-3 py-2 text-sm">
                {job?.intervenants?.length ? job.intervenants.join(", ") : "—"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                (Les intervenants se gèrent depuis le planning : création / édition chantier)
              </div>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <div className="text-2xl font-bold">Adresse & contact</div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">Adresse du chantier</label>
              <input className={INPUT} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="Adresse complète" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Contact</label>
              <input className={INPUT} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nom / Société" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Téléphone</label>
              <input className={INPUT} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="06..." />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">Email</label>
              <input className={INPUT} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@email.fr" />
            </div>
          </div>
        </div>

        <div className={CARD}>
          <div className="text-2xl font-bold">Notes</div>
          <div className="mt-3">
            <textarea className={`${INPUT} min-h-[120px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className={CARD}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-bold">Produits utilisés</div>
              <div className="text-slate-600 mt-1">Ajoute les produits / doses / remarques (pour le PDF).</div>
            </div>

            <button onClick={refreshAll} className="rounded-xl border px-4 py-3 font-semibold hover:bg-slate-50" type="button" disabled={saving}>
              Rafraîchir
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">Nom</label>
              <input className={INPUT} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Ex: Désinfectant virucide" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Quantité</label>
              <input className={INPUT} value={pQty} onChange={(e) => setPQty(e.target.value)} placeholder="Ex: 2" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Unité</label>
              <input className={INPUT} value={pUnit} onChange={(e) => setPUnit(e.target.value)} placeholder="L / ml / kg / etc" />
            </div>
            <div className="md:col-span-4">
              <label className="block text-sm font-semibold mb-1">Notes</label>
              <input className={INPUT} value={pNotes} onChange={(e) => setPNotes(e.target.value)} placeholder="Remarque / dilution / zone" />
            </div>
          </div>

          <div className="mt-3">
            <button onClick={addProduct} className={`rounded-xl px-4 py-2 font-semibold hover:opacity-95 ${FOREST_BTN}`} type="button" disabled={saving}>
              + Ajouter produit
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {products.length === 0 ? (
              <div className="text-sm text-slate-600">Aucun produit.</div>
            ) : (
              products.map((p) => (
                <div key={p.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {p.quantity !== null ? `${p.quantity}` : "—"} {p.unit ? p.unit : ""}
                      {p.notes ? <span className="ml-2">• {p.notes}</span> : null}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    type="button"
                    disabled={saving}
                  >
                    Supprimer
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={CARD}>
          <div className="text-2xl font-bold">Photos & documents</div>
          <div className="text-slate-600 mt-1">
            Pour l’instant : ajout par URL (propre et fiable). Ensuite on branchera l’upload direct.
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Type</label>
              <select className={INPUT} value={aKind} onChange={(e) => setAKind(e.target.value as any)}>
                <option value="PHOTO">PHOTO</option>
                <option value="DOCUMENT">DOCUMENT</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-semibold mb-1">Label</label>
              <input className={INPUT} value={aLabel} onChange={(e) => setALabel(e.target.value)} placeholder='Ex: "Avant - Cuisine"' />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">fileType (MIME)</label>
              <input className={INPUT} value={aType} onChange={(e) => setAType(e.target.value)} placeholder="image/jpeg, application/pdf…" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">URL fichier</label>
              <input className={INPUT} value={aUrl} onChange={(e) => setAUrl(e.target.value)} placeholder="/uploads/xxx.jpg ou https://..." />
            </div>
          </div>

          <div className="mt-3">
            <button onClick={addAttachment} className={`rounded-xl px-4 py-2 font-semibold hover:opacity-95 ${FOREST_BTN}`} type="button" disabled={saving}>
              + Ajouter
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-lg font-bold">Photos</div>
              <div className="mt-3 space-y-2">
                {photos.length === 0 ? (
                  <div className="text-sm text-slate-600">Aucune photo.</div>
                ) : (
                  photos.map((a) => (
                    <div key={a.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{a.fileLabel}</div>
                        <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 break-all">
                          {a.fileUrl}
                        </a>
                        <div className="text-xs text-slate-500 mt-1">{a.fileType}</div>
                      </div>
                      <button
                        onClick={() => deleteAttachment(a.id)}
                        className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        type="button"
                        disabled={saving}
                      >
                        Supprimer
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-lg font-bold">Documents</div>
              <div className="mt-3 space-y-2">
                {docs.length === 0 ? (
                  <div className="text-sm text-slate-600">Aucun document.</div>
                ) : (
                  docs.map((a) => (
                    <div key={a.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{a.fileLabel}</div>
                        <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 break-all">
                          {a.fileUrl}
                        </a>
                        <div className="text-xs text-slate-500 mt-1">{a.fileType}</div>
                      </div>
                      <button
                        onClick={() => deleteAttachment(a.id)}
                        className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        type="button"
                        disabled={saving}
                      >
                        Supprimer
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          Astuce : une fois tout rempli, clique <span className="font-semibold">Ouvrir PDF</span> en haut.
        </div>
      </div>
    </main>
  );
}
