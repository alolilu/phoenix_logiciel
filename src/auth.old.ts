// src/auth.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/src/lib/prisma";
import { verifyPassword } from "@/src/lib/password";

export const { auth, handlers } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion" },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },

      async authorize(credentials) {
        const username = (credentials?.username ?? "").trim();
        const password = credentials?.password ?? "";
        if (!username || !password) return null;

        const user = await prisma.userAccount.findUnique({
          where: { username },
        });

        if (!user || !user.isActive) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.username,
          email: user.email ?? undefined,
          role: user.role,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role = token.role;
      return session;
    },
  },
});
