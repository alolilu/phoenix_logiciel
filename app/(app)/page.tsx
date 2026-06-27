"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { uploadPhotos } from "@/lib/uploadPhotos";
import type { PhotoDTO } from "@/lib/uploadPhotos";


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
  "nettoyage de bureau": "#16A34A",
  "sinistre incendie": "#B91C1C",
  "degats des eaux": "#F97316",
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
  "Nettoyage de bureau",
  "Sinistre incendie",
  "Dégâts des eaux",
] as const;

type ChantierType = (typeof CHANTIER_TYPES)[number];
type ChantierStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE";
type ViewMode = "jour" | "semaine" | "mois";
type RecurrenceFrequency = "NONE" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

type ChantierEvent = {
  id: string;
  type: ChantierType | string;
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  status: ChantierStatus;
  archived: boolean;
  intervenants: string[];
  notes?: string;
  recurrenceFrequency?: "NONE" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  recurrenceEndDate?: string | null;
  isRecurringTemplate?: boolean;
  recurrenceGroupId?: string | null;
  updatedAt?: string;
};

type StaffDto = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  notes: string | null;
  fullName: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const FOREST_BTN = "bg-[#183536] text-white";

const STATUS_LABEL: Record<ChantierStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
};

function statusLabelFR(s: ChantierStatus) {
  return s === "EN_ATTENTE" ? "En attente" : s === "EN_COURS" ? "En cours" : "Terminé";
}

function statusDotColor(s: ChantierStatus) {
  return s === "EN_ATTENTE" ? "#64748b" : s === "EN_COURS" ? "#f59e0b" : "#22c55e";
}

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
  const months = ["JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
function monthTitleFRFull(d: Date) {
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
function weekdayShortFR(i: number) {
  return ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i]!;
}
function weekdayMinFR(i: number) {
  return ["L", "M", "M", "J", "V", "S", "D"][i]!;
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
function isTodayISO(iso: string) {
  return iso === toISODate(startOfDay(new Date()));
}
function isWeekendISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day === 0 || day === 6;
}
function dayLabelFR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[dt.getDay()]} ${d} ${months[m - 1]}`;
}

function generateHours() {
  return Array.from({ length: 14 }, (_, i) => String(i + 7).padStart(2, "0"));
}

function generateMinuteSteps(stepMinutes = 15) {
  const steps: string[] = [];
  for (let m = 0; m < 60; m += stepMinutes) {
    steps.push(String(m).padStart(2, "0"));
  }
  return steps;
}

const HOURS_LIST = generateHours();
const MINUTES_LIST_15 = generateMinuteSteps(15);

function splitTime(time: string): [string, string] {
  const [h, m] = (time || "09:00").split(":");
  return [h ?? "09", m ?? "00"];
}

type ClientInfo = { nom: string; tel: string; email: string; adresse: string };

const EMPTY_CLIENT: ClientInfo = { nom: "", tel: "", email: "", adresse: "" };

function extractClientBlock(notesRaw: string): { client: ClientInfo; restNotes: string } {
  const raw = String(notesRaw || "");

  const start = raw.indexOf("[[CLIENT]]");
  const end = raw.indexOf("[[/CLIENT]]");
  if (start !== -1 && end !== -1 && end > start) {
    const block = raw.slice(start + "[[CLIENT]]".length, end).trim();
    const rest = (raw.slice(0, start) + raw.slice(end + "[[/CLIENT]]".length)).trim();

    const client: ClientInfo = { ...EMPTY_CLIENT };
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

    return { client, restNotes: rest || "" };
  }

  const s2 = raw.indexOf("<<<CLIENT>>>");
  const m2 = raw.indexOf("<<<NOTES>>>");
  if (s2 !== -1 && m2 !== -1 && m2 > s2) {
    const clientText = raw.slice(s2 + "<<<CLIENT>>>".length, m2).trim();
    const rest = raw.slice(m2 + "<<<NOTES>>>".length).trim();

    const client: ClientInfo = { ...EMPTY_CLIENT, adresse: clientText };
    return { client, restNotes: rest || "" };
  }

  return { client: { ...EMPTY_CLIENT }, restNotes: raw.trim() };
}

function buildNotesWithClient(client: ClientInfo, restNotes: string) {
  const c = client || EMPTY_CLIENT;
  const lines = [
    "[[CLIENT]]",
    `nom=${(c.nom || "").trim()}`,
    `tel=${(c.tel || "").trim()}`,
    `email=${(c.email || "").trim()}`,
    `adresse=${(c.adresse || "").trim()}`,
    "[[/CLIENT]]",
    "",
    (restNotes || "").trim(),
  ];

  return lines.join("\n").trim() + "\n";
}

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

function Legend({ title = "Légende des chantiers", collapsible = false }: { title?: string; collapsible?: boolean }) {
  const [open, setOpen] = useState(!collapsible);

  return (
    <div className="rounded-xl border bg-white p-4 md:p-6 shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between text-left"
        onClick={() => collapsible && setOpen((v) => !v)}
        disabled={!collapsible}
      >
        <div className="text-base md:text-xl font-semibold">{title}</div>
        {collapsible && (
          <span className="text-slate-500 text-sm">{open ? "▲" : "▼"}</span>
        )}
      </button>

      {open && (
        <div className="mt-3 md:mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {CHANTIER_TYPES.map((label) => {
            const color = getChantierColor(label);
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs md:text-sm">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={[
          "relative w-full bg-white shadow-xl flex flex-col overflow-hidden",
          "h-[100dvh] rounded-none",
          "md:max-w-5xl md:h-[92vh] md:rounded-2xl",
        ].join(" ")}
      >
        <div className="bg-[#183536] px-4 py-4 flex items-center justify-between shrink-0">
          <div className="text-white font-bold text-base">{title}</div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white font-bold text-sm"
            aria-label="Fermer"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

function MobileCompactDayCell({
  iso,
  dayNumber,
  inMonth,
  events,
  isSelected,
  onClick,
}: {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  events: ChantierEvent[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const today = isTodayISO(iso);
  const weekend = isWeekendISO(iso);

  const dotColors = useMemo(() => {
    const colors = events.map((e) => getChantierColor(String(e.type)));
    const unique = Array.from(new Set(colors));
    return unique.slice(0, 3);
  }, [events]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col items-center justify-start pt-1 pb-1.5 rounded-xl min-h-[52px] w-full transition-colors duration-100 active:scale-[0.96]",
        isSelected ? "bg-[#183536]" : today ? "bg-[#183536]/10" : weekend ? "bg-slate-100" : "bg-slate-50",
        !inMonth ? "opacity-35" : "",
      ].join(" ")}
    >
      <span
        className={[
          "text-sm font-semibold leading-none",
          isSelected ? "text-white" : today ? "text-[#183536]" : "text-slate-800",
        ].join(" ")}
      >
        {dayNumber}
      </span>

      <div className="flex items-center justify-center mt-1 min-h-[6px]">
        <span
          className="h-[5px] rounded-full"
          style={{
            backgroundColor: isSelected ? "rgba(255,255,255,0.85)" : (dotColors[0] ?? "#94a3b8"),
            width: events.length === 0 ? 0 : events.length === 1 ? 5 : events.length === 2 ? 10 : events.length === 3 ? 16 : 22,
            opacity: events.length === 0 ? 0 : 1,
          }}
        />
      </div>
    </button>
  );
}

function MobileDayEventCard({
  event,
  onOpen,
  onPdf,
}: {
  event: ChantierEvent;
  onOpen: () => void;
  onPdf: () => void;
}) {
  const color = getChantierColor(String(event.type));
  const dot = statusDotColor(event.status);

  return (
    <div
      className="flex items-stretch gap-0 rounded-2xl border overflow-hidden bg-white active:scale-[0.99] transition-transform cursor-pointer"
      onClick={onOpen}
    >
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />

      <div className="flex-1 min-w-0 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 text-sm leading-snug truncate">
              {event.title}
              {event.startTime && event.endTime && (
                <span className="font-mono text-[10px] text-slate-500 ml-1">({event.startTime} - {event.endTime})</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {String(event.type)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
                {statusLabelFR(event.status)}
              </span>
            </div>
            {event.intervenants && event.intervenants.length > 0 && (
              <div className="mt-1 text-[11px] text-slate-500 truncate">
                {event.intervenants.join(", ")}
              </div>
            )}
          </div>

          <button
            type="button"
            className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold bg-[#183536] text-white hover:opacity-90 active:opacity-70"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPdf();
            }}
          >
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileMonthGrid({
  cursor,
  events,
  selectedIso,
  onSelectDay,
  onSwipeLeft,
  onSwipeRight,
}: {
  cursor: Date;
  events: ChantierEvent[];
  selectedIso: string;
  onSelectDay: (iso: string) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const days: { date: Date; iso: string; inMonth: boolean }[] = [];
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) {
    days.push({
      date: d,
      iso: toISODate(d),
      inMonth: true,
    });
  }

  const firstWeekday = (monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  return (
    <div
      className="select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="grid grid-cols-7 mb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-slate-400 py-1">
            {weekdayMinFR(i)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 w-full">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(({ date, iso, inMonth }) => {
          const dayEvents = events
            .filter((e) => inRangeISO(iso, e.startDate, e.endDate))
            .sort((a, b) => {
              const timeA = a.startTime || "00:00";
              const timeB = b.startTime || "00:00";
              return timeA.localeCompare(timeB);
            });
          return (
            <MobileCompactDayCell
              key={iso}
              iso={iso}
              dayNumber={date.getDate()}
              inMonth={inMonth}
              events={dayEvents}
              isSelected={iso === selectedIso}
              onClick={() => onSelectDay(iso)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DesktopMonthGrid({
  cursor,
  events,
  onSelectDay,
}: {
  cursor: Date;
  events: ChantierEvent[];
  onSelectDay: (iso: string) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const days: { date: Date; iso: string; inMonth: boolean }[] = [];
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) {
    days.push({
      date: d,
      iso: toISODate(d),
      inMonth: true,
    });
  }

  const firstWeekday = (monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1);

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((day, i) => (
          <div key={i} className="text-center text-sm font-semibold text-slate-600 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] rounded-xl bg-slate-50/50" />
        ))}
        {days.map(({ date, iso, inMonth }) => {
          const dayEvents = events
            .filter((e) => inRangeISO(iso, e.startDate, e.endDate))
            .sort((a, b) => {
              const timeA = a.startTime || "00:00";
              const timeB = b.startTime || "00:00";
              return timeA.localeCompare(timeB);
            });
          const isToday = isTodayISO(iso);
          const isWeekend = isWeekendISO(iso);

          return (
            <div
              key={iso}
              onClick={() => onSelectDay(iso)}
              className={[
                "min-h-[100px] rounded-xl border p-2 cursor-pointer hover:shadow-md transition-shadow",
                !inMonth ? "opacity-40" : "",
                isWeekend ? "bg-slate-100" : "bg-white",
                isToday ? "border-[#183536] ring-2 ring-[#183536]/20" : "border-slate-200",
              ].join(" ")}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={[
                  "text-sm font-semibold",
                  isToday ? "text-[#183536]" : "text-slate-700",
                ].join(" ")}>
                  {date.getDate()}
                </span>
                {isToday && (
                  <span className="text-[10px] font-bold text-[#183536] bg-[#183536]/10 rounded-full px-2 py-0.5">
                    Aujourd'hui
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 4).map((e) => {
                  const color = getChantierColor(String(e.type));
                  const dot = statusDotColor(e.status);
                  const timeLabel = e.startTime ? `${e.startTime}` : "";
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium truncate"
                      style={{ backgroundColor: color + "20", borderLeft: `3px solid ${color}` }}
                      title={`${e.title} ${timeLabel}`}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                      <span className="truncate text-slate-800">
                        {e.title}
                        {timeLabel && <span className="font-mono text-[10px] text-slate-500 ml-1">({timeLabel})</span>}
                      </span>
                    </div>
                  );
                })}
                {dayEvents.length > 4 && (
                  <div className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5">
                    +{dayEvents.length - 4} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileWeekGrid({
  cursor,
  events,
  selectedIso,
  onSelectDay,
  onSwipeLeft,
  onSwipeRight,
}: {
  cursor: Date;
  events: ChantierEvent[];
  selectedIso: string;
  onSelectDay: (iso: string) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const w0 = startOfWeekMonday(cursor);
  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(w0, i);
    return { date, iso: toISODate(date) };
  });

  const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const MONTHS_SHORT = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  return (
    <div
      className="select-none space-y-1"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {days.map(({ date, iso }, i) => {
        const today = isTodayISO(iso);
        const weekend = isWeekendISO(iso);
        const dayEvents = events
          .filter((e) => inRangeISO(iso, e.startDate, e.endDate))
          .sort((a, b) => {
            const timeA = a.startTime || "00:00";
            const timeB = b.startTime || "00:00";
            return timeA.localeCompare(timeB);
          });

        return (
          <div
            key={iso}
            className="rounded-xl border overflow-hidden cursor-pointer"
            onClick={() => onSelectDay(iso)}
          >
            {/* En-tête compact */}
            <div
              className={[
                "flex items-center gap-2 px-2.5 py-1.5 border-b",
                "bg-white",
              ].join(" ")}
            >
              <div
                className={[
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                  today ? "bg-[#183536] text-white" : "bg-slate-100 text-slate-700",
                ].join(" ")}
              >
                {date.getDate()}
              </div>
              <span className="text-xs font-semibold text-slate-900">
                {WEEKDAYS[i]}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {date.getDate()} {MONTHS_SHORT[date.getMonth()]}
                {today && (
                  <span className="ml-1.5 text-[9px] font-bold text-[#183536] bg-[#183536]/10 rounded-full px-1.5 py-0.5">Aujourd'hui</span>
                )}
              </span>
            </div>

            {/* Chantiers */}
            {dayEvents.length === 0 ? (
              <div className="px-2.5 py-1.5 text-[10px] text-slate-400 bg-white">
                Aucun chantier
              </div>
            ) : (
              <div className="bg-white px-1.5 py-1.5 space-y-1">
                {dayEvents.map((e) => {
                  const color = getChantierColor(String(e.type));
                  const dot = statusDotColor(e.status);
                  return (
                    <div
                      key={e.id}
                      className="flex items-stretch rounded-lg overflow-hidden active:scale-[0.99] transition-transform cursor-pointer"
                      onClick={() => onSelectDay(iso)}
                    >
                      <div className="w-[3px] shrink-0" style={{ backgroundColor: color }} />
                      <div
                        className="flex-1 flex items-center gap-2 px-2 py-1.5"
                        style={{ backgroundColor: color + "18" }}
                      >
                        <span
                          className="text-[11px] font-semibold flex-1 truncate"
                          style={{ color }}
                        >
                          {e.title}
                          {e.startTime && e.endTime && (
                            <span className="font-mono text-[10px] text-slate-500 ml-1">({e.startTime} - {e.endTime})</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
                          {statusLabelFR(e.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MobileDayList({
  selectedIso,
  events,
  onOpenEvent,
  onPdf,
  onAddNew,
}: {
  selectedIso: string;
  events: ChantierEvent[];
  onOpenEvent: (id: string) => void;
  onPdf: (id: string) => void;
  onAddNew: () => void;
}) {
  const dayEvents = events
    .filter((e) => inRangeISO(selectedIso, e.startDate, e.endDate))
    .sort((a, b) => {
      const timeA = a.startTime || "00:00";
      const timeB = b.startTime || "00:00";
      return timeA.localeCompare(timeB);
    });

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 py-3">
        <div className="font-semibold text-slate-800 text-sm capitalize">
          {dayLabelFR(selectedIso)}
          {isTodayISO(selectedIso) && (
            <span className="ml-2 text-[11px] font-bold text-[#183536] bg-[#183536]/10 rounded-full px-2 py-0.5">Aujourd'hui</span>
          )}
        </div>
        <button
          type="button"
          onClick={onAddNew}
          className="rounded-xl bg-[#183536] text-white px-3 py-1.5 text-xs font-semibold active:opacity-80"
        >
          + Nouveau
        </button>
      </div>

      <div className="space-y-2 pb-4">
        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Aucun chantier ce jour
          </div>
        ) : (
          dayEvents.map((e) => (
            <MobileDayEventCard
              key={e.id}
              event={e}
              onOpen={() => onOpenEvent(e.id)}
              onPdf={() => onPdf(e.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MobileDayPopup({
  iso,
  events,
  onClose,
  onOpenEvent,
  onPdf,
  onAddNew,
}: {
  iso: string;
  events: ChantierEvent[];
  onClose: () => void;
  onOpenEvent: (id: string) => void;
  onPdf: (id: string) => void;
  onAddNew: () => void;
}) {
  const dayEvents = events
    .filter((e) => inRangeISO(iso, e.startDate, e.endDate))
    .sort((a, b) => {
      const timeA = a.startTime || "00:00";
      const timeB = b.startTime || "00:00";
      return timeA.localeCompare(timeB);
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[90%] max-w-[600px] bg-white rounded-2xl shadow-2xl min-h-[50vh] max-h-[80dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#183536] active:opacity-70"
          >
            ‹ Retour
          </button>
          <div className="font-bold text-slate-900 text-sm capitalize">{dayLabelFR(iso)}</div>
          <button
            type="button"
            onClick={onAddNew}
            className="rounded-xl bg-[#183536] text-white px-3 py-1.5 text-xs font-semibold active:opacity-80"
          >
            + Nouveau
          </button>
        </div>

        <div className="overflow-auto flex-1 px-3 py-3 space-y-2 flex flex-col">
          {dayEvents.length === 0 ? (
            <div className="flex-1 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 flex items-center justify-center">
              Aucun chantier ce jour
            </div>
          ) : (
            dayEvents.map((e) => (
              <MobileDayEventCard
                key={e.id}
                event={e}
                onOpen={() => { onOpenEvent(e.id); onClose(); }}
                onPdf={() => onPdf(e.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [view, setView] = useState<ViewMode>("mois");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<ChantierEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<ChantierStatus | "ALL">("ALL");

  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const [mobileSelectedIso, setMobileSelectedIso] = useState<string>(() => toISODate(startOfDay(new Date())));
  const [mobileDayPopupIso, setMobileDayPopupIso] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const todayISO = toISODate(startOfDay(new Date()));
  const [formType, setFormType] = useState<ChantierType>("Diogène");
  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState(todayISO);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formEnd, setFormEnd] = useState(todayISO);
  const [formStatus, setFormStatus] = useState<ChantierStatus>("EN_ATTENTE");
  const [formArchived, setFormArchived] = useState(false);
  const [formIntervenants, setFormIntervenants] = useState<string[]>([]);
  const [formRecurrenceFrequency, setFormRecurrenceFrequency] = useState<RecurrenceFrequency>("NONE");
  const [formRecurrenceEndDate, setFormRecurrenceEndDate] = useState("");

  const inactiveAssigned = useMemo(() => {
    if (!Array.isArray(formIntervenants) || formIntervenants.length === 0) return [];
    if (!Array.isArray(staff) || staff.length === 0) return [];

    const inactiveNames = new Set(
      staff
        .filter((m) => m.isActive === false)
        .map((m) => (m.fullName || `${m.firstName} ${m.lastName}`.trim()).trim())
        .filter(Boolean)
    );

    return formIntervenants.filter((name) => inactiveNames.has(String(name).trim()));
  }, [formIntervenants, staff]);

  const [formNotes, setFormNotes] = useState("");

  const [clientNom, setClientNom] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");

  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  async function onUploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const jobId = editingId;
    if (!jobId) {
      console.warn("Aucun chantier sélectionné (editingId null)");
      e.target.value = "";
      return;
    }

    const list = e.target.files;
    if (!list || list.length === 0) return;

    const files = Array.from(list);
    e.target.value = "";

    setError(null);
    try {
      await uploadPhotos({
        jobId,
        files,
        setPhotos: (p: PhotoDTO[]) => setPhotos(p),
        setPhotosLoading: (v: boolean) => setPhotosLoading(v),
        onPhotoAdded: (p) => setPhotos((prev) => {
          if (prev.some((x) => x.id === p.id)) return prev;
          return [p, ...prev];
        }),
      });
    } catch (err: any) {
      setError(err?.message ?? "Erreur upload photos");
      setPhotos([]);
      setPhotosLoading(false);
    }
  }

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

  function openNewChantier(dateISO?: string) {
    const d = dateISO ?? toISODate(cursor);
    setEditingId(null);

    setFormType("Diogène");
    setFormTitle("");
    setFormStart(d);
    setFormEnd(d);
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setFormStatus("EN_ATTENTE");
    setFormArchived(false);
    setFormIntervenants([]);
    setFormRecurrenceFrequency("NONE");
    setFormRecurrenceEndDate(d);

    setFormNotes("");
    setClientNom("");
    setClientTel("");
    setClientEmail("");
    setClientAdresse("");

    setPhotos([]);
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
    setFormStartTime(ev.startTime ?? "09:00");
    setFormEndTime(ev.endTime ?? "10:00");
    setFormStatus(ev.status);
    setFormArchived(ev.archived);
    setFormIntervenants(ev.intervenants?.length ? ev.intervenants : []);
    setFormRecurrenceFrequency((ev.recurrenceFrequency as RecurrenceFrequency) ?? "NONE");
    setFormRecurrenceEndDate(ev.recurrenceEndDate ?? ev.endDate);

    const { client, restNotes } = extractClientBlock(ev.notes ?? "");
    setClientNom(client.nom || "");
    setClientTel(client.tel || "");
    setClientEmail(client.email || "");
    setClientAdresse(client.adresse || "");
    setFormNotes(restNotes || "");

    setModalOpen(true);
    refreshPhotos(ev.id);
  }

  async function saveChantier() {
    setError(null);

    const title = formTitle.trim();
    if (!title) return window.alert("Le titre est obligatoire.");
    if (formEnd < formStart) return window.alert("La date de fin doit être >= date de début.");

    if (
      formType === "Nettoyage de bureau" &&
      formRecurrenceFrequency !== "NONE" &&
      !formRecurrenceEndDate
    ) {
      return window.alert("La date de fin de récurrence est obligatoire.");
    }

    if (
      formType === "Nettoyage de bureau" &&
      formRecurrenceFrequency !== "NONE" &&
      formRecurrenceEndDate < formStart
    ) {
      return window.alert("La date de fin de récurrence doit être >= à la date de début.");
    }

    const notesPacked = buildNotesWithClient(
      { nom: clientNom, tel: clientTel, email: clientEmail, adresse: clientAdresse },
      formNotes
    );

    setSaving(true);
    try {
      if (!editingId) {
        const created = await createChantier({
          type: formType,
          title,
          startDate: formStart,
          endDate: formEnd,
          startTime: formStartTime,
          endTime: formEndTime,
          status: formStatus,
          archived: formArchived,
          intervenants: formIntervenants,
          notes: notesPacked,
          recurrenceFrequency:
            formType === "Nettoyage de bureau" ? formRecurrenceFrequency : "NONE",
          recurrenceEndDate:
            formType === "Nettoyage de bureau" && formRecurrenceFrequency !== "NONE"
              ? formRecurrenceEndDate
              : null,
        });

        await refresh();

        setEditingId(created.id);
        await refreshPhotos(created.id);
      } else {
        const updated = await updateChantier(editingId, {
          type: formType,
          title,
          startDate: formStart,
          endDate: formEnd,
          startTime: formStartTime,
          endTime: formEndTime,
          status: formStatus,
          archived: formArchived,
          intervenants: formIntervenants,
          notes: notesPacked,
          recurrenceFrequency:
            formType === "Nettoyage de bureau" ? formRecurrenceFrequency : "NONE",
          recurrenceEndDate:
            formType === "Nettoyage de bureau" && formRecurrenceFrequency !== "NONE"
              ? formRecurrenceEndDate
              : null,
        });

        await refresh();
        await refreshPhotos(updated.id);
      }

      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function finishAndOpenPdf() {
    if (!editingId) return;

    setSaving(true);
    setError(null);

    try {
      await updateChantier(editingId, {
        status: "TERMINE",
      });

      await refresh();

      window.open(`/api/chantiers/${editingId}/pdf`, "_blank", "noopener,noreferrer");

      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Erreur Terminer + PDF");
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
    if (view === "mois") {
      setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else if (view === "semaine") {
      setCursor((d) => addDays(d, -7));
    } else {
      setCursor((d) => addDays(d, -1));
    }
  }
  function gotoNext() {
    if (view === "mois") {
      setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else if (view === "semaine") {
      setCursor((d) => addDays(d, 7));
    } else {
      setCursor((d) => addDays(d, 1));
    }
  }
  function gotoToday() {
    setCursor(startOfDay(new Date()));
    setMobileSelectedIso(toISODate(startOfDay(new Date())));
  }

  function mobileSwipeLeft() {
    if (view === "mois") setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (view === "semaine") setCursor((d) => addDays(d, 7));
  }
  function mobileSwipeRight() {
    if (view === "mois") setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (view === "semaine") setCursor((d) => addDays(d, -7));
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


  const filteredEvents = useMemo(() => {
    if (statusFilter === "ALL") return events;
    return events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter]);

  return (
    <main className="bg-slate-50 min-h-screen">
      <div className="max-w-[2500px] mx-auto px-0 md:px-6 lg:px-8 py-0 md:py-6">
        {error && (
          <div className="mx-3 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            <div className="font-semibold">Erreur</div>
            <div className="mt-1 whitespace-pre-wrap">{error}</div>
          </div>
        )}

        <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
          <div className="px-3 pt-3 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg md:text-2xl font-bold leading-tight">Phoenix Ops – Planning</div>
                <div className="text-xs md:text-sm text-slate-500 mt-0.5">Gestion des chantiers</div>
              </div>
              <button
                onClick={() => openNewChantier()}
                className="hidden md:flex rounded-xl bg-[#183536] text-white px-6 py-2.5 text-sm font-semibold hover:opacity-90"
              >
                + Nouveau chantier
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={gotoPrev} className="h-7 w-7 md:h-10 md:w-10 flex items-center justify-center rounded-lg md:rounded-xl border bg-white text-slate-600 text-base md:text-lg hover:bg-slate-50 active:bg-slate-100 transition-colors">
                ‹
              </button>
              <button onClick={gotoNext} className="h-7 w-7 md:h-10 md:w-10 flex items-center justify-center rounded-lg md:rounded-xl border bg-white text-slate-600 text-base md:text-lg hover:bg-slate-50 active:bg-slate-100 transition-colors">
                ›
              </button>
              <button onClick={gotoToday} className="hidden md:flex rounded-xl bg-[#183536] text-white px-4 py-2 text-sm font-semibold hover:opacity-90">
                Aujourd'hui
              </button>
            </div>

            <div className={view === "mois" ? "font-bold text-base text-slate-900" : "font-semibold text-[10px] md:text-[11px] text-slate-700 text-center"}>
              {view === "mois" ? monthTitleFRFull(cursor) : headerTitle}
            </div>

            <div className="flex items-center gap-1">
              <div className="flex rounded-lg md:rounded-xl border overflow-hidden">
                <button onClick={() => setView("mois")} className={`px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm font-semibold ${view === "mois" ? FOREST_BTN : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  Mois
                </button>
                <button onClick={() => setView("semaine")} className={`px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm font-semibold border-l ${view === "semaine" ? FOREST_BTN : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  Sem.
                </button>
                <button onClick={() => { setView("jour"); setCursor(parseISODateUTC(mobileSelectedIso)); }} className={`px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm font-semibold border-l ${view === "jour" ? FOREST_BTN : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  Jour
                </button>
              </div>
            </div>
          </div>

          <div className="px-2 pb-2">
            {loading ? (
              <div className="text-center py-4 text-sm text-slate-500">Chargement…</div>
            ) : view === "mois" ? (
              <>
                {/* Version mobile */}
                <div className="md:hidden">
                  <MobileMonthGrid
                    cursor={cursor}
                    events={filteredEvents}
                    selectedIso={mobileSelectedIso}
                    onSelectDay={(iso) => {
                      setMobileSelectedIso(iso);
                      const [y, m] = iso.split("-").map(Number);
                      if (y !== cursor.getFullYear() || m !== cursor.getMonth() + 1) {
                        setCursor(new Date(y, m - 1, 1));
                      }
                      setMobileDayPopupIso(iso);
                    }}
                    onSwipeLeft={mobileSwipeLeft}
                    onSwipeRight={mobileSwipeRight}
                  />
                </div>
                {/* Version desktop */}
                <div className="hidden md:block">
                  <DesktopMonthGrid
                    cursor={cursor}
                    events={filteredEvents}
                    onSelectDay={(iso) => {
                      setMobileSelectedIso(iso);
                      const [y, m] = iso.split("-").map(Number);
                      if (y !== cursor.getFullYear() || m !== cursor.getMonth() + 1) {
                        setCursor(new Date(y, m - 1, 1));
                      }
                      setMobileDayPopupIso(iso);
                    }}
                  />
                </div>
              </>
            ) : view === "semaine" ? (
              <MobileWeekGrid
                cursor={cursor}
                events={filteredEvents}
                selectedIso={mobileSelectedIso}
                onSelectDay={(iso) => {
                  setMobileSelectedIso(iso);
                  setMobileDayPopupIso(iso);
                }}
                onSwipeLeft={mobileSwipeLeft}
                onSwipeRight={mobileSwipeRight}
              />
            ) : view === "jour" ? (
              <MobileDayList
                selectedIso={toISODate(cursor)}
                events={filteredEvents}
                onOpenEvent={(id) => {
                  const ev = events.find((x) => x.id === id);
                  if (ev) openEditChantier(ev);
                }}
                onPdf={(id) => openPdf(id)}
                onAddNew={() => openNewChantier(toISODate(cursor))}
              />
            ) : null}
          </div>
        </div>

        <div className="pt-2 mb-6">
          <Legend title="Légende" collapsible={true} />
        </div>

        {mobileDayPopupIso && (
          <MobileDayPopup
            iso={mobileDayPopupIso}
            events={filteredEvents}
            onClose={() => setMobileDayPopupIso(null)}
            onOpenEvent={(id) => {
              const ev = events.find((x) => x.id === id);
              if (ev) openEditChantier(ev);
            }}
            onPdf={(id) => openPdf(id)}
            onAddNew={() => {
              setMobileDayPopupIso(null);
              openNewChantier(mobileDayPopupIso);
            }}
          />
        )}

        <Modal open={modalOpen} title={editingId ? "Modifier chantier" : "Nouveau chantier"} onClose={() => setModalOpen(false)}>
          <ModalForm
            editingId={editingId}
            saving={saving}
            staffLoading={staffLoading}
            staff={staff}
            inactiveAssigned={inactiveAssigned}
            photos={photos}
            setPhotos={setPhotos}
            setError={setError}
            photosLoading={photosLoading}
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            formType={formType} setFormType={setFormType}
            formTitle={formTitle} setFormTitle={setFormTitle}
            formStart={formStart} setFormStart={setFormStart}
            formEnd={formEnd} setFormEnd={setFormEnd}
            formStartTime={formStartTime} setFormStartTime={setFormStartTime}
            formEndTime={formEndTime} setFormEndTime={setFormEndTime}
            formStatus={formStatus} setFormStatus={setFormStatus}
            formArchived={formArchived} setFormArchived={setFormArchived}
            formIntervenants={formIntervenants} setFormIntervenants={setFormIntervenants}
            formRecurrenceFrequency={formRecurrenceFrequency} setFormRecurrenceFrequency={setFormRecurrenceFrequency}
            formRecurrenceEndDate={formRecurrenceEndDate} setFormRecurrenceEndDate={setFormRecurrenceEndDate}
            formNotes={formNotes} setFormNotes={setFormNotes}
            clientNom={clientNom} setClientNom={setClientNom}
            clientTel={clientTel} setClientTel={setClientTel}
            clientEmail={clientEmail} setClientEmail={setClientEmail}
            clientAdresse={clientAdresse} setClientAdresse={setClientAdresse}
            onUploadPhotos={onUploadPhotos}
            onRefreshStaff={refreshStaff}
            onRefreshPhotos={refreshPhotos}
            onOpenPdf={openPdf}
            onSave={saveChantier}
            onFinishAndPdf={finishAndOpenPdf}
            onDelete={deleteCurrent}
            onCancel={() => setModalOpen(false)}
          />
        </Modal>
      </div>
    </main>
  );
}

function ModalForm({
  editingId, saving, staffLoading, staff, inactiveAssigned,
  photos, setPhotos, setError, photosLoading, fileInputRef, cameraInputRef,
  formType, setFormType,
  formTitle, setFormTitle,
  formStart, setFormStart,
  formEnd, setFormEnd,
  formStartTime, setFormStartTime,
  formEndTime, setFormEndTime,
  formStatus, setFormStatus,
  formArchived, setFormArchived,
  formIntervenants, setFormIntervenants,
  formRecurrenceFrequency, setFormRecurrenceFrequency,
  formRecurrenceEndDate, setFormRecurrenceEndDate,
  formNotes, setFormNotes,
  clientNom, setClientNom,
  clientTel, setClientTel,
  clientEmail, setClientEmail,
  clientAdresse, setClientAdresse,
  onUploadPhotos, onRefreshStaff, onRefreshPhotos, onOpenPdf,
  onSave, onFinishAndPdf, onDelete, onCancel,
}: {
  editingId: string | null;
  saving: boolean;
  staffLoading: boolean;
  staff: StaffDto[];
  inactiveAssigned: string[];
  photos: PhotoDTO[];
  setPhotos: (value: PhotoDTO[] | ((prev: PhotoDTO[]) => PhotoDTO[])) => void;
  setError: (error: string | null) => void;
  photosLoading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  formType: ChantierType; setFormType: (v: ChantierType) => void;
  formTitle: string; setFormTitle: (v: string) => void;
  formStart: string; setFormStart: (v: string) => void;
  formEnd: string; setFormEnd: (v: string) => void;
  formStartTime: string; setFormStartTime: (v: string) => void;
  formEndTime: string; setFormEndTime: (v: string) => void;
  formStatus: ChantierStatus; setFormStatus: (v: ChantierStatus) => void;
  formArchived: boolean; setFormArchived: (v: boolean) => void;
  formIntervenants: string[]; setFormIntervenants: (v: string[]) => void;
  formRecurrenceFrequency: RecurrenceFrequency; setFormRecurrenceFrequency: (v: RecurrenceFrequency) => void;
  formRecurrenceEndDate: string; setFormRecurrenceEndDate: (v: string) => void;
  formNotes: string; setFormNotes: (v: string) => void;
  clientNom: string; setClientNom: (v: string) => void;
  clientTel: string; setClientTel: (v: string) => void;
  clientEmail: string; setClientEmail: (v: string) => void;
  clientAdresse: string; setClientAdresse: (v: string) => void;
  onUploadPhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshStaff: () => void;
  onRefreshPhotos: (id: string) => void;
  onOpenPdf: (id: string) => void;
  onSave: () => void;
  onFinishAndPdf: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const safePhotos: PhotoDTO[] = Array.isArray(photos) ? photos : [];

  return (
    <div className="flex flex-col gap-4 pb-2">

      {/* ── PHOTOS EN PREMIER (priorité mobile) ── */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-800">Photos du chantier</span>
          {editingId && (
            <button
              type="button"
              className="text-xs text-slate-500 underline"
              onClick={() => onRefreshPhotos(editingId)}
              disabled={photosLoading}
            >
              {photosLoading ? "Chargement…" : "Actualiser"}
            </button>
          )}
        </div>

        {!editingId ? (
          <div className="px-4 py-5 text-sm text-slate-500 text-center">
            Enregistre le chantier d'abord pour ajouter des photos.
          </div>
        ) : (
          <>
            {/* Spinner de chargement / progression upload */}
            {photosLoading && (
              <div className="px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
                <svg className="animate-spin h-4 w-4 text-[#183536]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Upload en cours…
              </div>
            )}

            {/* Grille photos avec croix de suppression */}
            {safePhotos.length === 0 && !photosLoading ? (
              <div className="px-4 py-5 text-sm text-slate-400 text-center">Aucune photo pour l'instant.</div>
            ) : (
              <div className="grid grid-cols-3 gap-1 p-2 max-h-[300px] overflow-y-auto">
                {safePhotos
                  .filter((p) => p && typeof p.id === "string" && typeof p.fileUrl === "string" && p.fileUrl.length > 0)
                  .map((p) => (
                    <div key={p.id} className="relative group">
                      <a href={p.fileUrl} target="_blank" rel="noreferrer">
                        <img
                          src={p.fileUrl}
                          alt={p.fileLabel || "Photo"}
                          loading="lazy"
                          className="w-full aspect-square object-cover rounded-xl border"
                        />
                      </a>
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs font-bold flex items-center justify-center hover:bg-red-700"
                        title="Supprimer cette photo"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={async (ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (!editingId) return;
                          setPhotos(photos.filter((x) => x.id !== p.id));
                          try {
                            const delRes = await fetch(
                              `/api/chantiers/${editingId}/attachments?attachmentId=${encodeURIComponent(p.id)}`,
                              { method: "DELETE" }
                            );
                            if (!delRes.ok) {
                              const body = await delRes.json().catch(() => ({}));
                              throw new Error(body?.error ?? `Erreur suppression (${delRes.status})`);
                            }
                          } catch (err: any) {
                            setPhotos((prev) => [...prev, p]);
                            setError(err?.message ?? "Erreur suppression photo");
                          }
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Boutons ajout photos */}
            <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={photosLoading}
                onChange={onUploadPhotos}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={photosLoading}
                onChange={onUploadPhotos}
              />
              <button
                type="button"
                className="rounded-xl border px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
                onClick={() => cameraInputRef.current?.click()}
                disabled={photosLoading || saving}
              >
                Prendre une photo
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 ${FOREST_BTN}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={photosLoading || saving}
              >
                Depuis la galerie
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── INFOS PRINCIPALES ── */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b">
          <span className="font-semibold text-sm text-slate-800">Informations</span>
        </div>
        <div className="px-4 py-4 space-y-4">

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Titre</label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder='Ex : "Diogène – Bergerac"'
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </div>

          {/* Type + Statut côte à côte */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ChantierType)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              >
                {CHANTIER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Statut</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as ChantierStatus)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              >
                <option value="EN_ATTENTE">En attente</option>
                <option value="EN_COURS">En cours</option>
                <option value="TERMINE">Terminé</option>
              </select>
            </div>
          </div>

          {/* Dates côte à côte */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date début</label>
              <input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date fin</label>
              <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Heure début</label>
              <div className="flex gap-2">
                <select
                  value={splitTime(formStartTime)[0]}
                  onChange={(e) => setFormStartTime(`${e.target.value}:${splitTime(formStartTime)[1]}`)}
                  className="w-1/2 rounded-xl border px-2 py-2.5 text-sm"
                >
                  {HOURS_LIST.map((h) => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <select
                  value={splitTime(formStartTime)[1]}
                  onChange={(e) => setFormStartTime(`${splitTime(formStartTime)[0]}:${e.target.value}`)}
                  className="w-1/2 rounded-xl border px-2 py-2.5 text-sm"
                >
                  {MINUTES_LIST_15.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Heure fin</label>
              <div className="flex gap-2">
                <select
                  value={splitTime(formEndTime)[0]}
                  onChange={(e) => setFormEndTime(`${e.target.value}:${splitTime(formEndTime)[1]}`)}
                  className="w-1/2 rounded-xl border px-2 py-2.5 text-sm"
                >
                  {HOURS_LIST.map((h) => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <select
                  value={splitTime(formEndTime)[1]}
                  onChange={(e) => setFormEndTime(`${splitTime(formEndTime)[0]}:${e.target.value}`)}
                  className="w-1/2 rounded-xl border px-2 py-2.5 text-sm"
                >
                  {MINUTES_LIST_15.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Archiver */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formArchived}
              onChange={(e) => setFormArchived(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm font-semibold text-slate-700">Archiver ce chantier</span>
          </label>
        </div>
      </div>

      {/* ── RÉCURRENCE (si Nettoyage de bureau) ── */}
      {formType === "Nettoyage de bureau" && (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b">
            <span className="font-semibold text-sm text-slate-800">Récurrence</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fréquence</label>
              <select
                value={formRecurrenceFrequency}
                onChange={(e) => setFormRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              >
                <option value="NONE">Ponctuel</option>
                <option value="WEEKLY">Chaque semaine</option>
                <option value="BIWEEKLY">Toutes les 2 semaines</option>
                <option value="MONTHLY">Chaque mois</option>
              </select>
            </div>
            {formRecurrenceFrequency !== "NONE" && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jusqu'au</label>
                <input
                  type="date"
                  value={formRecurrenceEndDate}
                  onChange={(e) => setFormRecurrenceEndDate(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CLIENT ── */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b">
          <span className="font-semibold text-sm text-slate-800">Client</span>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nom</label>
              <input value={clientNom} onChange={(e) => setClientNom(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Téléphone</label>
              <input
                value={clientTel}
                onChange={(e) => setClientTel(e.target.value)}
                type="tel"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
            <input
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              type="email"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Adresse</label>
            <textarea
              value={clientAdresse}
              onChange={(e) => setClientAdresse(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm min-h-[72px]"
            />
          </div>
        </div>
      </div>

      {/* ── INTERVENANTS ── */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-800">Intervenants</span>
          <button
            type="button"
            className="text-xs text-slate-500 underline"
            onClick={onRefreshStaff}
            disabled={staffLoading}
          >
            {staffLoading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
        <div className="px-4 py-4">
          {inactiveAssigned.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Inactif(s) assigné(s) :</span> {inactiveAssigned.join(", ")}
            </div>
          )}
          {staff.length === 0 ? (
            <div className="text-sm text-slate-500">Aucun intervenant. Ajoute-les dans /intervenants.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {staff
                .filter((m) => m.isActive !== false)
                .map((m) => {
                  const label = m.fullName || `${m.firstName} ${m.lastName}`.trim();
                  const checked = formIntervenants.includes(label);
                  return (
                    <label key={m.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-[#183536]/10 border-[#183536]/30" : "bg-white"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setFormIntervenants(Array.from(new Set([...formIntervenants, label])));
                          else setFormIntervenants(formIntervenants.filter((x) => x !== label));
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-semibold">{label}</span>
                    </label>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── NOTES ── */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b">
          <span className="font-semibold text-sm text-slate-800">Notes</span>
        </div>
        <div className="px-4 py-4">
          <textarea
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Notes pour les intervenants…"
            className="w-full rounded-xl border px-3 py-2.5 text-sm min-h-[100px]"
          />
        </div>
      </div>

      {/* ── BOUTONS D'ACTION — sticky en bas ── */}
      <div className="sticky bottom-0 bg-white border-t px-0 py-3 -mx-4 mt-2">
        {/* Ligne 1 : PDF + Terminer+PDF */}
        {editingId && (
          <div className="grid grid-cols-2 gap-2 px-4 mb-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5"
              onClick={() => onOpenPdf(editingId)}
              disabled={saving}
            >
              📄 Ouvrir PDF
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#183536] px-3 py-2.5 text-sm font-semibold text-[#183536] hover:bg-[#183536]/5 flex items-center justify-center"
              onClick={onFinishAndPdf}
              disabled={saving}
            >
              {saving ? "Traitement…" : "✓ Terminer + PDF"}
            </button>
          </div>
        )}

        {/* Ligne 2 : Supprimer + Enregistrer */}
        <div className={`grid gap-2 px-4 ${editingId ? "grid-cols-2" : "grid-cols-1"}`}>
          {editingId && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              disabled={saving}
            >
              🗑 Supprimer
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold hover:opacity-95 ${FOREST_BTN}`}
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

    </div>
  );
}