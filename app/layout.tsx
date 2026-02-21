// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Phoenix Planning",
  description: "Planning Phoenix Nouvelle-Aquitaine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
