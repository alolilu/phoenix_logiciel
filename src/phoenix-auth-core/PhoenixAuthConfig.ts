import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { phoenixPrisma } from "../phoenix-auth-db/PhoenixPrismaClient";

export const phoenixAuthOptions = {
  session: { strategy: "jwt" as const },
  providers: [
    CredentialsProvider({
      name: "Phoenix Credentials",
      credentials: {
        username: { label: "Nom d'utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;

        const user = await phoenixPrisma.userAccount.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user?.role) token.role = user.role;
      return token;
    },
    async session({ session, token }: any) {
      session.user = session.user || {};
      (session.user as any).role = token.role;
      return session;
    },
  },
  pages: {
    signIn: "/connexion",
  },
};
