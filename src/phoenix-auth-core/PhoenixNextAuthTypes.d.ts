export const runtime = "nodejs";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      role?: string | null;
    };
  }
}
