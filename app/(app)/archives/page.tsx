"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ChantierUI = {
  id: string;
  type: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: string;
  archived: boolean;
  intervenants: string[];
  notes?: string;
  updatedAt?: any;
};

async function apiJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error ?? `Erreur API (${res.status})`);
    } catch {
      throw new Error(text || `Erreur API (${res.status})`);
    }
  }

  return (await res.json()) as T;
}

export default function ArchivesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ChantierUI[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [items]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJSON<ChantierUI[]>("/api/chantiers?archived=true");
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function unarchive(id: string) {
    setBusyId(id);
    setError(null);
    try {
      // ✅ désarchivage
      await apiJSON<ChantierUI>(`/api/chantiers/${id}`, {
        method: "PUT",
        body: JSON.stringify({ archived: false }),
      });

      // Soit on reload, soit on enlève l’item localement
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Erreur désarchivage");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Archives</h1>
        <Link href="/" style={{ textDecoration: "underline", opacity: 0.8 }}>
          Retour planning
        </Link>
      </div>

      <p style={{ opacity: 0.85, marginBottom: 16 }}>
        Liste des chantiers archivés (accès ADMIN).
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          onClick={load}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: "pointer",
          }}
        >
          Rafraîchir
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#ffecec",
            border: "1px solid #ffb3b3",
            color: "#7a0000",
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
            whiteSpace: "pre-wrap",
          }}
        >
          <b>Erreur</b>
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={{ opacity: 0.8 }}>Chargement…</div>
      ) : (
        <div style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,0.04)" }}>
              <tr>
                <th style={th}>Dates</th>
                <th style={th}>Type</th>
                <th style={th}>Titre</th>
                <th style={th}>Statut</th>
                <th style={th}>Intervenants</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td style={td} colSpan={6}>
                    Aucun chantier archivé.
                  </td>
                </tr>
              ) : (
                sorted.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                    <td style={td}>
                      {c.startDate} → {c.endDate}
                    </td>
                    <td style={td}>{c.type}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 650 }}>{c.title}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>id: {c.id}</div>
                    </td>
                    <td style={td}>{c.status}</td>
                    <td style={td}>{(c.intervenants || []).filter(Boolean).join(", ") || "—"}</td>
                    <td style={td}>
                      <button
                        onClick={() => unarchive(c.id)}
                        disabled={busyId === c.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.25)",
                          cursor: busyId === c.id ? "not-allowed" : "pointer",
                          opacity: busyId === c.id ? 0.6 : 1,
                        }}
                      >
                        {busyId === c.id ? "..." : "Désarchiver"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  opacity: 0.85,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "top",
};
