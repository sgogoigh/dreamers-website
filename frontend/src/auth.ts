/**
 * Auth.js v5 — Google sign-in + the JWT bridge to the FastAPI backend.
 *
 * The backend verifies HS256 JWTs signed with the SAME `AUTH_SECRET`
 * (claims: sub / email / name / picture). Auth.js session tokens are
 * encrypted JWEs, so we mint a separate compact `apiToken` in the session
 * callback and expose it on the session object for the API client.
 *
 * A Credentials "dev login" is available ONLY when AUTH_DEV_LOGIN=1 so the
 * whole product can be exercised locally without Google credentials.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { signApiToken } from "@/lib/apiToken";

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

if (process.env.AUTH_DEV_LOGIN === "1") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login (no Google)",
      credentials: {},
      async authorize() {
        return {
          id: "dev-user-0001",
          name: "Dev Dreamer",
          email: "dev@dreamers.local",
          image: "",
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, account, profile, user }) {
      // Pin the stable subject: Google's `sub` claim, or the dev user id.
      if (account?.provider === "google" && profile?.sub) {
        token.sub = profile.sub;
        token.picture = (profile.picture as string) ?? token.picture;
      } else if (account?.provider === "dev" && user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      session.apiToken = await signApiToken({
        sub: token.sub ?? "",
        email: token.email ?? session.user?.email ?? "",
        name: token.name ?? session.user?.name ?? "",
        picture: (token.picture as string) ?? "",
      });
      return session;
    },
  },
});
