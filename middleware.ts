import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Laisser passer tout ce qui est PWA / statique
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/connexion", req.url));
  }

  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/workbox-*.js" || // (au cas où)
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    pathname === "/icon-192-maskable.png" ||
    pathname === "/icon-512-maskable.png" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // ⚠️ Si tu as une logique d’auth ici, laisse-la comme avant.
  // Si tu n'avais pas de middleware d'auth, laisse juste NextResponse.next()
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};