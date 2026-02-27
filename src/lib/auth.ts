import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

type PhoenixRole = "ADMIN" | "USER";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Identifiant", type: "text" }, // ton form envoie "username"
        email: { label: "Email", type: "text" }, // au cas où (fallback)
        password: { label: "Mot de passe", type: "password" },
      },

      async authorize(credentials) {
        const usernameRaw = String((credentials as any)?.username ?? "").trim();
        const emailRaw = String((credentials as any)?.email ?? "").trim();
        const identRaw = usernameRaw || emailRaw;

        const password = String((credentials as any)?.password ?? "");
        const identLower = identRaw.toLowerCase();

        if (!identRaw || !password) return null;

        const user = await prisma.userAccount.findFirst({
          where: {
  OR: [
    { email: identLower },
    { username: { equals: identRaw, mode: "insensitive" } as any },
  ],
},
          select: {
            id: true,
            email: true,
            username: true,
            passwordHash: true,
            role: true,
            isActive: true,
          },
        });

        if (!user) return null;
        if (!user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.username ?? user.email ?? "Utilisateur",
          email: user.email,
          role: user.role as unknown as PhoenixRole,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).userId = (user as any).id;
        (token as any).role = (user as any).role ?? "USER";
        token.email = (user as any).email ?? token.email;
      }

      if (!(token as any).userId && token.sub) {
        (token as any).userId = token.sub;
      }

      if (!(token as any).userId && token.email) {
        const dbUser = await prisma.userAccount.findUnique({
          where: { email: String(token.email).toLowerCase() },
          select: { id: true, role: true, isActive: true },
        });

        if (dbUser?.isActive) {
          (token as any).userId = dbUser.id;
          (token as any).role = (dbUser.role as any) ?? "USER";
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).userId ?? null;
        (session.user as any).role = (token as any).role ?? "USER";
      }
      return session;
    },
  },

  pages: {
    signIn: "/connexion",
  },
};