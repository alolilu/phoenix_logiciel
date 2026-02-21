export const runtime = "nodejs";

export type ChantierStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE";

export type Chantier = {
  id: string;
  type: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD inclus
  status: ChantierStatus;
  archived: boolean;
  intervenants: string[];
  notes?: string;
  updatedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __PHX_CHANTIERS_STORE__: Map<string, Chantier> | undefined;
}

export const chantierStore: Map<string, Chantier> =
  globalThis.__PHX_CHANTIERS_STORE__ ??
  (globalThis.__PHX_CHANTIERS_STORE__ = new Map<string, Chantier>());
