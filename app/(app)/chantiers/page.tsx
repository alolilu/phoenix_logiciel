"use client";

import React, { useEffect, useRef, useState } from "react";

type ChantierItem = {
  id: string;
  title: string;
  status?: string;
};

type PhotoItem = {
  id: string;
  fileUrl: string;
  fileLabel?: string | null;
};

export default function ChantiersPage() {
  const [events, setEvents] = useState<ChantierItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setError(null);
    try {
      const res = await fetch("/api/chantiers?archived=false");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Erreur chargement chantiers (${res.status})`);
      }

      setEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Erreur chargement chantiers");
    }
  }

  async function refreshPhotos(jobId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/chantiers/${jobId}/photos`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Erreur chargement photos (${res.status})`);
      }

      setPhotos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Erreur chargement photos");
      setPhotos([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function openEdit(ev: ChantierItem) {
    setEditingId(ev.id);
    setModalOpen(true);
    setPhotos([]);
    await refreshPhotos(ev.id);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setPhotos([]);
    setUploading(false);
    setSaving(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length || !editingId) return;

    setUploading(true);
    setError(null);

    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          body: fd,
        });

        const result = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(result?.error || `Erreur upload (${res.status})`);
        }
      }

      await refreshPhotos(editingId);
      alert("Photo ajoutée avec succès.");
    } catch (err: any) {
      setError(err?.message || "Erreur upload photo");
      alert("ERREUR : " + (err?.message || "Erreur upload photo"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function finishAndOpenPdf() {
    if (!editingId) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/chantiers/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "TERMINE",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Erreur mise à jour chantier (${res.status})`);
      }

      await refresh();

      window.open(`/api/chantiers/${editingId}/pdf`, "_blank", "noopener,noreferrer");

      closeModal();
    } catch (err: any) {
      setError(err?.message || "Erreur Terminer + PDF");
      alert("ERREUR : " + (err?.message || "Erreur Terminer + PDF"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-black text-red-600">PHOENIX TEST V2</h1>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {events.map((ev) => (
          <div
            key={ev.id}
            onClick={() => openEdit(ev)}
            className="cursor-pointer rounded-xl border bg-white p-4 shadow-sm hover:border-blue-500"
          >
            <h3 className="font-bold">{ev.title}</h3>
            {ev.status ? <div className="mt-1 text-sm text-slate-500">{ev.status}</div> : null}
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex justify-between">
              <h2 className="text-lg font-bold">Photos / Action chantier</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={handleUpload}
            />

            <div className="space-y-3">
              <button
                type="button"
                disabled={uploading || saving}
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:bg-slate-300"
              >
                {uploading ? "ENVOI..." : "SÉLECTIONNER UNE PHOTO"}
              </button>

              <button
                type="button"
                disabled={uploading || saving || !editingId}
                onClick={finishAndOpenPdf}
                className="w-full rounded-xl bg-[#183536] py-3 font-bold text-white disabled:bg-slate-300"
              >
                {saving ? "TRAITEMENT..." : "TERMINER + PDF"}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <img
                  key={p.id}
                  src={p.fileUrl}
                  alt={p.fileLabel || "Photo chantier"}
                  className="aspect-square w-full rounded-lg border object-cover"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}