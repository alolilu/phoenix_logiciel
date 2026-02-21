"use client";

import { useEffect, useState } from "react";

type AuditLog = {
  id: string;
  createdAt: string;
  actorUsername?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  message?: string | null;
};

export default function HistoriquePage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchLogs() {
    try {
      setLoading(true);
      const res = await fetch("/api/audit");
      if (!res.ok) throw new Error("Erreur chargement historique");

      const data = await res.json();
      setLogs(data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">

        {/* Titre + bouton */}
        <div className="flex items-center justify-between">
          <div className="text-3xl font-bold">
            Historique des actions
          </div>

          <button
            type="button"
            className="rounded-xl border px-4 py-2 font-semibold bg-white hover:bg-slate-100 transition"
            onClick={() => {
              window.open("/api/audit/export.xlsx", "_blank");
            }}
          >
            Exporter Excel
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-slate-600">Chargement...</div>
        ) : (
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Utilisateur</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entité</th>
                  <th className="p-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t hover:bg-slate-50 transition"
                  >
                    <td className="p-3 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {log.actorUsername ?? "—"}
                    </td>
                    <td className="p-3 font-semibold">
                      {log.action}
                    </td>
                    <td className="p-3">
                      {log.entityType}
                    </td>
                    <td className="p-3 text-slate-600">
                      {log.message ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {logs.length === 0 && (
              <div className="p-6 text-center text-slate-500">
                Aucun log disponible
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
