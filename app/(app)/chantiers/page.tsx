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

/** ---------- Mobile helper ---------- */
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

/**
 * Normalisation robuste :
 * - minuscules
 * - trim
 * - supprime accents (Diogène -> diogene)
 * - espaces multiples
 */
function normalizeType(type: string) {
  return (type || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace("post mortem", "post-mortem");
}

/** Couleurs uniques par type */
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
type ChantierStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE";
type ViewMode = "jour" | "semaine" | "mois";

type ChantierEvent = {
  id: string;
  type: ChantierType | string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD inclus
  status: ChantierStatus;
  archived: boolean;
  intervenants: string[];
  notes?: string;
  updatedAt?: string;
};

type StaffDto = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  notes: string | null;
  fullName: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type PhotoDTO = {
  id: string;
  fileUrl: string;
  fileLabel: string;
  uploadedAt: string;
};

const FOREST_BTN = "bg-[#183536] text-white";

const STATUS_LABEL: Record<ChantierStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
};

/** ---------- Utils dates ---------- */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, days: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}
function startOfWeekMonday(d: Date) {
  const day = d.getDay(); // 0=dim
  const diff = (day === 0 ? -6 : 1) - day;
  return startOfDay(addDays(d, diff));
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function monthTitleFR(d: Date) {
  const months = [
    "JANVIER",
    "FEVRIER",
    "MARS",
    "AVRIL",
    "MAI",
    "JUIN",
    "JUILLET",
    "AOUT",
    "SEPTEMBRE",
    "OCTOBRE",
    "NOVEMBRE",
    "DECEMBRE",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
function weekdayShortFR(i: number) {
  return ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i]!;
}
function inRangeISO(dateISO: string, startISO: string, endISO: string) {
  return dateISO >= startISO && dateISO <= endISO;
}
function toISODateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function parseISODateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}
function addDaysISO(iso: string, days: number) {
  const dt = parseISODateUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISODateUTC(dt);
}
function subDaysISO(iso: string, days: number) {
  return addDaysISO(iso, -days);
}
function diffDays(startISO: string, endISO: string) {
  const s = parseISODateUTC(startISO).getTime();
  const e = parseISODateUTC(endISO).getTime();
  return Math.floor((e - s) / 86400000);
}
function isTodayISO(iso: string) {
  return iso === toISODate(startOfDay(new Date()));
}
function isWeekendISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day === 0 || day === 6;
}

/** ---------- COORDONNÉES CLIENT (stockées dans notes) ---------- */
type ClientInfo = { nom: string; tel: string; email: string; adresse: string };
const CLIENT_START = "[[CLIENT]]";
const CLIENT_END = "[[/CLIENT]]";

function extractClientBlock(notesRaw: string | undefined) {
  const raw = String(notesRaw ?? "");
  const empty: ClientInfo = { nom: "", tel: "", email: "", adresse: "" };

  const start = raw.indexOf(CLIENT_START);
  const end = raw.indexOf(CLIENT_END);
  if (start === -1 || end === -1 || end <= start) {
    return { client: empty, rest: raw.trim() };
  }

  const block = raw.slice(start + CLIENT_START.length, end).trim();
  const rest = (raw.slice(0, start) + raw.slice(end + CLIENT_END.length)).trim();

  const client: ClientInfo = { ...empty };
  for (const line of block.split(/\r?\n/)) {
    const [k, ...vv] = line.split("=");
    const key = (k || "").trim().toLowerCase();
    const val = vv.join("=").trim();
    if (!val) continue;

    if (key === "nom") client.nom = val;
    if (key === "tel" || key === "telephone") client.tel = val;
    if (key === "email" || key === "mail") client.email = val;
    if (key === "adresse" || key === "address") client.adresse = val;
  }

  return { client, rest };
}

function buildNotesWithClient(client: ClientInfo, restNotes: string) {
  const hasAny =
    (client.nom || "").trim() ||
    (client.tel || "").trim() ||
    (client.email || "").trim() ||
    (client.adresse || "").trim();

  const rest = (restNotes ?? "").trim();

  if (!hasAny) return rest;

  const lines = [
    CLIENT_START,
    `Nom=${(client.nom || "").trim()}`,
    `Tel=${(client.tel || "").trim()}`,
    `Email=${(client.email || "").trim()}`,
    `Adresse=${(client.adresse || "").trim()}`,
    CLIENT_END,
    "",
    rest,
  ];

  return lines.join("\n").trim();
}

/** ---------- API helpers ---------- */
async function apiJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur API (${res.status})`);
  }

  return (await res.json()) as T;
}

async function fetchChantiersActive(): Promise<ChantierEvent[]> {
  return apiJSON<ChantierEvent[]>("/api/chantiers?archived=false", { method: "GET" });
}

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

async function deleteChantier(id: string): Promise<{ success: true }> {
  return apiJSON<{ success: true }>(`/api/chantiers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function fetchStaff(): Promise<StaffDto[]> {
  return apiJSON<StaffDto[]>("/api/intervenants", { method: "GET" });
}

async function fetchPhotos(jobId: string): Promise<PhotoDTO[]> {
  return apiJSON<PhotoDTO[]>(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, { method: "GET" });
}

async function uploadPhotos(jobId: string, files: File[]) {
  const fd = new FormData();

  for (const f of files) {
    // ✅ compat : certains backends attendent "file", d’autres "files"
    fd.append("file", f);
    fd.append("files", f);
  }

  const res = await fetch(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, {
    method: "POST",
    body: fd,
    // ⚠️ surtout PAS de headers
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload photos: ${res.status}`);
  }

  return (await res.json()) as PhotoDTO[];
}

/** ---------- UI Components ---------- */
function Legend({ title = "Légende des chantiers" }: { title?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-xl font-semibold mb-4">{title}</div>
      <div className="space-y-3">
        {CHANTIER_TYPES.map((label) => {
          const color = getChantierColor(label);
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="text-base">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ✅ Modal plein écran :
 * - panneau = 100vw/100vh
 * - header sticky
 * - body scroll
 */
function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 bg-white shadow-xl border-l md:border-none flex flex-col">
        <div className="sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between bg-white">
          <div className="text-lg font-bold">{title}</div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl border hover:bg-slate-50"
            aria-label="Fermer"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Pill draggable (id = eventId@cellISO) */
function DraggablePill({
  draggableId,
  style,
  children,
  onClick,
}: {
  draggableId: string;
  style?: CSSProperties;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
  });

  const dndStyle: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={dndStyle} className={isDragging ? "opacity-80" : ""}>
      <div
        style={style}
        className={[
          "w-full",
          "rounded-lg px-2 py-2 text-xs font-semibold",
          "cursor-grab active:cursor-grabbing select-none text-white",
          "transition duration-150 ease-out",
          "shadow-sm hover:shadow-md",
          isDragging ? "shadow-lg ring-2 ring-black/15 scale-[1.01]" : "",
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        {...listeners}
        {...attributes}
      >
        <div
          style={{
            lineHeight: "1.15rem",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cell droppable */
function DroppableDayCell({
  iso,
  dayNumber,
  faded,
  children,
  onClick,
}: {
  iso: string;
  dayNumber: number;
  faded: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const dropId = `cell:${iso}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  const weekend = isWeekendISO(iso);
  const today = isTodayISO(iso);

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      data-iso={iso}
      className={[
        "rounded-xl border p-2 cursor-pointer",
        "min-h-[96px] md:min-h-[120px]",
        "hover:bg-slate-50",
        faded ? "opacity-50" : "",
        isOver ? "ring-2 ring-slate-400" : "",
        weekend ? "bg-slate-50/70" : "bg-white",
        today ? "border-[#183536] ring-1 ring-[#183536]/20" : "",
      ].join(" ")}
      title="Cliquer pour ajouter / déposer pour déplacer"
    >
      <div className="flex justify-end">
        <div className="text-xs text-slate-500">{dayNumber}</div>
      </div>

      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

/** ---------- Pile intelligente : Popover / Bottom sheet ---------- */
type DayPopover = {
  open: boolean;
  iso: string;
  top: number;
  left: number;
  width: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function statusLabelFR(s: ChantierStatus) {
  return s === "EN_ATTENTE" ? "En attente" : s === "EN_COURS" ? "En cours" : "Terminé";
}
function statusDotColor(s: ChantierStatus) {
  return s === "EN_ATTENTE" ? "#64748b" : s === "EN_COURS" ? "#f59e0b" : "#22c55e";
}

function DayEventsPopover({
  pop,
  events,
  onClose,
  onOpenEvent,
  onPdf,
  isMobile,
}: {
  pop: DayPopover;
  events: ChantierEvent[];
  onClose: () => void;
  onOpenEvent: (id: string) => void;
  onPdf: (id: string) => void;
  isMobile: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!pop.open) return null;

  const List = (
    <div className={isMobile ? "max-h-[65vh] overflow-auto p-3 space-y-2" : "max-h-[360px] overflow-auto p-3 space-y-2"}>
      {events.length === 0 ? (
        <div className="text-sm text-slate-600">Aucun chantier.</div>
      ) : (
        events.map((e) => {
          const dot = statusDotColor(e.status);
          const badgeColor = getChantierColor(String(e.type));
          return (
            <div
              key={e.id}
              className="rounded-xl border p-3 hover:bg-slate-50 cursor-pointer"
              onClick={(ev) => {
                ev.stopPropagation();
                onOpenEvent(e.id);
                onClose();
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: badgeColor }} />
                    <div className="font-semibold text-slate-900 truncate">{e.title}</div>
                  </div>

                  <div className="mt-1 inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} aria-hidden="true" />
                    <span>{statusLabelFR(e.status)}</span>
                    <span className="text-slate-500 font-semibold">•</span>
                    <span className="text-slate-600 font-semibold">{String(e.type)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold bg-[#183536] text-white hover:opacity-90"
                  title="Ouvrir le PDF"
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onPdf(e.id);
                  }}
                >
                  PDF
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {isMobile ? (
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-2xl border bg-white shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-bold text-slate-900">Chantiers du {pop.iso}</div>
            <button onClick={onClose} className="h-9 w-9 rounded-lg border hover:bg-slate-50" aria-label="Fermer" type="button">
              ✕
            </button>
          </div>

          {List}

          <div className="px-4 py-3 border-t bg-white">
            <button
              type="button"
              className="w-full rounded-lg bg-[#183536] px-3 py-3 text-sm font-semibold text-white hover:opacity-95"
              onClick={onClose}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute rounded-2xl border bg-white shadow-xl overflow-hidden" style={{ top: pop.top, left: pop.left, width: pop.width }}>
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-bold text-slate-900">Chantiers du {pop.iso}</div>
            <button onClick={onClose} className="h-9 w-9 rounded-lg border hover:bg-slate-50" aria-label="Fermer" type="button">
              ✕
            </button>
          </div>

          {List}

          <div className="px-4 py-3 border-t bg-white">
            <button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** ---------- Page ---------- */
export default function Page() {
  const isMobile = useIsMobile();

  const [view, setView] = useState<ViewMode>("mois");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<ChantierStatus | "ALL">("ALL");

  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const [popover, setPopover] = useState<DayPopover>({
    open: false,
    iso: "",
    top: 0,
    left: 0,
    width: 420,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const todayISO = toISODate(startOfDay(new Date()));
  const [formType, setFormType] = useState<ChantierType>("Diogène");
  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState(todayISO);
  const [formEnd, setFormEnd] = useState(todayISO);
  const [formStatus, setFormStatus] = useState<ChantierStatus>("EN_ATTENTE");
  const [formArchived, setFormArchived] = useState(false);
  const [formIntervenants, setFormIntervenants] = useState<string[]>([]);

  // ✅ Coordonnées client + notes séparées
  const [clientNom, setClientNom] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [formNotesIntervenant, setFormNotesIntervenant] = useState("");

  // ✅ Photos
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isMobile && view === "mois") setView("semaine");
  }, [isMobile, view]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChantiersActive();
      setEvents(data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function refreshStaff() {
    setStaffLoading(true);
    try {
      const data = await fetchStaff();
      setStaff(data);
    } catch {
      // ignore
    } finally {
      setStaffLoading(false);
    }
  }

  async function refreshPhotos(jobId: string) {
    setPhotosLoading(true);
    try {
      const data = await fetchPhotos(jobId);
      setPhotos(data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur chargement photos");
    } finally {
      setPhotosLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    refreshStaff();
  }, []);

  function resetClientAndNotes() {
    setClientNom("");
    setClientTel("");
    setClientEmail("");
    setClientAdresse("");
    setFormNotesIntervenant("");
  }

  function openNewChantier(dateISO?: string) {
    const d = dateISO ?? toISODate(cursor);
    setEditingId(null);
    setFormType("Diogène");
    setFormTitle("");
    setFormStart(d);
    setFormEnd(d);
    setFormStatus("EN_ATTENTE");
    setFormArchived(false);
    setFormIntervenants([]);
    resetClientAndNotes();
    setPhotos([]); // pas de photos tant qu’on n’a pas d’id
    setModalOpen(true);
  }

  function openPdf(jobId: string) {
    if (!jobId) return;
    window.open(`/api/chantiers/${jobId}/pdf`, "_blank", "noopener,noreferrer");
  }

  function openEditChantier(ev: ChantierEvent) {
    setEditingId(ev.id);
    setFormType((ev.type as ChantierType) ?? "Diogène");
    setFormTitle(ev.title);
    setFormStart(ev.startDate);
    setFormEnd(ev.endDate);
    setFormStatus(ev.status);
    setFormArchived(ev.archived);
    setFormIntervenants(ev.intervenants?.length ? ev.intervenants : []);

    // ✅ split notes => client + notes intervenant
    const { client, rest } = extractClientBlock(ev.notes);
    setClientNom(client.nom);
    setClientTel(client.tel);
    setClientEmail(client.email);
    setClientAdresse(client.adresse);
    setFormNotesIntervenant(rest ?? "");

    setModalOpen(true);

    // ✅ load photos
    refreshPhotos(ev.id);
  }

  async function saveChantier() {
    setError(null);

    const title = formTitle.trim();
    if (!title) return window.alert("Le titre est obligatoire.");
    if (formEnd < formStart) return window.alert("La date de fin doit être >= date de début.");

    // ✅ rebuild notes
    const combinedNotes = buildNotesWithClient(
      { nom: clientNom, tel: clientTel, email: clientEmail, adresse: clientAdresse },
      formNotesIntervenant
    );

    setSaving(true);
    try {
      if (!editingId) {
        const created = await createChantier({
          type: formType,
          title,
          startDate: formStart,
          endDate: formEnd,
          status: formStatus,
          archived: formArchived,
          intervenants: formIntervenants,
          notes: combinedNotes.trim() || undefined,
        });

        if (!created.archived) setEvents((prev) => [created, ...prev]);

        // ✅ maintenant on a un id => on peut charger les photos (vide)
        setEditingId(created.id);
        await refreshPhotos(created.id);
      } else {
        const updated = await updateChantier(editingId, {
          type: formType,
          title,
          startDate: formStart,
          endDate: formEnd,
          status: formStatus,
          archived: formArchived,
          intervenants: formIntervenants,
          notes: combinedNotes.trim() || undefined,
        });

        setEvents((prev) => {
          const filtered = prev.filter((e) => e.id !== updated.id);
          return updated.archived ? filtered : [updated, ...filtered];
        });

        await refreshPhotos(updated.id);
      }

      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrent() {
    if (!editingId) return;
    if (!window.confirm("Supprimer ce chantier ?")) return;

    setSaving(true);
    setError(null);
    try {
      await deleteChantier(editingId);
      setEvents((prev) => prev.filter((e) => e.id !== editingId));
      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  function gotoPrev() {
    if (view === "mois") setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (view === "semaine") setCursor((d) => addDays(d, -7));
    else setCursor((d) => addDays(d, -1));
  }
  function gotoNext() {
    if (view === "mois") setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (view === "semaine") setCursor((d) => addDays(d, 7));
    else setCursor((d) => addDays(d, 1));
  }
  function gotoToday() {
    setCursor(startOfDay(new Date()));
  }

  const headerTitle = useMemo(() => {
    if (view === "mois") return monthTitleFR(cursor);
    if (view === "semaine") {
      const w0 = startOfWeekMonday(cursor);
      const w6 = addDays(w0, 6);
      return `Semaine du ${pad2(w0.getDate())}/${pad2(w0.getMonth() + 1)} au ${pad2(w6.getDate())}/${pad2(w6.getMonth() + 1)}`;
    }
    return `Jour : ${pad2(cursor.getDate())}/${pad2(cursor.getMonth() + 1)}/${cursor.getFullYear()}`;
  }, [cursor, view]);

  async function onDragEnd(evt: DragEndEvent) {
    const active = String(evt.active.id); // eventId@YYYY-MM-DD
    const overId = evt.over?.id ? String(evt.over.id) : null;
    if (!overId || !overId.startsWith("cell:")) return;

    const targetDate = overId.replace("cell:", "");
    const [eventId, grabbedDate] = active.split("@");
    if (!eventId || !grabbedDate) return;

    const current = events.find((e) => e.id === eventId);
    if (!current) return;

    const rawDuration = diffDays(current.startDate, current.endDate);
    const duration = Math.max(0, rawDuration);

    const offset = diffDays(current.startDate, grabbedDate);
    const newStart = subDaysISO(targetDate, offset);
    const newEnd = addDaysISO(newStart, duration);

    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, startDate: newStart, endDate: newEnd } : e)));

    try {
      await updateChantier(eventId, { startDate: newStart, endDate: newEnd });
    } catch (e: any) {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? current : e)));
      setError(e?.message ?? "Erreur lors du déplacement");
    }
  }

  const filteredEvents = useMemo(() => {
    if (statusFilter === "ALL") return events;
    return events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter]);

  const popEvents = useMemo(() => {
    if (!popover.open) return [];
    return filteredEvents.filter((e) => inRangeISO(popover.iso, e.startDate, e.endDate));
  }, [filteredEvents, popover]);

  function openPopoverForDay(iso: string, rect: DOMRect) {
    const margin = 10;
    const panelWidth = 420;
    const panelHeightApprox = 420;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.right + margin;
    if (left + panelWidth > vw - margin) left = rect.left - panelWidth - margin;

    let top = rect.top;
    top = clamp(top, margin, vh - panelHeightApprox - margin);

    setPopover({
      open: true,
      iso,
      top,
      left: clamp(left, margin, vw - panelWidth - margin),
      width: panelWidth,
    });
  }

  async function handlePickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!editingId) {
      window.alert("Enregistre d’abord le chantier, puis ajoute les photos.");
      return;
    }

    setError(null);
    setPhotosLoading(true);
    try {
      const uploaded = await uploadPhotos(editingId, Array.from(files));
      setPhotos(uploaded);
    } catch (e: any) {
      setError(e?.message ?? "Erreur upload photos");
    } finally {
      setPhotosLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-3xl font-bold truncate">Phoenix Ops – Planning</div>
            <div className="text-slate-600 mt-1 truncate">Gestion des chantiers : Diogène, post-mortem, insalubre, 3D…</div>
          </div>

          <button
            onClick={() => openNewChantier()}
            className={`shrink-0 rounded-xl px-5 py-3 font-semibold hover:opacity-95 ${FOREST_BTN}`}
            disabled={saving}
          >
            + Nouveau
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
            <div className="font-semibold">Erreur</div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{error}</div>
          </div>
        ) : null}

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="text-2xl font-bold">Planning</div>

            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button onClick={() => setView("jour")} className={`rounded-lg border px-4 py-2 font-semibold ${view === "jour" ? FOREST_BTN : "bg-white"}`}>
                Jour
              </button>
              <button onClick={() => setView("semaine")} className={`rounded-lg border px-4 py-2 font-semibold ${view === "semaine" ? FOREST_BTN : "bg-white"}`}>
                Semaine
              </button>
              <button onClick={() => setView("mois")} className={`rounded-lg border px-4 py-2 font-semibold ${view === "mois" ? FOREST_BTN : "bg-white"}`}>
                Mois
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 overflow-x-auto whitespace-nowrap pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button onClick={() => setStatusFilter("ALL")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${statusFilter === "ALL" ? FOREST_BTN : "bg-white"}`}>
              Tous
            </button>
            <button onClick={() => setStatusFilter("EN_ATTENTE")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${statusFilter === "EN_ATTENTE" ? FOREST_BTN : "bg-white"}`}>
              En attente
            </button>
            <button onClick={() => setStatusFilter("EN_COURS")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${statusFilter === "EN_COURS" ? FOREST_BTN : "bg-white"}`}>
              En cours
            </button>
            <button onClick={() => setStatusFilter("TERMINE")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${statusFilter === "TERMINE" ? FOREST_BTN : "bg-white"}`}>
              Terminé
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={gotoPrev} className="h-10 w-10 rounded-full border bg-white hover:bg-slate-50" aria-label="Précédent">
                ‹
              </button>
              <button onClick={gotoNext} className="h-10 w-10 rounded-full border bg-white hover:bg-slate-50" aria-label="Suivant">
                ›
              </button>
              <button onClick={gotoToday} className={`rounded-lg px-3 py-2 text-sm font-semibold ${FOREST_BTN}`}>
                Aujourd’hui
              </button>
              <button onClick={refresh} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50" disabled={loading || saving}>
                {loading ? "Chargement…" : "Rafraîchir"}
              </button>
            </div>

            <div className="text-slate-700 font-semibold hidden md:block">{headerTitle}</div>
            <div className="w-[140px] hidden md:block" />
          </div>

          <div className="md:hidden mt-3 text-slate-700 font-semibold">{headerTitle}</div>

          <div className="mt-5">
            {loading ? (
              <div className="rounded-xl border bg-slate-50 p-4 text-slate-700">Chargement du planning…</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={onDragEnd}>
                {view === "mois" && (
                  <MonthGrid
                    cursor={cursor}
                    events={filteredEvents}
                    onCellClick={(iso) => openNewChantier(iso)}
                    onEventClick={(id) => {
                      const ev = events.find((x) => x.id === id);
                      if (ev) openEditChantier(ev);
                    }}
                    onPdf={(id) => openPdf(id)}
                    onMore={(iso, rect) => openPopoverForDay(iso, rect)}
                  />
                )}

                {view === "semaine" && (
                  <WeekGrid
                    cursor={cursor}
                    events={filteredEvents}
                    onCellClick={(iso) => openNewChantier(iso)}
                    onEventClick={(id) => {
                      const ev = events.find((x) => x.id === id);
                      if (ev) openEditChantier(ev);
                    }}
                    onPdf={(id) => openPdf(id)}
                  />
                )}

                {view === "jour" && (
                  <DayView
                    cursor={cursor}
                    events={filteredEvents}
                    onAdd={() => openNewChantier(toISODate(cursor))}
                    onEventClick={(id) => {
                      const ev = events.find((x) => x.id === id);
                      if (ev) openEditChantier(ev);
                    }}
                    onPdf={(id) => openPdf(id)}
                  />
                )}
              </DndContext>
            )}
          </div>
        </div>

        <Legend title="Légende des chantiers" />
      </div>

      <DayEventsPopover
        pop={popover}
        events={popEvents}
        onClose={() => setPopover((p) => ({ ...p, open: false }))}
        onOpenEvent={(id) => {
          const ev = events.find((x) => x.id === id);
          if (ev) openEditChantier(ev);
        }}
        onPdf={(id) => openPdf(id)}
        isMobile={isMobile}
      />

      <Modal open={modalOpen} title={editingId ? "Modifier chantier" : "Nouveau chantier"} onClose={() => setModalOpen(false)}>
        <div className="space-y-6">
          {/* bloc haut : infos chantier */}
          <div className="rounded-2xl border bg-white p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Date début</label>
                <input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Date fin</label>
                <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold mb-1">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as ChantierType)} className="w-full rounded-xl border px-3 py-2">
                  {CHANTIER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1 flex items-center gap-3 pt-7">
                <input id="archived" type="checkbox" checked={formArchived} onChange={(e) => setFormArchived(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="archived" className="text-sm font-semibold">
                  Archiver ce chantier
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Titre</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder='Ex : "Diogène – Bergerac"'
                  className="w-full rounded-xl border px-3 py-2"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold mb-1">Statut</label>
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as ChantierStatus)} className="w-full rounded-xl border px-3 py-2">
                  <option value="EN_ATTENTE">{STATUS_LABEL.EN_ATTENTE}</option>
                  <option value="EN_COURS">{STATUS_LABEL.EN_COURS}</option>
                  <option value="TERMINE">{STATUS_LABEL.TERMINE}</option>
                </select>
              </div>
            </div>
          </div>

          {/* ✅ COORDONNÉES CLIENT : pleine largeur */}
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-lg font-bold mb-4">Coordonnées client</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nom / Prénom</label>
                <input value={clientNom} onChange={(e) => setClientNom(e.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="Client" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Téléphone</label>
                <input value={clientTel} onChange={(e) => setClientTel(e.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="06…" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="client@exemple.fr" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Adresse</label>
                <textarea
                  value={clientAdresse}
                  onChange={(e) => setClientAdresse(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 min-h-[80px]"
                  placeholder="Adresse complète"
                />
              </div>

              <div className="md:col-span-2 text-xs text-slate-500">
                (Technique : enregistré dans le champ Notes sous un bloc [[CLIENT]]… pour éviter une migration DB.)
              </div>
            </div>
          </div>

          {/* ✅ Intervenants DB */}
          <div className="rounded-2xl border bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold mb-1">Intervenants</label>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                onClick={() => refreshStaff()}
                disabled={staffLoading}
              >
                {staffLoading ? "Chargement…" : "Rafraîchir"}
              </button>
            </div>

            {staff.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
                Aucun intervenant en base. Ajoute-les dans la page <span className="font-semibold">/intervenants</span> (ADMIN).
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {staff.map((m) => {
                  const label = m.fullName || `${m.firstName} ${m.lastName}`.trim();
                  const checked = formIntervenants.includes(label);

                  return (
                    <label key={m.id} className="flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setFormIntervenants((prev) => Array.from(new Set([...prev, label])));
                          else setFormIntervenants((prev) => prev.filter((x) => x !== label));
                        }}
                      />
                      <span className="text-sm font-semibold">{label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes intervenant */}
          <div className="rounded-2xl border bg-white p-5">
            <label className="block text-sm font-semibold mb-2">Notes intervenant</label>
            <textarea
              value={formNotesIntervenant}
              onChange={(e) => setFormNotesIntervenant(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 min-h-[140px]"
            />
          </div>

          {/* ✅ Photos chantier */}
<div className="rounded-2xl border bg-white p-5">
  <div className="flex items-center justify-between gap-3">
    <div className="font-semibold">Photos du chantier</div>

    {/* Input caché déclenché par le bouton */}
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept="image/*"
      style={{ display: "none" }}
      onChange={async (e) => {
        const files = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];

        if (!editingId) {
          window.alert("Enregistre d’abord le chantier, puis ajoute les photos.");
          e.currentTarget.value = "";
          return;
        }
        if (files.length === 0) return;

        setError(null);
        setPhotosLoading(true);

        try {
          const uploaded = await uploadPhotos(editingId, files);
          setPhotos(uploaded);
          e.currentTarget.value = "";
        } catch (err: any) {
          setError(err?.message ?? "Erreur upload photos");
          e.currentTarget.value = "";
        } finally {
          setPhotosLoading(false);
        }
      }}
    />

    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`rounded-xl px-3 py-2 text-sm font-semibold ${FOREST_BTN}`}
        onClick={() => fileInputRef.current?.click()}
        disabled={photosLoading || saving || !editingId}
        title={!editingId ? "Enregistre le chantier d’abord" : "Prendre / ajouter des photos"}
      >
        + Photo
      </button>

      <button
        type="button"
        className="rounded-xl border px-3 py-2 text-sm font-semibold"
        onClick={() => {
          if (!editingId) return;
          refreshPhotos(editingId);
        }}
        disabled={photosLoading || !editingId}
      >
        Rafraîchir
      </button>
    </div>
  </div>

  {!editingId ? (
    <div className="mt-2 text-sm text-slate-600">
      Enregistre le chantier une première fois pour pouvoir associer des photos.
    </div>
  ) : photosLoading ? (
    <div className="mt-3 text-sm text-slate-600">Chargement / upload photos…</div>
  ) : photos.length === 0 ? (
    <div className="mt-3 text-sm text-slate-600">Aucune photo.</div>
  ) : (
    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
      {photos.map((p) => (
        <a
          key={p.id}
          href={p.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border overflow-hidden hover:opacity-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.fileUrl} alt={p.fileLabel} className="h-28 w-full object-cover" />
        </a>
      ))}
    </div>
  )}

  {editingId ? (
    <div className="mt-4 flex items-center justify-end">
      <button
        type="button"
        className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        onClick={() => openPdf(editingId)}
        disabled={saving}
      >
        Ouvrir PDF
      </button>
    </div>
  ) : null}
</div>

          {/* actions */}
          <div className="sticky bottom-0 bg-white border-t py-4">
            <div className="flex items-center justify-between">
              <div>
                {editingId ? (
                  <button onClick={deleteCurrent} className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50" disabled={saving}>
                    Supprimer
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setModalOpen(false)} className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50" disabled={saving}>
                  Annuler
                </button>
                <button onClick={saveChantier} className={`rounded-xl px-4 py-2 font-semibold hover:opacity-95 ${FOREST_BTN}`} disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}

/** ---------- Grids ---------- */
function MonthGrid({
  cursor,
  events,
  onCellClick,
  onEventClick,
  onPdf,
  onMore,
}: {
  cursor: Date;
  events: ChantierEvent[];
  onCellClick: (iso: string) => void;
  onEventClick: (eventId: string) => void;
  onPdf: (eventId: string) => void;
  onMore: (iso: string, rect: DOMRect) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = addDays(startOfWeekMonday(addDays(monthEnd, 6)), 6);

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-3 px-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="text-center text-slate-600 font-semibold">
            {weekdayShortFR(i)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayEvents = events.filter((e) => inRangeISO(iso, e.startDate, e.endDate));

          const visible = dayEvents.slice(0, 3);
          const hiddenCount = Math.max(0, dayEvents.length - visible.length);

          return (
            <DroppableDayCell key={iso} iso={iso} dayNumber={d.getDate()} faded={!inMonth} onClick={() => onCellClick(iso)}>
              {visible.map((e) => (
                <EventPill key={`${e.id}@${iso}`} e={e} cellISO={iso} onEventClick={onEventClick} onPdf={onPdf} />
              ))}

              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="w-full rounded-lg border bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    const cell = ev.currentTarget.closest("[data-iso]") as HTMLElement | null;
                    const rect = cell?.getBoundingClientRect();
                    if (rect) onMore(iso, rect);
                  }}
                  title="Afficher les autres chantiers"
                >
                  +{hiddenCount} autres
                </button>
              )}
            </DroppableDayCell>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  cursor,
  events,
  onCellClick,
  onEventClick,
  onPdf,
}: {
  cursor: Date;
  events: ChantierEvent[];
  onCellClick: (iso: string) => void;
  onEventClick: (eventId: string) => void;
  onPdf: (eventId: string) => void;
}) {
  const w0 = startOfWeekMonday(cursor);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(w0, i));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-3 px-1">
        {days.map((_, i) => (
          <div key={i} className="text-center text-slate-600 font-semibold">
            {weekdayShortFR(i)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days.map((d) => {
          const iso = toISODate(d);
          const dayEvents = events.filter((e) => inRangeISO(iso, e.startDate, e.endDate));

          return (
            <DroppableDayCell key={iso} iso={iso} dayNumber={d.getDate()} faded={false} onClick={() => onCellClick(iso)}>
              {dayEvents.map((e) => (
                <EventPill key={`${e.id}@${iso}`} e={e} cellISO={iso} onEventClick={onEventClick} onPdf={onPdf} />
              ))}
            </DroppableDayCell>
          );
        })}
      </div>
    </div>
  );
}

function DayView({
  cursor,
  events,
  onAdd,
  onEventClick,
  onPdf,
}: {
  cursor: Date;
  events: ChantierEvent[];
  onAdd: () => void;
  onEventClick: (eventId: string) => void;
  onPdf: (eventId: string) => void;
}) {
  const iso = toISODate(cursor);
  const dayEvents = events.filter((e) => inRangeISO(iso, e.startDate, e.endDate));

  return (
    <DroppableDayCell iso={iso} dayNumber={cursor.getDate()} faded={false} onClick={onAdd}>
      {dayEvents.length === 0 ? (
        <div className="text-sm text-slate-500">Aucun chantier prévu.</div>
      ) : (
        dayEvents.map((e) => <EventPill key={`${e.id}@${iso}`} e={e} cellISO={iso} onEventClick={onEventClick} onPdf={onPdf} />)
      )}
    </DroppableDayCell>
  );
}

function EventPill({
  e,
  cellISO,
  onEventClick,
  onPdf,
}: {
  e: ChantierEvent;
  cellISO: string;
  onEventClick: (id: string) => void;
  onPdf: (id: string) => void;
}) {
  const bg = getChantierColor(String(e.type));

  const statusLabel = e.status === "EN_ATTENTE" ? "En attente" : e.status === "EN_COURS" ? "En cours" : "Terminé";

  const statusDotStyle: React.CSSProperties =
    e.status === "EN_ATTENTE"
      ? { backgroundColor: "#64748b" }
      : e.status === "EN_COURS"
        ? { backgroundColor: "#f59e0b" }
        : { backgroundColor: "#22c55e" };

  return (
    <DraggablePill draggableId={`${e.id}@${cellISO}`} style={{ backgroundColor: bg }} onClick={() => onEventClick(e.id)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-white font-semibold leading-5">{e.title}</div>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold bg-black/30 text-white hover:bg-black/40"
          title="Ouvrir le PDF"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => {
            ev.stopPropagation();
            onPdf(e.id);
          }}
        >
          PDF
        </button>
      </div>

      <div className="mt-1 inline-flex items-center gap-2 rounded-md bg-white/85 px-2 py-0.5 text-[10px] font-bold text-slate-900 whitespace-nowrap">
        <span className="h-2 w-2 rounded-full" style={statusDotStyle} aria-hidden="true" />
        <span>{statusLabel}</span>
      </div>
    </DraggablePill>
  );
}