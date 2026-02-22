"use client";

import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { DndContext, rectIntersection, useDraggable, useDroppable } from "@dnd-kit/core";

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

/** ---------- Utils ---------- */
const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** ---------- Page Principale ---------- */
export default function Page() {
  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);

  // Form states
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
    // Charger les photos
    try {
      const res = await fetch(`/api/chantiers/${ev.id}/photos`);
      if (res.ok) setPhotos(await res.json());
    } catch { setPhotos([]); }
  };

  const handleSave = async () => {
    const payload = { title: formTitle, startDate: formStart, endDate: formEnd };
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/chantiers/${editingId}` : "/api/chantiers";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setModalOpen(false);
    refresh();
  };

  /** * LOGIQUE D'UPLOAD SÉCURISÉE 
   * On envoie les fichiers un par un avec la clé exacte "file" 
   * pour correspondre au code : const single = form.get("file");
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || !editingId) return;

    setUploading(true);
    
    try {
      for (const file of files) {
        const formData = new FormData();
        // C'est cette ligne qui doit matcher EXACTEMENT ton API
        formData.append("file", file); 

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          // IMPORTANT : Ne pas ajouter de headers (le navigateur s'en occupe)
          body: formData,
        });

        const result = await res.json();

        if (!res.ok) {
          console.error("Erreur API:", result);
          throw new Error(result.error || "Erreur lors de l'envoi");
        }

        // On ajoute le nouvel attachement à la liste
        setPhotos(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
      }
      alert("Upload réussi !");
    } catch (err: any) {
      alert("ÉCHEC : " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 bg-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">PHOENIX PLANNING</h1>
          <button onClick={() => { setEditingId(null); setModalOpen(true); }} className="bg-[#183536] text-white px-4 py-2 rounded-lg text-sm font-bold">+ Nouveau</button>
        </div>

        {/* Grille simplifiée pour le test */}
        <div className="bg-white p-4 rounded-xl shadow-sm grid grid-cols-7 gap-1">
          {events.map(ev => (
            <div key={ev.id} onClick={() => openEdit(ev)} className="bg-emerald-700 text-white p-2 rounded text-[10px] cursor-pointer font-bold">
              {ev.title}
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold">Chantier : {formTitle || "Nouveau"}</h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="p-6 space-y-4">
              <input className="w-full border p-3 rounded-lg" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Titre" />
              
              <div className="p-4 border-2 border-dashed rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-slate-400">Photos</span>
                  <button 
                    disabled={!editingId || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-bold disabled:bg-slate-300"
                  >
                    {uploading ? "ENVOI EN COURS..." : "CHOISIR DES PHOTOS"}
                  </button>
                </div>
                
                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleUpload} />

                <div className="grid grid-cols-3 gap-2">
                  {photos.map(p => (
                    <div key={p.id} className="aspect-square bg-slate-200 rounded-lg overflow-hidden border">
                      <img src={p.fileUrl} className="w-full h-full object-cover" alt="chantier" />
                    </div>
                  ))}
                </div>
                {!editingId && <p className="text-[10px] text-red-500 text-center font-bold italic">Enregistrez d'abord le chantier pour débloquer l'upload.</p>}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex gap-2">
              <button onClick={handleSave} className="flex-1 bg-emerald-800 text-white py-3 rounded-xl font-bold">ENREGISTRER</button>
              <button onClick={() => setModalOpen(false)} className="px-4 bg-slate-200 rounded-xl font-bold">ANNULER</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}