import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Phoenix Ops",
  description: "Planning terrain Phoenix Nouvelle-Aquitaine",
  applicationName: "Phoenix Ops",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#183536",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}