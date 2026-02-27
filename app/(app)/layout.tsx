import React from "react";
import Providers from "../providers";
import { PhoenixShellLayout } from "@/phoenix-ui-shell/PhoenixShellLayout";
import AppSecurityGuard from "./AppSecurityGuard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {/* 🔐 Sécurité globale (logout auto si 401/403) */}
      <AppSecurityGuard />

      {/* 🧱 Shell principal Phoenix */}
      <PhoenixShellLayout>
        {children}
      </PhoenixShellLayout>
    </Providers>
  );
}