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

/** ---------- Types & Interfaces ---------- */

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

interface StaffDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
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

/** ---------- Helpers & Utils ---------- */

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpointPx]);
  return isMobile;
}

function normalizeType(type: string) {
  return (type || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").replace("post mortem", "post-mortem");
}

const CHANTIER_COLORS: Record<string, string> = {
  diogene: "#C46A1A",
  "post-mortem": "#8B1E1E",
  "scene de crime": "#1F2937",
  insalubre: "#7C2D12",
  debarras: "#2563EB",
  deratisation: "#4C1D95",
  desinsectisation: "#7C3AED",
  ozone: "#0F766E",
  nebulisation: "#0EA5E9",
  devis: "#6B7280",
};

function getChantierColor(typeLabel: string) {
  const key = normalizeType(typeLabel);
  return CHANTIER_COLORS[key] ?? "#334155";
}

const FOREST_BTN = "bg-[#183536] text-white";
const STATUS_LABEL: Record<ChantierStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
};

/** Utils dates */
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
function isWeekendISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day === 0 || day === 6;
}

/** Client Notes logic */
const CLIENT_START = "[[CLIENT]]";
const CLIENT_END = "[[/CLIENT]]";

function extractClientBlock(notesRaw: string | undefined) {
  const raw = String(notesRaw ?? "");
  const empty: ClientInfo = { nom: "", tel: "", email: "", adresse: "" };
  const start = raw.indexOf(CLIENT_START);
  const end = raw.indexOf(CLIENT_END);
  if (start === -1 || end === -1 || end <= start) return { client: empty, rest: raw.trim() };
  const block = raw.slice(start + CLIENT_START.length, end).trim();
  const rest = (raw.slice(0, start) + raw.slice(end + CLIENT_END.length)).trim();
  const client: ClientInfo = { ...empty };
  for (const line of block.split(/\r?\n/)) {
    const [k, ...vv] = line.split("=");
    const key = (k || "").trim().toLowerCase();
    const val = vv.join("=").trim();
    if (key === "nom") client.nom = val;
    if (key === "tel" || key === "telephone") client.tel = val;
    if (key === "email" || key === "mail") client.email = val;
    if (key === "adresse" || key === "address") client.adresse = val;
  }
  return { client, rest };
}

function buildNotesWithClient(client: ClientInfo, restNotes: string) {
  const hasAny = client.nom.trim() || client.tel.trim() || client.email.trim() || client.adresse.trim();
  if (!hasAny) return restNotes.trim();
  return [CLIENT_START, `Nom=${client.nom}`, `Tel=${client.tel}`, `Email=${client.email}`, `Adresse=${client.adresse}`, CLIENT_END, "", restNotes.trim()].join("\n").trim();
}

/** ---------- API Functions ---------- */

async function apiJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur API (${res.status})`);
  }
  return (await res.json()) as T;
}

async function fetchChantiersActive(): Promise<ChantierEvent[]> { return apiJSON<ChantierEvent[]>("/api/chantiers?archived=false"); }
async function createChantier(payload: Partial<ChantierEvent>): Promise<ChantierEvent> {
  return apiJSON<ChantierEvent>("/api/chantiers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
async function updateChantier(id: string, patch: Partial<ChantierEvent>): Promise<ChantierEvent> {
  return apiJSON<ChantierEvent>(`/api/chantiers/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
async function uploadPhotos(jobId: string, files: File[]): Promise<PhotoDTO[]> {
  const fd = new FormData();
  files.forEach(f => fd.append("file", f));
  const res = await fetch(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Erreur upload");
  return await res.json();
}

/** ---------- UI Components ---------- */

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full h-full md:h-[90vh] md:w-[600px] md:rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function DraggablePill({ draggableId, style, children, onClick }: { draggableId: string; style?: CSSProperties; children: React.ReactNode; onClick: () => void; }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: draggableId });
  const dndStyle: CSSProperties | undefined = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={dndStyle} className={isDragging ? "opacity-50 z-50" : ""}>
      <div style={style} className="w-full rounded-md px-2 py-1 text-[11px] font-bold cursor-grab active:cursor-grabbing text-white truncate shadow-sm" onClick={(e) => { e.stopPropagation(); onClick(); }} {...listeners} {...attributes}>
        {children}
      </div>
    </div>
  );
}

function DroppableDayCell({ iso, dayNumber, faded, children, onClick }: { iso: string; dayNumber: number; faded: boolean; children: React.ReactNode; onClick: () => void; }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${iso}` });
  const today = isTodayISO(iso);
  return (
    <div ref={setNodeRef} onClick={onClick} className={`min-h-[100px] border p-1 transition-colors ${faded ? "bg-slate-50 opacity-40" : "bg-white"} ${isOver ? "bg-blue-50" : ""} ${today ? "ring-2 ring-inset ring-[#183536]" : ""}`}>
      <div className="text-right text-[10px] font-medium text-slate-400">{dayNumber}</div>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

/** ---------- Main Page ---------- */

export default function Page() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewMode>("mois");
  const [cursor] = useState<Date>(new Date());
  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formType, setFormType] = useState<ChantierType>("Diogène");
  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState(toISODate(new Date()));
  const [formEnd, setFormEnd] = useState(toISODate(new Date()));
  const [formStatus, setFormStatus] = useState<ChantierStatus>("EN_ATTENTE");
  const [clientNom, setClientNom] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const data = await fetchChantiersActive();
    setEvents(data);
  };

  useEffect(() => { refresh(); }, []);

  const openEdit = (ev: ChantierEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormType(ev.type as ChantierType);
    setFormStart(ev.startDate);
    setFormEnd(ev.endDate);
    setFormStatus(ev.status);
    const { client, rest } = extractClientBlock(ev.notes);
    setClientNom(client.nom); setClientTel(client.tel); setClientEmail(client.email); setClientAdresse(client.adresse);
    setFormNotes(rest);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const notes = buildNotesWithClient({ nom: clientNom, tel: clientTel, email: clientEmail, adresse: clientAdresse }, formNotes);
    const payload = { title: formTitle, type: formType, startDate: formStart, endDate: formEnd, status: formStatus, notes };
    if (editingId) await updateChantier(editingId, payload);
    else await createChantier(payload);
    setModalOpen(false);
    refresh();
  };

  const onDragEnd = async (evt: DragEndEvent) => {
    const activeId = String(evt.active.id).split("@")[0];
    const overId = evt.over?.id ? String(evt.over.id) : null;
    if (overId?.startsWith("cell:")) {
      const newDate = overId.replace("cell:", "");
      const chantier = events.find(e => e.id === activeId);
      if (chantier) {
        const diff = diffDays(chantier.startDate, chantier.endDate);
        await updateChantier(activeId, { startDate: newDate, endDate: addDaysISO(newDate, diff) });
        refresh();
      }
    }
  };

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-[#183536]">Planning Phoenix</h1>
          <button onClick={() => { setEditingId(null); setModalOpen(true); }} className={`px-4 py-2 rounded-lg font-bold ${FOREST_BTN}`}>+ Créer</button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={onDragEnd}>
            {view === "mois" && (
              <MonthGrid 
                cursor={cursor} 
                events={events} 
                onCellClick={(iso) => { setFormStart(iso); setFormEnd(iso); setModalOpen(true); }} 
                onEventClick={(id) => openEdit(events.find(e => e.id === id)!)}
                onPdf={(id) => window.open(`/api/chantiers/${id}/pdf`)}
              />
            )}
          </DndContext>
        </div>
      </div>

      <Modal open={modalOpen} title={editingId ? "Modifier le chantier" : "Nouveau chantier"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <input className="w-full border p-2 rounded" placeholder="Titre du chantier" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className="border p-2 rounded" value={formStart} onChange={e => setFormStart(e.target.value)} />
            <input type="date" className="border p-2 rounded" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
          </div>
          <select className="w-full border p-2 rounded" value={formType} onChange={e => setFormType(e.target.value as ChantierType)}>
            {CHANTIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div className="border-t pt-4">
            <h3 className="font-bold mb-2">Coordonnées Client</h3>
            <div className="space-y-2">
              <input className="w-full border p-2 rounded" placeholder="Nom" value={clientNom} onChange={e => setClientNom(e.target.value)} />
              <input className="w-full border p-2 rounded" placeholder="Téléphone" value={clientTel} onChange={e => setClientTel(e.target.value)} />
              <textarea className="w-full border p-2 rounded" placeholder="Adresse" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-bold mb-2">Photos</h3>
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef} 
              onChange={async (e) => {
                if (!editingId) return alert("Sauvegardez le chantier avant d'ajouter des photos");
                const files = e.target.files ? Array.from(e.target.files) : [];
                const res = await uploadPhotos(editingId, files);
                setPhotos(res);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }} 
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600 font-bold">+ Ajouter des photos</button>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {photos.map(p => <img key={p.id} src={p.fileUrl} className="h-20 w-full object-cover rounded border" alt="chantier" />)}
            </div>
          </div>

          <button onClick={handleSave} className={`w-full py-3 rounded-xl font-bold mt-4 ${FOREST_BTN}`}>Enregistrer</button>
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
    <div className="grid grid-cols-7 border-l border-t">
      {days.map(d => {
        const iso = toISODate(d);
        const dayEvents = events.filter((e) => inRangeISO(iso, e.startDate, e.endDate));
        return (
          <DroppableDayCell key={iso} iso={iso} dayNumber={d.getDate()} faded={d.getMonth() !== cursor.getMonth()} onClick={() => onCellClick(iso)}>
            {dayEvents.slice(0, 3).map((e) => (
              <DraggablePill key={e.id} draggableId={`${e.id}@${iso}`} style={{ backgroundColor: getChantierColor(e.type) }} onClick={() => onEventClick(e.id)}>
                {e.title}
              </DraggablePill>
            ))}
            {dayEvents.length > 3 && (
              <div 
                className="text-[9px] text-center font-bold text-slate-400" 
                onClick={(e) => { e.stopPropagation(); if (onMore) onMore(iso, (e.target as HTMLElement).getBoundingClientRect()); }}
              >
                +{dayEvents.length - 3}
              </div>
            )}
          </DroppableDayCell>
        );
      })}
    </div>
  );
}