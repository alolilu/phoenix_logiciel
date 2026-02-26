// src/lib/uploadPhotos.ts

export type PhotoDTO = {
  id: string;
  fileUrl: string;
  fileLabel: string;
  uploadedAt: string; // ISO
};

function isPhotoDto(x: any): x is PhotoDTO {
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
  return Array.isArray(x) && x.every(isPhotoDto);
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
    // 1) POST upload
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

    // 2) GET systématique (source de vérité)
    const getRes = await fetch(`/api/chantiers/${encodeURIComponent(jobId)}/photos`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!getRes.ok) {
      const body = await readJsonSafe(getRes);
      const msg =
        body && typeof body === "object" && body !== null && "error" in body && typeof (body as any).error === "string"
          ? (body as any).error
          : `Refresh photos failed (${getRes.status})`;
      throw new Error(msg);
    }

    const data = await readJsonSafe(getRes);
    setPhotos(isPhotoArray(data) ? data : []);
  } finally {
    setPhotosLoading(false);
  }
}