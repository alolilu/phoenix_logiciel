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
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f); // On utilise "file" (clé unique)

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          body: fd,
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Erreur 400");
        
        setPhotos(prev => [result, ...prev]);
      }
      alert("Photo ajoutée avec succès !");
    } catch (err: any) {
      alert("ERREUR : " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8">
      {/* LE TITRE POUR LE TEST */}
      <h1 className="text-2xl font-black text-red-600 mb-6">PHOENIX TEST V2</h1>

      <div className="grid gap-4">
        {events.map(ev => (
          <div key={ev.id} onClick={() => openEdit(ev)} className="p-4 bg-white border rounded-xl shadow-sm cursor-pointer hover:border-blue-500">
            <h3 className="font-bold">{ev.title}</h3>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex justify-between mb-6">
              <h2 className="font-bold text-lg">Photos</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400">✕</button>
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
            
            <button 
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold disabled:bg-slate-300"
            >
              {uploading ? "ENVOI..." : "SÉLECTIONNER UNE PHOTO"}
            </button>

            <div className="grid grid-cols-3 gap-2 mt-6">
              {photos.map(p => (
                <img key={p.id} src={p.fileUrl} className="w-full aspect-square object-cover rounded-lg border" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}