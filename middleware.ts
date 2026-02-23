import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) LAISSER PASSER : Auth, Fichiers statiques et SURTOUT l'API Photos
  // On ignore /api/chantiers/ID/photos pour que le flux de données reste intact
  if (
    pathname.startsWith("/api/auth") || 
    pathname.startsWith("/_next") || 
    pathname.includes("/photos") || // <--- CETTE LIGNE DÉBLOQUE TOUT
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req });

  if (pathname === "/connexion") {
    if (token) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/connexion", req.url));
  }

  const role = (token as any)?.role;
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};