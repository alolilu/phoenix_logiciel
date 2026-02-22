"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
type ViewMode = "jour" | "semaine" | "mois";

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
  intervenants: string[];
  notes?: string;
  updatedAt?: string;
}

interface PhotoDTO {
  id: string;
  fileUrl: string;
  fileLabel: string;
  uploadedAt: string;
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
  onPdf: (id: string) => void;
  onMore?: (iso: string, rect: DOMRect) => void;
}

/** ---------- Utils & Helpers ---------- */

const FOREST_BTN = "bg-[#183536] text-white hover:bg-[#122a2b] transition-colors";

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
function parseISODateUTC(iso: string) { return new Date(`${iso}T00:00:00.000Z`); }
function toISODateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function addDaysISO(iso: string, days: number) {
  const dt = parseISODateUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISODateUTC(dt);
}
function diffDays(startISO: string, endISO: string) {
  const s = parseISODateUTC(startISO).getTime();
  const e = parseISODateUTC(endISO).getTime();
  return Math.floor((e - s) / 86400000);
}
function isTodayISO(iso: string) { return iso === toISODate(startOfDay(new Date())); }

const CHANTIER_COLORS: Record<string, string> = {
  diogene: "#C46A1A",
  "post-mortem": "#8B1E1E",
  "scene de crime": "#1F2937",
  insalubre: "#7C2D12",
  debarras: "#2563EB",
  deratisation: "#4C1D95",
  desinsectisation: "#7C3AED",
  devis: "#6B7280",
};

function getChantierColor(typeLabel: string) {
  const key = typeLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return CHANTIER_COLORS[key] ?? "#334155";
}

/** Client Data Parsing */
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
    else if (key === "email" || key === "mail") client.email = val;
    else if (key === "adresse") client.adresse = val;
  });
  return { client, rest };
}

function buildNotesWithClient(client: ClientInfo, rest: string) {
  const hasAny = client.nom.trim() || client.tel.trim() || client.email.trim() || client.adresse.trim();
  if (!hasAny) return rest.trim();
  return `${CLIENT_START}\nNom=${client.nom}\nTel=${client.tel}\nEmail=${client.email}\nAdresse=${client.adresse}\n${CLIENT_END}\n\n${rest.trim()}`;
}

/** ---------- API Functions ---------- */

async function apiJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
  return res.json();
}

async function uploadPhotos(jobId: string, files: File[]): Promise<PhotoDTO[]> {
  const fd = new FormData();
  files.forEach(f => fd.append("file", f));
  return apiJSON<PhotoDTO[]>(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, { method: "POST", body: fd });
}

/** ---------- UI Components ---------- */

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-white sticky top-0">
          <h2 className="font-bold text-xl text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">{children}</div>
      </div>
    </div>
  );
}

function DraggablePill({ draggableId, style, children, onClick }: { draggableId: string; style?: CSSProperties; children: React.ReactNode; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: draggableId });
  const dndStyle: CSSProperties | undefined = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={dndStyle} className={isDragging ? "opacity-40 z-50" : "z-10"}>
      <div 
        style={style} 
        className="w-full rounded-md px-2 py-1.5 text-[11px] font-bold cursor-grab active:cursor-grabbing text-white truncate shadow-sm hover:brightness-110" 
        onClick={(e) => { e.stopPropagation(); onClick(); }} 
        {...listeners} 
        {...attributes}
      >
        {children}
      </div>
    </div>
  );
}

function DroppableDayCell({ iso, dayNumber, faded, children, onClick }: { iso: string; dayNumber: number; faded: boolean; children: React.ReactNode; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${iso}` });
  const today = isTodayISO(iso);
  return (
    <div 
      ref={setNodeRef} 
      onClick={onClick} 
      className={`min-h-[110px] border p-1 transition-all ${faded ? "bg-slate-50/50 opacity-50" : "bg-white"} ${isOver ? "bg-blue-50 ring-2 ring-blue-200 ring-inset" : ""} ${today ? "bg-amber-50/30" : ""}`}
    >
      <div className={`text-right text-[11px] font-bold mb-1 ${today ? "text-[#183536]" : "text-slate-400"}`}>
        {today ? "Aujourd'hui " : ""}{dayNumber}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** ---------- Page Principale ---------- */

export default function Page() {
  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [cursor] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<ChantierType>("Diogène");
  const [formStart, setFormStart] = useState(toISODate(new Date()));
  const [formEnd, setFormEnd] = useState(toISODate(new Date()));
  const [formStatus, setFormStatus] = useState<ChantierStatus>("EN_ATTENTE");
  const [client, setClient] = useState<ClientInfo>({ nom: "", tel: "", email: "", adresse: "" });
  const [formNotes, setFormNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const data = await apiJSON<ChantierEvent[]>("/api/chantiers?archived=false");
      setEvents(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { refresh(); }, []);

  const openNew = (dateISO?: string) => {
    setEditingId(null);
    setFormTitle("");
    setFormStart(dateISO || toISODate(new Date()));
    setFormEnd(dateISO || toISODate(new Date()));
    setClient({ nom: "", tel: "", email: "", adresse: "" });
    setFormNotes("");
    setPhotos([]);
    setModalOpen(true);
  };

  const openEdit = async (ev: ChantierEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormType(ev.type as ChantierType);
    setFormStart(ev.startDate);
    setFormEnd(ev.endDate);
    setFormStatus(ev.status);
    const { client: c, rest } = extractClientBlock(ev.notes);
    setClient(c);
    setFormNotes(rest);
    setModalOpen(true);
    // Charger les photos
    try {
      const p = await apiJSON<PhotoDTO[]>(`/api/chantiers/${ev.id}/photos`);
      setPhotos(p);
    } catch { setPhotos([]); }
  };

  const handleSave = async () => {
    if (!formTitle) return alert("Le titre est obligatoire");
    const notes = buildNotesWithClient(client, formNotes);
    const payload = { title: formTitle, type: formType, startDate: formStart, endDate: formEnd, status: formStatus, notes };
    
    try {
      if (editingId) await apiJSON(`/api/chantiers/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      else await apiJSON("/api/chantiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setModalOpen(false);
      refresh();
    } catch (e) { alert("Erreur lors de la sauvegarde"); }
  };

  const onDragEnd = async (evt: DragEndEvent) => {
    const activeId = String(evt.active.id).split("@")[0];
    const overId = evt.over?.id ? String(evt.over.id) : null;
    if (overId?.startsWith("cell:")) {
      const newDate = overId.replace("cell:", "");
      const chantier = events.find(e => e.id === activeId);
      if (chantier) {
        const diff = diffDays(chantier.startDate, chantier.endDate);
        await apiJSON(`/api/chantiers/${activeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: newDate, endDate: addDaysISO(newDate, diff) })
        });
        refresh();
      }
    }
  };

  return (
    <div className="p-6 bg-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-[#183536] tracking-tight">PHOENIX <span className="text-slate-400">PLANNING</span></h1>
          </div>
          <button onClick={() => openNew()} className={`px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-900/10 ${FOREST_BTN}`}>
            + Nouveau chantier
          </button>
        </header>

        <main className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={onDragEnd}>
            <MonthGrid 
              cursor={cursor} 
              events={events} 
              onCellClick={openNew} 
              onEventClick={(id) => openEdit(events.find(e => e.id === id)!)}
              onPdf={(id) => window.open(`/api/chantiers/${id}/pdf`)}
            />
          </DndContext>
        </main>
      </div>

      <Modal open={modalOpen} title={editingId ? "Détails du chantier" : "Création d'un chantier"} onClose={() => setModalOpen(false)}>
        <div className="space-y-6">
          <section className="space-y-3">
            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Informations générales</label>
            <input className="w-full border-2 border-slate-100 p-3 rounded-xl focus:border-[#183536] outline-none transition-all font-medium" placeholder="Titre du chantier (ex: Nettoyage Diogène Dupont)" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold ml-1">Début</span>
                <input type="date" className="w-full border-2 border-slate-100 p-2.5 rounded-xl text-sm" value={formStart} onChange={e => setFormStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold ml-1">Fin</span>
                <input type="date" className="w-full border-2 border-slate-100 p-2.5 rounded-xl text-sm" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              </div>
            </div>
            <select className="w-full border-2 border-slate-100 p-3 rounded-xl bg-white text-sm font-semibold" value={formType} onChange={e => setFormType(e.target.value as ChantierType)}>
              {CHANTIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </section>

          <section className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Contact Client</label>
            <input className="w-full border bg-white p-2.5 rounded-lg text-sm" placeholder="Nom complet" value={client.nom} onChange={e => setClient({...client, nom: e.target.value})} />
            <input className="w-full border bg-white p-2.5 rounded-lg text-sm" placeholder="Téléphone" value={client.tel} onChange={e => setClient({...client, tel: e.target.value})} />
            <textarea className="w-full border bg-white p-2.5 rounded-lg text-sm min-h-[60px]" placeholder="Adresse complète" value={client.adresse} onChange={e => setClient({...client, adresse: e.target.value})} />
          </section>

          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Galerie Photos</label>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full hover:bg-emerald-100">
                + AJOUTER
              </button>
            </div>
            <input 
              type="file" multiple className="hidden" ref={fileInputRef} 
              onChange={async (e) => {
                if (!editingId) return alert("Veuillez d'abord enregistrer le chantier.");
                const files = e.target.files ? Array.from(e.target.files) : [];
                try {
                  const res = await uploadPhotos(editingId, files);
                  setPhotos(res);
                } catch { alert("Erreur upload"); }
                if (fileInputRef.current) fileInputRef.current.value = "";
              }} 
            />
            <div className="grid grid-cols-4 gap-2">
              {photos.map(p => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border bg-slate-200">
                  <img src={p.fileUrl} className="object-cover w-full h-full" alt="chantier" />
                </div>
              ))}
            </div>
          </section>

          <button onClick={handleSave} className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20 ${FOREST_BTN}`}>
            Enregistrer les modifications
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** ---------- GRIDS IMPLEMENTATION ---------- */

function MonthGrid({ cursor, events, onCellClick, onEventClick, onMore }: GridProps) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeekMonday(monthStart);
  const days = Array.from({ length: 35 }).map((_, i) => addDays(gridStart, i));

  return (
    <div className="grid grid-cols-7 border-l border-t border-slate-100 bg-slate-100 gap-[1px]">
      {days.map(d => {
        const iso = toISODate(d);
        const dayEvents = events.filter((e) => inRangeISO(iso, e.startDate, e.endDate));
        return (
          <DroppableDayCell 
            key={iso} 
            iso={iso} 
            dayNumber={d.getDate()} 
            faded={d.getMonth() !== cursor.getMonth()} 
            onClick={() => onCellClick(iso)}
          >
            {dayEvents.slice(0, 3).map((e) => (
              <DraggablePill 
                key={e.id} 
                draggableId={`${e.id}@${iso}`} 
                style={{ backgroundColor: getChantierColor(e.type) }} 
                onClick={() => onEventClick(e.id)}
              >
                {e.title}
              </DraggablePill>
            ))}
            {dayEvents.length > 3 && (
              <div 
                className="text-[9px] text-center font-black text-slate-400 pt-1 cursor-pointer hover:text-slate-600"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMore) onMore(iso, (e.target as HTMLElement).getBoundingClientRect());
                }}
              >
                + {dayEvents.length - 3} AUTRES
              </div>
            )}
          </DroppableDayCell>
        );
      })}
    </div>
  );
}