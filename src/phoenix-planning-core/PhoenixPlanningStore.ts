export type PhoenixCategory =
  | "DIOGENE"
  | "POST_MORTEM"
  | "INSALUBRE"
  | "DERATISATION"
  | "DESINSECTISATION"
  | "SCENE_DE_CRIME";

export type PhoenixChantier = {
  id: string;
  dateISO: string; // ex: "2026-01-06"
  title: string; // ex: "Appartement T2 - Diogène"
  category: PhoenixCategory;
  clientName?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAtISO: string;
};

const STORAGE_KEY = "phoenix_planning_chantiers_v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function listChantiers(): PhoenixChantier[] {
  if (typeof window === "undefined") return [];
  const data = safeParse<PhoenixChantier[]>(localStorage.getItem(STORAGE_KEY));
  if (!data) return [];
  return data;
}

export function saveChantiers(items: PhoenixChantier[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addChantier(input: Omit<PhoenixChantier, "id" | "createdAtISO">) {
  const all = listChantiers();
  const newItem: PhoenixChantier = {
    ...input,
    id: crypto.randomUUID(),
    createdAtISO: new Date().toISOString(),
  };
  const next = [newItem, ...all];
  saveChantiers(next);
  return newItem;
}

export function deleteChantier(id: string) {
  const all = listChantiers();
  const next = all.filter((x) => x.id !== id);
  saveChantiers(next);
}

export function categoryLabel(c: PhoenixCategory): string {
  switch (c) {
    case "DIOGENE":
      return "Diogène";
    case "POST_MORTEM":
      return "Post-mortem";
    case "INSALUBRE":
      return "Insalubre";
    case "DERATISATION":
      return "Dératisation";
    case "DESINSECTISATION":
      return "Désinsectisation";
    case "SCENE_DE_CRIME":
      return "Scène de crime";
  }
}

export function categoryBadgeClass(c: PhoenixCategory): string {
  // On reste simple: on ne “devine” pas tes couleurs Tailwind, on utilise des classes neutres
  // Tu me diras après si tu veux les mapper sur tes tokens Phoenix.
  switch (c) {
    case "DIOGENE":
      return "bg-black/5 border-black/10";
    case "POST_MORTEM":
      return "bg-black/5 border-black/10";
    case "INSALUBRE":
      return "bg-black/5 border-black/10";
    case "DERATISATION":
      return "bg-black/5 border-black/10";
    case "DESINSECTISATION":
      return "bg-black/5 border-black/10";
    case "SCENE_DE_CRIME":
      return "bg-black/5 border-black/10";
  }
}
