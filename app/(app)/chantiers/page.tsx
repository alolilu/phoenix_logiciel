const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files ? Array.from(e.target.files) : [];
  if (!files.length || !editingId) return;

  setUploading(true);
  try {
    for (const file of files) {
      const fd = new FormData();
      // On ajoute le fichier sous la clé "file"
      fd.append("file", file);

      const res = await fetch(`/api/chantiers/${editingId}/photos`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        // Cela va afficher le détail de l'erreur dans une alerte
        throw new Error(data.error + (data.cles_recues ? " | Reçu: " + data.cles_recues.join(',') : ""));
      }
      setPhotos(prev => [data, ...prev]);
    }
    alert("Upload réussi !");
  } catch (err: any) {
    alert("DÉTAIL ERREUR : " + err.message);
  } finally {
    setUploading(false);
  }
};