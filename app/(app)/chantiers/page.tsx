"use client";
import React, { useState, useRef, useEffect } from "react";

export default function ChantiersPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const res = await fetch("/api/chantiers?archived=false");
    if (res.ok) setEvents(await res.json());
  };

  useEffect(() => { refresh(); }, []);

  const openEdit = async (ev: any) => {
    setEditingId(ev.id);
    setModalOpen(true);
    setPhotos([]); 
    const res = await fetch(`/api/chantiers/${ev.id}/photos`);
    if (res.ok) setPhotos(await res.json());
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length || !editingId) return;

    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        // C'est cette ligne qui corrige l'erreur 400 :
        fd.append("file", file); 

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          body: fd,
          // NE PAS mettre de Content-Type ici
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur upload");
        setPhotos(prev => [data, ...prev]);
      }
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold">Planning Interventions</h1>
        <button onClick={() => { setEditingId(null); setModalOpen(true); }} className="bg-slate-800 text-white px-4 py-2 rounded">+ Nouveau</button>
      </div>

      <div className="grid gap-4">
        {events.map(ev => (
          <div key={ev.id} onClick={() => openEdit(ev)} className="p-4 bg-white border rounded shadow-sm cursor-pointer hover:border-blue-500 transition-all">
            <h3 className="font-bold">{ev.title}</h3>
            <p className="text-sm text-gray-500">{ev.startDate}</p>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Gestion des Photos</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-black">✕</button>
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleUpload} />
            
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center mb-6">
              <button 
                disabled={uploading || !editingId}
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition-all shadow-lg shadow-emerald-600/20"
              >
                {uploading ? "ENVOI EN COURS..." : "SÉLECTIONNER DES PHOTOS"}
              </button>
              {!editingId && <p className="text-xs text-red-500 mt-2 italic">Enregistrez d'abord le chantier</p>}
            </div>

            <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2">
              {photos.map(p => (
                <div key={p.id} className="aspect-square rounded-xl overflow-hidden border shadow-sm">
                  <img src={p.fileUrl} className="w-full h-full object-cover" alt="chantier" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}