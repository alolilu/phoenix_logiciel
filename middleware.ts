import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) LAISSER PASSER : Auth, Fichiers statiques et SURTOUT l'API Photos
  // On ajoute l'exclusion de l'API photos pour éviter que getToken ne bloque le FormData
  if (
    pathname.startsWith("/api/auth") || 
    pathname.startsWith("/_next") || 
    pathname.includes("/photos") || // <--- AJOUT CRUCIAL
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2) On lit la session
  const token = await getToken({ req });

  // 3) Gestion de la page de connexion
  if (pathname === "/connexion") {
    if (token) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  // 4) Protection globale
  if (!token) {
    return NextResponse.redirect(new URL("/connexion", req.url));
  }

  // 5) Protection ADMIN
  const role = (token as any)?.role;
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};