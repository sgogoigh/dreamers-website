// @vitest-environment node
/** The apiToken bridge: the backend verifies HS256 JWTs with the shared
 * AUTH_SECRET and requires sub + email claims. Round-trip what we sign.
 * (node env: jsdom's TextEncoder yields cross-realm Uint8Arrays jose rejects) */
import { jwtVerify } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET = "test-secret";

describe("signApiToken (frontend ↔ backend JWT contract)", () => {
  let signApiToken: (c: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  }) => Promise<string>;

  beforeAll(async () => {
    ({ signApiToken } = await import("@/lib/apiToken"));
  });

  it("signs HS256 tokens carrying sub/email/name/picture", async () => {
    const token = await signApiToken({
      sub: "google-sub-42",
      email: "user@example.com",
      name: "User",
      picture: "https://p.example/x.png",
    });
    const { payload, protectedHeader } = await jwtVerify(
      token,
      new TextEncoder().encode("test-secret"),
    );
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.sub).toBe("google-sub-42");
    expect(payload.email).toBe("user@example.com");
    expect(payload.name).toBe("User");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects verification with the wrong secret", async () => {
    const token = await signApiToken({ sub: "s", email: "e@x.co" });
    await expect(
      jwtVerify(token, new TextEncoder().encode("wrong-secret")),
    ).rejects.toThrow();
  });

  it("defaults optional claims to empty strings (backend expects strings)", async () => {
    const token = await signApiToken({ sub: "s", email: "e@x.co" });
    const { payload } = await jwtVerify(token, new TextEncoder().encode("test-secret"));
    expect(payload.name).toBe("");
    expect(payload.picture).toBe("");
  });
});
