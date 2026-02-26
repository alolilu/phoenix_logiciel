// src/lib/uploadPhotos.ts

export type PhotoDTO = {
  id: string;
  fileUrl: string;    // URL blob
  fileLabel: string;  // nom
  uploadedAt: string; // ISO
};

function isPhotoDTO(x: any): x is PhotoDTO {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.fileUrl === "string" &&
    typeof x.fileLabel === "string" &&
    typeof x.uploadedAt === "string"
  );
}

function isPhotoArray(x: unknown): x is PhotoDTO[] {
  return Array.isArray(x) && x.every(isPhotoDTO);
}

/**
 * Lit du JSON si possible, sinon renvoie null.
 * (Important : en prod, une route peut renvoyer du HTML de login/erreur)
 */
async function readJsonSafe(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body && typeof (body as any).error === "string") {
    return (body as any).error as string;
  }
  return fallback;
}

async function fetchPhotos(jobId: string): Promise<PhotoDTO[]> {
  const res = await fetch(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const body = await readJsonSafe(res);

  if (!res.ok) {
    throw new Error(extractErrorMessage(body, `Refresh photos failed (${res.status})`));
  }

  // ✅ on force un tableau sain
  return isPhotoArray(body) ? body : [];
}

export async function uploadPhotos(args: {
  jobId: string;
  files: File[];
  setPhotos: (p: PhotoDTO[]) => void;
  setPhotosLoading: (v: boolean) => void;
}): Promise<void> {
  const { jobId, files, setPhotos, setPhotosLoading } = args;

  if (!jobId) throw new Error("uploadPhotos: jobId manquant");
  if (!Array.isArray(files) || files.length === 0) return;

  setPhotosLoading(true);

  try {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);

    const postRes = await fetch(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, {
      method: "POST",
      body: fd,
    });

    const postBody = await readJsonSafe(postRes);

    if (!postRes.ok) {
      throw new Error(extractErrorMessage(postBody, `Upload failed (${postRes.status})`));
    }

    // ✅ Si l’API renvoie directement la liste
    if (isPhotoArray(postBody)) {
      setPhotos(postBody);
      return;
    }

    // ✅ Sinon : fallback GET (cas où POST renvoie {ok:true,...} ou autre)
    const list = await fetchPhotos(jobId);
    setPhotos(list);

    // petit debug utile en prod si besoin
    if (!isPhotoArray(postBody)) {
      console.warn("[uploadPhotos] POST did not return PhotoDTO[]; refreshed via GET.", { postBody });
    }
  } finally {
    setPhotosLoading(false);
  }
}