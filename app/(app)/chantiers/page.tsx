"use client";

import React, { useState, useRef, useEffect } from "react";

export default function ChantiersPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [formTitle, setFormTitle] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const res = await fetch("/api/chantiers?archived=false");
    if (res.ok) setEvents(await res.json());
  };

  useEffect(() => { refresh(); }, []);

  const openEdit = async (ev: any) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setModalOpen(true);
    setPhotos([]); 
    try {
      const res = await fetch(`/api/chantiers/${ev.id}/photos`);
      if (res.ok) setPhotos(await res.json());
    } catch (err) {
      console.error("Erreur photos");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || !editingId) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file); // Clé "file" identique à l'API

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          body: formData, // On laisse le navigateur gérer le Content-Type
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Erreur upload");
        }

        const newPhoto = await res.json();
        setPhotos((prev) => [newPhoto, ...prev]);
      }
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border">
          <h1 className="text-xl font-black text-[#183536]">PHOENIX</h1>
          <button onClick={() => { setEditingId(null); setModalOpen(true); }} className="bg-[#183536] text-white px-6 py-2 rounded-xl font-bold">
            + NOUVEAU
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events.map((ev) => (
            <div key={ev.id} onClick={() => openEdit(ev)} className="bg-white p-5 rounded-2xl border shadow-sm cursor-pointer hover:border-emerald-500">
              <h3 className="font-bold">{ev.title}</h3>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-lg font-black">{formTitle || "Nouveau"}</h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border-2 border-dashed border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black uppercase text-slate-500">Photos</h3>
                <button 
                  disabled={!editingId || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  {uploading ? "UPLOAD..." : "+ AJOUTER"}
                </button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleUpload} />
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <img key={p.id} src={p.fileUrl} className="aspect-square w-full object-cover rounded-xl border" />
                ))}
              </div>
            </div>
            <button onClick={() => setModalOpen(false)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">FERMER</button>
          </div>
        </div>
      )}
    </div>
  );
}