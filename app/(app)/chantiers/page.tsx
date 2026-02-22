"use client";

import React, { useEffect, useRef, useState, type CSSProperties } from "react";

/** ---------- Interfaces ---------- */
interface ChantierEvent {
  id: string;
  type: string;
  title: string;
  startDate: string;
  endDate: string;
}

interface PhotoDTO {
  id: string;
  fileUrl: string;
  fileLabel: string;
}

const toISODate = (d: Date) => d.toISOString().split('T')[0];

export default function Page() {
  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);

  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState(toISODate(new Date()));
  const [formEnd, setFormEnd] = useState(toISODate(new Date()));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const res = await fetch("/api/chantiers?archived=false");
    if (res.ok) setEvents(await res.json());
  };

  useEffect(() => { refresh(); }, []);

  const openEdit = async (ev: ChantierEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormStart(ev.startDate);
    setFormEnd(ev.endDate);
    setModalOpen(true);
    try {
      const res = await fetch(`/api/chantiers/${ev.id}/photos`);
      if (res.ok) setPhotos(await res.json());
    } catch { setPhotos([]); }
  };

  const handleSave = async () => {
    const payload = { title: formTitle, startDate: formStart, endDate: formEnd };
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/chantiers/${editingId}` : "/api/chantiers";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setModalOpen(false); refresh(); }
  };

  /** * LOGIQUE D'UPLOAD : LE DERNIER ESPOIR POUR LE STATUT 400
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0 || !editingId) return;

    setUploading(true);
    
    try {
      for (const file of selectedFiles) {
        // Création d'un FormData tout neuf pour chaque fichier
        const body = new FormData();
        
        // IMPORTANT : On force le nom "file" comme attendu par ton API
        // On ajoute aussi le nom du fichier pour aider le serveur
        body.append("file", file, file.name); 

        // On log l'envoi pour débugger dans ta console F12
        console.log("Envoi du fichier:", file.name, "Taille:", file.size);

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          // SURTOUT : Ne pas mettre de Content-Type.
          // Le navigateur doit générer lui-même le boundary du multipart/form-data.
          body: body,
        });

        const result = await res.json();

        if (!res.ok) {
          // Si statut 400, on affiche les clés que le serveur a réellement reçu
          console.error("Le serveur n'a pas trouvé le fichier. Reçu:", result.receivedKeys);
          throw new Error(result.error || "Erreur 400");
        }

        const newImgs = Array.isArray(result) ? result : [result];
        setPhotos(prev => [...prev, ...newImgs]);
      }
      alert("Upload terminé !");
    } catch (err: any) {
      alert("ERREUR : " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm flex justify-between items-center border border-slate-200">
          <h1 className="font-black text-slate-800">PHOENIX PLANNING</h1>
          <button onClick={() => { setEditingId(null); setModalOpen(true); setPhotos([]); }} className="bg-[#183536] text-white px-6 py-2 rounded-xl font-bold">+ Nouveau</button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {events.map(ev => (
            <div key={ev.id} onClick={() => openEdit(ev)} className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
              <span className="font-bold">{ev.title}</span>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="font-bold text-lg">Chantier</h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="p-6 space-y-6">
              <input className="w-full border-2 p-3 rounded-xl font-bold" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Titre" />
              
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase">Photos (F12 pour voir les logs)</span>
                  <button 
                    disabled={!editingId || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:bg-slate-300"
                  >
                    {uploading ? "UPLOAD EN COURS..." : "+ AJOUTER"}
                  </button>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleUpload} />

                <div className="grid grid-cols-4 gap-2">
                  {photos.map(p => (
                    <div key={p.id} className="aspect-square bg-white rounded-lg overflow-hidden border">
                      <img src={p.fileUrl} className="w-full h-full object-cover" alt="img" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex gap-2">
              <button onClick={handleSave} className="flex-1 bg-[#183536] text-white py-3 rounded-xl font-bold">ENREGISTRER</button>
              <button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 rounded-xl font-bold text-slate-500">FERMER</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}