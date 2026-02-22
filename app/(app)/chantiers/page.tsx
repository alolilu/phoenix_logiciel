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

/** ---------- Interfaces & Types ---------- */

type ChantierStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE";

const CHANTIER_TYPES = [
  "Diogène",
  "Post-mortem",
  "Insalubre",
  "Dératisation",
  "Désinsectisation",
  "Scène de crime",
  "Devis",
  "Débarras",
] as const;

type ChantierType = (typeof CHANTIER_TYPES)[number];

interface ChantierEvent {
  id: string;
  type: ChantierType | string;
  title: string;
  startDate: string;
  endDate: string;
  status: ChantierStatus;
  archived: boolean;
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

interface GridProps {
  cursor: Date;
  events: ChantierEvent[];
  onCellClick: (iso: string) => void;
  onEventClick: (id: string) => void;
  onMore?: (iso: string, rect: DOMRect) => void;
}

/** ---------- Utils ---------- */

const FOREST_BTN = "bg-[#183536] text-white hover:bg-[#122a2b] transition-colors disabled:opacity-50";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, days: number) { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; }
function startOfWeekMonday(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return startOfDay(addDays(d, diff));
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function inRangeISO(dateISO: string, startISO: string, endISO: string) { return dateISO >= startISO && dateISO <= endISO; }
function isTodayISO(iso: string) { return iso === toISODate(startOfDay(new Date())); }

function getChantierColor(typeLabel: string) {
  const CHANTIER_COLORS: Record<string, string> = {
    diogene: "#C46A1A",
    "post-mortem": "#8B1E1E",
    insalubre: "#7C2D12",
    debarras: "#2563EB",
    devis: "#6B7280",
  };
  const key = typeLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return CHANTIER_COLORS[key] ?? "#334155";
}

/** Parsing Client */
const CLIENT_START = "[[CLIENT]]";
const CLIENT_END = "[[/CLIENT]]";

function extractClientBlock(notesRaw: string | undefined) {
  const raw = String(notesRaw ?? "");
  const empty: ClientInfo = { nom: "", tel: "", email: "", adresse: "" };
  const start = raw.indexOf(CLIENT_START);
  const end = raw.indexOf(CLIENT_END);
  if (start === -1 || end === -1) return { client: empty, rest: raw.trim() };
  const block = raw.slice(start + CLIENT_START.length, end).trim();
  const rest = (raw.slice(0, start) + raw.slice(end + CLIENT_END.length)).trim();
  const client = { ...empty };
  block.split(/\r?\n/).forEach(line => {
    const [k, ...vv] = line.split("=");
    const key = (k || "").trim().toLowerCase();
    const val = vv.join("=").trim();
    if (key === "nom") client.nom = val;
    else if (key === "tel" || key === "telephone") client.tel = val;
    else if (key === "email") client.email = val;
    else if (key === "adresse") client.adresse = val;
  });
  return { client, rest };
}

function buildNotesWithClient(client: ClientInfo, rest: string) {
  const hasAny = client.nom.trim() || client.tel.trim() || client.email.trim() || client.adresse.trim();
  if (!hasAny) return rest.trim();
  return `${CLIENT_START}\nNom=${client.nom}\nTel=${client.tel}\nEmail=${client.email}\nAdresse=${client.adresse}\n${CLIENT_END}\n\n${rest.trim()}`;
}

/** ---------- API ---------- */

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur API");
  return data;
}

/** ---------- UI Components ---------- */

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-bold text-xl">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function DraggablePill({ draggableId, style, children, onClick }: { draggableId: string; style?: CSSProperties; children: React.ReactNode; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: draggableId });
  const dndStyle: CSSProperties | undefined = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={dndStyle} className={isDragging ? "opacity-40 z-50" : "z-10"}>
      <div style={style} className="w-full rounded-md px-2 py-1 text-[11px] font-bold cursor-grab text-white truncate" onClick={(e) => { e.stopPropagation(); onClick(); }} {...listeners} {...attributes}>
        {children}
      </div>
    </div>
  );
}

function DroppableDayCell({ iso, dayNumber, faded, children, onClick }: { iso: string; dayNumber: number; faded: boolean; children: React.ReactNode; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${iso}` });
  const today = isTodayISO(iso);
  return (
    <div ref={setNodeRef} onClick={onClick} className={`min-h-[110px] border p-1 transition-all ${faded ? "bg-slate-50 opacity-50" : "bg-white"} ${isOver ? "bg-blue-50" : ""} ${today ? "ring-2 ring-inset ring-[#183536]" : ""}`}>
      <div className="text-right text-[11px] font-bold text-slate-400">{dayNumber}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** ---------- Main Page ---------- */

export default function Page() {
  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<ChantierType>("Diogène");
  const [formStart, setFormStart] = useState(toISODate(new Date()));
  const [formEnd, setFormEnd] = useState(toISODate(new Date()));
  const [client, setClient] = useState<ClientInfo>({ nom: "", tel: "", email: "", adresse: "" });
  const [formNotes, setFormNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const data = await apiRequest<ChantierEvent[]>("/api/chantiers?archived=false");
    setEvents(data);
  };

  useEffect(() => { refresh(); }, []);

  const openEdit = async (ev: ChantierEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormType(ev.type);
    setFormStart(ev.startDate);
    setFormEnd(ev.endDate);
    const { client: c, rest } = extractClientBlock(ev.notes);
    setClient(c); setFormNotes(rest);
    setModalOpen(true);
    try {
      const p = await apiRequest<PhotoDTO[]>(`/api/chantiers/${ev.id}/photos`);
      setPhotos(p);
    } catch { setPhotos([]); }
  };

  const handleSave = async () => {
    const notes = buildNotesWithClient(client, formNotes);
    const payload = { title: formTitle, type: formType, startDate: formStart, endDate: formEnd, notes };
    if (editingId) await apiRequest(`/api/chantiers/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    else await apiRequest("/api/chantiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setModalOpen(false);
    refresh();
  };

  // --- CORRECTION UPLOAD ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || !editingId) return;

    setUploading(true);
    const fd = new FormData();
    // ON UTILISE "files" AVEC UN S (comme attendu par ton API)
    files.forEach(f => fd.append("files", f));

    try {
      const res = await fetch(`/api/chantiers/${editingId}/photos`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPhotos(prev => [...prev, ...data]);
    } catch (err: any) {
      alert("Erreur: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 bg-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border">
          <h1 className="text-2xl font-black text-[#183536]">PHOENIX</h1>
          <button onClick={() => { setEditingId(null); setModalOpen(true); }} className={`px-6 py-2 rounded-xl font-bold ${FOREST_BTN}`}>+ Créer</button>
        </header>

        <main className="bg-white rounded-3xl shadow-xl border overflow-hidden">
          <DndContext sensors={sensors} collisionDetection={rectIntersection}>
            <MonthGrid cursor={new Date()} events={events} onCellClick={(iso) => { setFormStart(iso); setFormEnd(iso); setModalOpen(true); }} onEventClick={(id) => openEdit(events.find(e => e.id === id)!)} />
          </DndContext>
        </main>
      </div>

      <Modal open={modalOpen} title={editingId ? "Modifier" : "Nouveau"} onClose={() => setModalOpen(false)}>
        <div className="space-y-6">
          <input className="w-full border-2 p-3 rounded-xl font-medium" placeholder="Titre" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
          
          <section className="bg-slate-50 p-4 rounded-2xl space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase">Client</label>
            <input className="w-full border p-2 rounded-lg text-sm" placeholder="Nom" value={client.nom} onChange={e => setClient({...client, nom: e.target.value})} />
            <input className="w-full border p-2 rounded-lg text-sm" placeholder="Tel" value={client.tel} onChange={e => setClient({...client, tel: e.target.value})} />
            <textarea className="w-full border p-2 rounded-lg text-sm" placeholder="Adresse" value={client.adresse} onChange={e => setClient({...client, adresse: e.target.value})} />
          </section>

          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-400 uppercase">Photos</label>
              <button type="button" onClick={() => editingId ? fileInputRef.current?.click() : alert("Enregistrez d'abord")} className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                {uploading ? "Chargement..." : "+ AJOUTER"}
              </button>
            </div>
            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
            <div className="grid grid-cols-4 gap-2">
              {photos.map(p => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border">
                  <img src={p.fileUrl} className="object-cover w-full h-full" alt="chantier" />
                </div>
              ))}
            </div>
          </section>

          <button onClick={handleSave} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest ${FOREST_BTN}`}>Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}

function MonthGrid({ cursor, events, onCellClick, onEventClick }: GridProps) {
  const gridStart = startOfWeekMonday(startOfMonth(cursor));
  const days = Array.from({ length: 35 }).map((_, i) => addDays(gridStart, i));
  return (
    <div className="grid grid-cols-7 bg-slate-100 gap-[1px] border-t border-l">
      {days.map(d => {
        const iso = toISODate(d);
        const dayEvents = events.filter(e => inRangeISO(iso, e.startDate, e.endDate));
        return (
          <DroppableDayCell key={iso} iso={iso} dayNumber={d.getDate()} faded={d.getMonth() !== cursor.getMonth()} onClick={() => onCellClick(iso)}>
            {dayEvents.slice(0, 3).map(e => (
              <DraggablePill key={e.id} draggableId={`${e.id}@${iso}`} style={{ backgroundColor: getChantierColor(e.type) }} onClick={() => onEventClick(e.id)}>
                {e.title}
              </DraggablePill>
            ))}
          </DroppableDayCell>
        );
      })}
    </div>
  );
}