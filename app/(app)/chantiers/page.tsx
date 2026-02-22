"use client";

import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

/** ---------- Interfaces ---------- */

type ChantierStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE";
const CHANTIER_TYPES = ["Diogène", "Post-mortem", "Insalubre", "Dératisation", "Désinsectisation", "Scène de crime", "Devis", "Débarras"] as const;
type ChantierType = (typeof CHANTIER_TYPES)[number];

interface ChantierEvent {
  id: string;
  type: string;
  title: string;
  startDate: string;
  endDate: string;
  status: ChantierStatus;
  notes?: string;
}

interface PhotoDTO {
  id: string;
  fileUrl: string;
  fileLabel: string;
}

interface ClientInfo {
  nom: string;
  tel: string;
  email: string;
  adresse: string;
}

/** ---------- Utils ---------- */

const FOREST_BTN = "bg-[#183536] text-white hover:bg-[#122a2b] transition-colors disabled:opacity-50";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfWeekMonday(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const nd = new Date(d);
  nd.setDate(d.getDate() + diff);
  return nd;
}
function isTodayISO(iso: string) { return iso === toISODate(new Date()); }

function getChantierColor(type: string) {
  const colors: Record<string, string> = { diogene: "#C46A1A", "post-mortem": "#8B1E1E", insalubre: "#7C2D12", debarras: "#2563EB" };
  const key = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return colors[key] ?? "#334155";
}

/** ---------- Composants Internes ---------- */

function DraggablePill({ e, onClick }: { e: ChantierEvent, onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: e.id });
  const style: CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="z-10">
      <div 
        onClick={(ev) => { ev.stopPropagation(); onClick(); }}
        style={{ backgroundColor: getChantierColor(e.type) }}
        className="w-full rounded-md px-2 py-1 text-[10px] font-bold text-white truncate cursor-grab shadow-sm"
      >
        {e.title}
      </div>
    </div>
  );
}

function DroppableCell({ iso, day, faded, children, onClick }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${iso}` });
  return (
    <div 
      ref={setNodeRef} 
      onClick={onClick}
      className={`min-h-[100px] border p-1 transition-colors ${faded ? "bg-slate-50 opacity-40" : "bg-white"} ${isOver ? "bg-emerald-50" : ""} ${isTodayISO(iso) ? "ring-2 ring-inset ring-emerald-500" : ""}`}
    >
      <div className="text-right text-[10px] font-bold text-slate-400">{day}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** ---------- Page Principale ---------- */

export default function Page() {
  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState(toISODate(new Date()));
  const [formEnd, setFormEnd] = useState(toISODate(new Date()));
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);

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
    // Fetch photos
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

  /** SOLUTION DEFINITIVE UPLOAD */
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || !editingId) return;

    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        // On envoie un seul fichier avec la clé "file" (match le 'single' de ton API)
        fd.append("file", file);

        const res = await fetch(`/api/chantiers/${editingId}/photos`, {
          method: "POST",
          body: fd, // SURTOUT PAS DE HEADER CONTENT-TYPE
        });

        if (!res.ok) {
          const errorMsg = await res.text();
          console.error("Erreur API détail:", errorMsg);
          throw new Error("Erreur lors de l'envoi");
        }

        const newImgs = await res.json();
        setPhotos(prev => [...prev, ...(Array.isArray(newImgs) ? newImgs : [newImgs])]);
      }
    } catch (err) {
      alert("Erreur d'upload. Vérifiez la console.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Grid Logic
  const gridStart = startOfWeekMonday(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const days = Array.from({ length: 35 }).map((_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  return (
    <div className="p-4 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-xl font-black text-[#183536]">PHOENIX <span className="text-slate-300">ADMIN</span></h1>
          <button onClick={() => { setEditingId(null); setModalOpen(true); }} className={`px-4 py-2 rounded-lg font-bold text-sm ${FOREST_BTN}`}>
            + Nouveau Chantier
          </button>
        </header>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <DndContext collisionDetection={rectIntersection}>
            <div className="grid grid-cols-7 bg-slate-200 gap-[1px]">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(d => (
                <div key={d} className="bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
              ))}
              {days.map(d => {
                const iso = toISODate(d);
                return (
                  <DroppableCell key={iso} iso={iso} day={d.getDate()} faded={d.getMonth() !== new Date().getMonth()} onClick={() => { setFormStart(iso); setFormEnd(iso); setModalOpen(true); }}>
                    {events.filter(e => iso >= e.startDate && iso <= e.endDate).map(e => (
                      <DraggablePill key={e.id} e={e} onClick={() => openEdit(e)} />
                    ))}
                  </DroppableCell>
                );
              })}
            </div>
          </DndContext>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-bold">Détails Chantier</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-black">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <input className="w-full border-2 p-3 rounded-xl focus:border-emerald-500 outline-none" placeholder="Nom du chantier" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="border p-2 rounded-lg text-sm" value={formStart} onChange={e => setFormStart(e.target.value)} />
                <input type="date" className="border p-2 rounded-lg text-sm" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Photos</span>
                  <button 
                    type="button"
                    disabled={uploading || !editingId}
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded"
                  >
                    {uploading ? "Envoi..." : "+ AJOUTER DES PHOTOS"}
                  </button>
                </div>
                <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={onFileChange} />
                
                <div className="grid grid-cols-3 gap-2">
                  {photos.map(p => (
                    <div key={p.id} className="aspect-square rounded-lg border bg-slate-100 overflow-hidden relative group">
                      <img src={p.fileUrl} className="w-full h-full object-cover" alt="chantier" />
                      <a href={p.fileUrl} target="_blank" className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold">OUVRIR</a>
                    </div>
                  ))}
                  {!editingId && <div className="col-span-3 text-[10px] text-amber-600 bg-amber-50 p-2 rounded text-center">Enregistrez le chantier avant d'ajouter des photos</div>}
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50">
              <button onClick={handleSave} className={`w-full py-3 rounded-xl font-bold uppercase text-xs tracking-widest ${FOREST_BTN}`}>
                Enregistrer les données
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}