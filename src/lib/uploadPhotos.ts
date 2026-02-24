export async function uploadPhotos(chantierId: string, files: File[]) {
  const formData = new FormData();

  // Le backend accepte "file" et "files", mais on standardise sur "file"
  for (const f of files) {
    formData.append("file", f);
  }

  const res = await fetch(`/api/chantiers/${chantierId}/photos`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}) ${txt}`);
  }

  return res.json();
}