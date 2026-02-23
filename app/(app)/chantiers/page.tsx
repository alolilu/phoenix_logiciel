const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files ? Array.from(e.target.files) : [];
  if (!files.length || !editingId) return;

  setUploading(true);
  try {
    for (const f of files) {
      const fd = new FormData();
      // On l'ajoute sous deux noms différents pour être sûr
      fd.append("file", f);
      fd.append("files", f);

      const res = await fetch(`/api/chantiers/${editingId}/photos`, {
        method: "POST",
        body: fd,
        // SURTOUT AUCUN HEADER
      });

      const result = await res.json();
      if (!res.ok) {
        console.error("DEBUG SERVEUR:", result);
        throw new Error(result.error + (result.cles_recues ? " Clés: " + result.cles_recues.join(',') : ""));
      }
      setPhotos(prev => [result, ...prev]);
    }
    alert("Upload réussi");
  } catch (err: any) {
    alert("ERREUR CRITIQUE : " + err.message);
  } finally {
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
};