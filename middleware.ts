import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) On définit les accès prioritaires (Auth API et fichiers statiques)
  // On laisse passer TOUT ce qui est /api/auth pour éviter les boucles de redirection
  if (
    pathname.startsWith("/api/auth") || 
    pathname.startsWith("/_next") || 
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2) On lit la session
  const token = await getToken({ req });

  // 3) Si on est sur la page de connexion
  if (pathname === "/connexion") {
    // Si déjà connecté, on redirige vers l'accueil
    if (token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 4) Protection globale : Si pas de token -> /connexion
  if (!token) {
    const url = new URL("/connexion", req.url);
    // Optionnel: on peut ajouter ?callbackUrl pour revenir ici après login
    return NextResponse.redirect(url);
  }

  // 5) Protection spécifique ADMIN
  const role = (token as any)?.role;

  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

// Le matcher doit être large, mais le code interne du middleware gère les exceptions
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};