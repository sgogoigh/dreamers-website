import "next-auth";

declare module "next-auth" {
  interface Session {
    /** HS256 JWT the FastAPI backend verifies (shared AUTH_SECRET). */
    apiToken: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
