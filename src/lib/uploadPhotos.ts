// src/lib/uploadPhotos.ts

export type PhotoDTO = {
  id: string;
  fileUrl: string;
  fileLabel: string;
  uploadedAt: string; // ISO
};

function isPhotoArray(x: unknown): x is PhotoDTO[] {
  return Array.isArray(x);
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchPhotos(jobId: string): Promise<PhotoDTO[]> {
  const res = await fetch(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await readJsonSafe(res);
    const msg =
      body && typeof body === "object" && body !== null && "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : `Refresh photos failed (${res.status})`;
    throw new Error(msg);
  }

  const data = await readJsonSafe(res);
  return isPhotoArray(data) ? data : [];
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

    if (!postRes.ok) {
      const body = await readJsonSafe(postRes);
      const msg =
        body && typeof body === "object" && body !== null && "error" in body && typeof (body as any).error === "string"
          ? (body as any).error
          : `Upload failed (${postRes.status})`;
      throw new Error(msg);
    }

    // ✅ IMPORTANT : on ignore le JSON du POST (parce qu'en prod il renvoie {ok,received,...})
    // et on recharge toujours depuis le GET
    const photos = await fetchPhotos(jobId);
    setPhotos(photos);
  } finally {
    setPhotosLoading(false);
  }
}