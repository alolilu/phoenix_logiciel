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
        fd.append("file", file); // CLE "file" IMPERATIVE

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          body: fd,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur 400");
        setPhotos(prev => [data, ...prev]);
      }
    } catch (err: any) {
      alert("Erreur upload: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8">
      <div className="grid gap-4">
        {events.map(ev => (
          <div key={ev.id} onClick={() => openEdit(ev)} className="p-4 bg-white border rounded shadow-sm cursor-pointer">
            {ev.title}
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between mb-4">
              <h2 className="font-bold">Photos du chantier</h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleUpload} />
            
            <button 
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold disabled:bg-slate-300"
            >
              {uploading ? "UPLOAD EN COURS..." : "+ AJOUTER DES PHOTOS"}
            </button>

            <div className="grid grid-cols-3 gap-2 mt-4 max-h-60 overflow-y-auto">
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