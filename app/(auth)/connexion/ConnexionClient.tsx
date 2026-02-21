"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function ConnexionClient() {
  const sp = useSearchParams();
  const error = sp.get("error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    setLoading(false);

    if (!res) {
      setMsg("Erreur inattendue.");
      return;
    }
    if (res.error) {
      setMsg("Identifiants incorrects.");
      return;
    }

    window.location.href = res.url ?? "/";
  }

  const topError =
    msg ||
    (error === "CredentialsSignin"
      ? "Identifiants incorrects."
      : error
      ? "Erreur de connexion."
      : null);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#ffffff",
          borderRadius: 18,
          padding: 32,
          boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: 22,
            textAlign: "center",
            color: "#183536",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          Connexion
        </h1>

        <form
          onSubmit={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <label style={{ fontWeight: 700, color: "#183536" }}>
            Nom d’utilisateur
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              style={{
                width: "100%",
                padding: 12,
                marginTop: 8,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.25)",
                fontSize: 16,
              }}
            />
          </label>

          <label style={{ fontWeight: 700, color: "#183536" }}>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: 12,
                marginTop: 8,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.25)",
                fontSize: 16,
              }}
            />
          </label>

          {topError && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(180,106,60,0.10)",
                border: "1px solid rgba(180,106,60,0.35)",
                color: "#183536",
                fontWeight: 700,
              }}
            >
              {topError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              width: "100%",
              padding: 14,
              borderRadius: 14,
              border: "none",
              background: "#B46A3C",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 18,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}