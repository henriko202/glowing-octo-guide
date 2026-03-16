// convex/linkedin/verifyPostOwnership.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyPostOwnership } from "./verifyPostOwnership";

describe("verifyPostOwnership", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Step A: returns confirmed + content when UGC API returns matching author", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        author: "urn:li:person:abc123",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: "Hello world" },
          },
        },
        created: { time: 1700000000000 },
      }),
    } as Response);

    const result = await verifyPostOwnership(
      "test-token",
      "urn:li:ugcPost:123",
      "abc123",
      "henri-durand"
    );

    expect(result.confirmed).toBe(true);
    expect(result.content).toBe("Hello world");
    expect(result.publishedAt).toBe(1700000000000);
    expect(result.strategy).toBe("ugc-api");
  });

  it("Step A: throws when author does not match", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        author: "urn:li:person:someone-else",
        specificContent: {},
        created: { time: 0 },
      }),
    } as Response);

    await expect(
      verifyPostOwnership("token", "urn:li:ugcPost:123", "abc123", null)
    ).rejects.toThrow("doesn't belong to your LinkedIn account");
  });

  // Step B calls GET /v2/me?projection=(vanityName) with the REST API Restli header.
  // LinkedIn OIDC `profile` scope grants the same access as `r_liteprofile`,
  // so this endpoint is available to our tokens.
  // We compare the returned vanityName with the one extracted from the post URL —
  // this is the real ownership check (confirms the URL's name belongs to this account).

  it("Step B: confirms when UGC returns 403 + /v2/me vanityName matches URL vanityName", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vanityName: "henri-durand" }),
      } as Response);

    const result = await verifyPostOwnership(
      "token",
      "urn:li:ugcPost:123",
      "abc123",
      "henri-durand"
    );

    expect(result.confirmed).toBe(true);
    expect(result.strategy).toBe("vanity-heuristic");
  });

  it("Step B: is case-insensitive when comparing vanity names", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vanityName: "Henri-Durand" }),
      } as Response);

    const result = await verifyPostOwnership(
      "token",
      "urn:li:ugcPost:123",
      "abc123",
      "henri-durand"
    );

    expect(result.confirmed).toBe(true);
  });

  it("throws when Step A (403) + /v2/me vanityName does not match URL vanityName", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vanityName: "someone-else" }),
      } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", "henri-durand")
    ).rejects.toThrow("doesn't belong to your LinkedIn account");
  });

  it("throws when Step A (403) + /v2/me also fails", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "Unauthorized" } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", "henri-durand")
    ).rejects.toThrow("Could not verify post ownership");
  });

  it("throws immediately for Format 2 URL (null vanityName) when Step A returns 403", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", null)
    ).rejects.toThrow("Use a /posts/\u2026 URL format");
  });
});
