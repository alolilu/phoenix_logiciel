// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phoenix Ops",
  description: "Planning terrain Phoenix Nouvelle-Aquitaine",
  manifest: "/manifest.json",
  themeColor: "#183536",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}