import { JobType } from "@prisma/client";

export type ChantierStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE" | "ARCHIVE";

export type ChantierEvent = {
  id: string;
  type: string; // libellé UI
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD inclus
  status: ChantierStatus;
  archived: boolean;
  intervenants: string[];
  notes?: string | null;
  updatedAt?: string;
};

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// date-only -> UTC minuit (stable)
export function dateFromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// UI label -> enum
export function mapTypeToEnum(typeLabel: string): JobType {
  const t = (typeLabel || "").trim().toLowerCase();

  if (t === "diogène" || t === "diogene") return JobType.DIOGENE;
  if (t === "post-mortem" || t === "post mortem") return JobType.POST_MORTEM;
  if (t === "noé" || t === "noe") return JobType.NOE;
  if (t === "dératisation" || t === "deratisation") return JobType.DERATISATION;
  if (t === "désinsectisation" || t === "desinsectisation") return JobType.DESINSECTISATION;
  if (t === "débarras" || t === "debarras") return JobType.DEBARRAS;
  if (t === "ozone") return JobType.OZONE;
  if (t === "nébulisation" || t === "nebulisation") return JobType.NEBULISATION;
  if (t === "scène de crime" || t === "scene de crime") return JobType.SCENE_DE_CRIME;
  if (t === "devis") return JobType.DEVIS;
  if (t === "nettoyage bureau" || t === "nettoyage de bureau")
  if (t === "sinistre incendie") return JobType.SINISTRE_INCENDIE;
  if (t === "dégâts des eaux" || t === "degats des eaux") return JobType.DEGATS_DES_EAUX;
  return JobType.NETTOYAGE_BUREAU;
  return JobType.DIOGENE;
}

// enum -> UI label
export function mapEnumToLabel(type: JobType): string {
  const m: Record<JobType, string> = {
    DIOGENE: "Diogène",
    POST_MORTEM: "Post-mortem",
    NOE: "Noé",
    DERATISATION: "Dératisation",
    DESINSECTISATION: "Désinsectisation",
    DEBARRAS: "Débarras",
    OZONE: "Ozone",
    NEBULISATION: "Nébulisation",
    SCENE_DE_CRIME: "Scène de crime",
    DEVIS: "Devis",
    NETTOYAGE_BUREAU: "Nettoyage de bureau",
    SINISTRE_INCENDIE: "Sinistre incendie",
    DEGATS_DES_EAUX: "Dégâts des eaux",
  };
  return m[type] ?? "Diogène";
}

// DB job -> UI event
export function jobToEvent(job: any): ChantierEvent {
  const intervenants = (job.staffLinks || [])
    .map((l: any) => `${l.staff?.firstName ?? ""} ${l.staff?.lastName ?? ""}`.trim())
    .filter((s: string) => s.length > 0);

  return {
    id: job.id,
    type: mapEnumToLabel(job.type),
    title: job.title,
    startDate: toISODate(job.startAt),
    endDate: toISODate(job.endAt),
    status: job.status,
    archived: job.archived,
    intervenants: intervenants.length ? intervenants : ["David"],
    notes: job.notes ?? null,
    updatedAt: job.updatedAt?.toISOString?.() ?? undefined,
  };
}
