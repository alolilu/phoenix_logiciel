"use client";

import React, { useEffect, useRef, useState } from "react";

export default function PlanningPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [formTitle, setFormTitle] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger la liste des chantiers
  const refresh = async () => {
    const res = await fetch("/api/chantiers?archived=false");
    if (res.ok) setEvents(await res.json());
  };

  useEffect(() => { refresh(); }, []);

  // Ouvrir le modal d'édition
  const openEdit = async (ev: any) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setModalOpen(true);
    setPhotos([]); // Reset galerie
    try {
      const res = await fetch(`/api/chantiers/${ev.id}/photos`);
      if (res.ok) setPhotos(await res.json());
    } catch (err) {
      console.error("Erreur chargement photos");
    }
  };

  // Logique d'upload fichier par fichier
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
          body: formData,
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Erreur upload");
        }

        const newPhoto = await res.json();
        setPhotos((prev) => [newPhoto, ...prev]); // Ajout en haut de liste
      }
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-xl font-black text-[#183536]">PHOENIX <span className="text-slate-400 font-medium">PLANNING</span></h1>
          <button 
             onClick={() => { setEditingId(null); setModalOpen(true); setFormTitle(""); setPhotos([]); }}
             className="bg-[#183536] text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 transition-all"
          >
            + NOUVEAU
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((ev) => (
            <div 
              key={ev.id} 
              onClick={() => openEdit(ev)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 cursor-pointer transition-all"
            >
              <h3 className="font-bold text-slate-800">{ev.title}</h3>
              <p className="text-xs text-slate-400 mt-2 uppercase font-semibold">{ev.status || "EN ATTENTE"}</p>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800">{editingId ? "MODIFIER" : "CRÉER"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-black text-xl">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nom du chantier</label>
                <input 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl focus:border-emerald-500 outline-none font-bold text-slate-700"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase">Photos du terrain</h3>
                  <button 
                    disabled={!editingId || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition-colors"
                  >
                    {uploading ? "UPLOAD..." : "+ AJOUTER"}
                  </button>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleUpload} />

                <div className="grid grid-cols-3 gap-3">
                  {photos.map((p) => (
                    <div key={p.id} className="aspect-square bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                      <img src={p.fileUrl} className="w-full h-full object-cover" alt="chantier" />
                    </div>
                  ))}
                  {!editingId && (
                    <div className="col-span-3 py-6 text-center text-xs text-amber-600 font-medium bg-amber-50 rounded-xl">
                      Enregistrez le chantier avant d'ajouter des photos.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t flex gap-3">
              <button className="flex-1 bg-[#183536] text-white py-3 rounded-xl font-bold uppercase tracking-wider text-sm shadow-lg shadow-[#183536]/20">
                Enregistrer
              </button>
              <button onClick={() => setModalOpen(false)} className="px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-xl font-bold text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}