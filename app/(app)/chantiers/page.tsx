const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files ? Array.from(e.target.files) : [];
  if (!files.length || !editingId) return;

  setUploading(true);
  try {
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f); // Clé "file"

      const res = await fetch(`/api/chantiers/${editingId}/photos`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");
      setPhotos(prev => [data, ...prev]);
    }
    alert("Photo enregistrée !");
  } catch (err: any) {
    alert("Erreur : " + err.message);
  } finally {
    setUploading(false);
  }
};