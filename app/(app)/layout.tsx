import React from "react";
import Providers from "../providers";
import { PhoenixShellLayout } from "@/phoenix-ui-shell/PhoenixShellLayout";
import AppSecurityGuard from "./AppSecurityGuard";
import MobileLayout from "./MobileLayout";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {/* 🔐 Sécurité globale (logout auto si 401/403) */}
      <AppSecurityGuard />

      <MobileLayout title="Phoenix Ops" fabHref="/chantiers">
        {/* 🧱 Shell principal Phoenix */}
        <PhoenixShellLayout>{children}</PhoenixShellLayout>
      </MobileLayout>
    </Providers>
  );
}