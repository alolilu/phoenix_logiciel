import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";

type PhoenixRole = "ADMIN" | "USER";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Nom d’utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },

      async authorize(credentials) {
        const raw = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!raw || !password) return null;

        // ✅ Supporte "username" OU "email" dans le même champ
        const looksLikeEmail = raw.includes("@");
        const user = await prisma.userAccount.findUnique({
          where: looksLikeEmail
            ? { email: raw.toLowerCase() }
            : { username: raw },
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

  pages: { signIn: "/connexion" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };