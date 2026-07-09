import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, API_URL, eventsUrl, thumbnailUrl, videoUrl } from "@/lib/api";

const okJson = (data: unknown) =>
  ({ ok: true, json: () => Promise.resolve(data) }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("injects the bearer token and hits /api/v1", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ balance: 10 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/credits/balance", { token: "tok123" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/v1/credits/balance`);
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.method).toBe("GET");
  });

  it("POSTs JSON bodies with content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ id: "d1" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/dreams", { token: "t", body: { prompt: "a dream" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ prompt: "a dream" });
  });

  it("normalizes the backend error envelope into ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: () =>
        Promise.resolve({
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: "You need 5 credits.",
            details: { balance: 3, required: 5 },
          },
        }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const err = await apiFetch("/dreams", { token: "t", body: { prompt: "x" } }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(402);
    expect(err.code).toBe("INSUFFICIENT_CREDITS");
    expect(err.details.balance).toBe(3);
  });

  it("survives non-JSON error bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error("not json")),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const err = await apiFetch("/health").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBe("HTTP_ERROR");
  });
});

describe("token-in-URL artifact endpoints", () => {
  it("video url carries the token; download flag adds the attachment param", () => {
    expect(videoUrl("abc", "tok")).toBe(`${API_URL}/api/v1/dreams/abc/video?token=tok`);
    expect(videoUrl("abc", "tok", true)).toBe(
      `${API_URL}/api/v1/dreams/abc/video?download=1&token=tok`,
    );
  });
  it("encodes token characters safely", () => {
    expect(thumbnailUrl("abc", "a+b/c")).toContain(`token=${encodeURIComponent("a+b/c")}`);
  });
  it("events url targets the SSE endpoint", () => {
    expect(eventsUrl("abc", "tok")).toBe(`${API_URL}/api/v1/dreams/abc/events?token=tok`);
  });
});
