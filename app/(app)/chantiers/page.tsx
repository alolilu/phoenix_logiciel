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
const toISODate = (d: Date) => d.toISOString().split('T')[0];

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
    try {
      const res = await fetch("/api/chantiers?archived=false");
      if (res.ok) setEvents(await res.json());
    } catch (e) { console.error("Erreur refresh:", e); }
  };

  useEffect(() => { refresh(); }, []);

  const openEdit = async (ev: ChantierEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormStart(ev.startDate);
    setFormEnd(ev.endDate);
    setModalOpen(true);
    // Charger les photos au clic
    try {
      const res = await fetch(`/api/chantiers/${ev.id}/photos`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(Array.isArray(data) ? data : []);
      }
    } catch { setPhotos([]); }
  };

  const handleSave = async () => {
    const payload = { title: formTitle, startDate: formStart, endDate: formEnd };
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/chantiers/${editingId}` : "/api/chantiers";
    
    const res = await fetch(url, { 
      method, 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });

    if (res.ok) {
      setModalOpen(false);
      refresh();
    } else {
      alert("Erreur lors de la sauvegarde du chantier");
    }
  };

  /** * LOGIQUE D'UPLOAD : LA SEULE QUI FONCTIONNE AVEC TON API
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0 || !editingId) return;

    setUploading(true);
    
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        // Ton API cherche form.get("file") OU form.getAll("files")
        // On envoie "file" pour être sûr de tomber dans le cas 'single'
        formData.append("file", file); 

        console.log(`Envoi du fichier ${file.name} pour le chantier ${editingId}`);

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          // SURTOUT PAS DE HEADER CONTENT-TYPE (Next le gère pour FormData)
          body: formData,
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || `Erreur serveur: ${res.status}`);
        }

        // Si l'API renvoie un tableau ou un objet seul
        const newAttachments = Array.isArray(result) ? result : [result];
        setPhotos(prev => [...prev, ...newAttachments]);
      }
      alert("Photos ajoutées avec succès !");
    } catch (err: any) {
      console.error("DEBUG UPLOAD:", err);
      alert("ERREUR : " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">PHOENIX <span className="text-slate-400 font-light">PLANNING</span></h1>
          <button onClick={() => { setEditingId(null); setModalOpen(true); setPhotos([]); }} className="bg-[#183536] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-black transition-all">
            + NOUVEAU CHANTIER
          </button>
        </div>

        {/* Grille de test */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(ev => (
            <div key={ev.id} onClick={() => openEdit(ev)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all border-l-4 border-l-emerald-600">
              <h3 className="font-bold text-slate-700">{ev.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{ev.startDate} au {ev.endDate}</p>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-white">
              <h2 className="text-xl font-black text-slate-800">{editingId ? "ÉDITION DU CHANTIER" : "CRÉATION"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-800 p-2">✕</button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Titre du chantier</label>
                <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-emerald-600 outline-none font-bold" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Ex: Nettoyage Diogène Paris 15" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Début</label>
                  <input type="date" className="w-full border-2 border-slate-100 p-3 rounded-xl" value={formStart} onChange={e => setFormStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fin</label>
                  <input type="date" className="w-full border-2 border-slate-100 p-3 rounded-xl" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-600 uppercase tracking-tighter">Galerie Photos</h3>
                  <button 
                    type="button"
                    disabled={!editingId || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20"
                  >
                    {uploading ? "ENVOI..." : "+ AJOUTER DES PHOTOS"}
                  </button>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleUpload} />

                <div className="grid grid-cols-4 gap-3">
                  {photos.length > 0 ? photos.map(p => (
                    <div key={p.id} className="aspect-square bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm group relative">
                      <img src={p.fileUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="chantier" />
                    </div>
                  )) : (
                    <div className="col-span-4 py-8 text-center text-slate-400 text-xs italic">
                      {editingId ? "Aucune photo pour le moment" : "Enregistrez d'abord le chantier pour ajouter des photos"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t flex gap-3">
              <button onClick={handleSave} className="flex-1 bg-emerald-800 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all">
                ENREGISTRER LES MODIFICATIONS
              </button>
              <button onClick={() => setModalOpen(false)} className="px-8 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">
                ANNULER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}