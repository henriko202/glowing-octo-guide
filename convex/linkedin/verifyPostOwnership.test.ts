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

  // Step B calls GET /rest/me?fields=publicIdentifier with LinkedIn-Version header.
  // This is the versioned REST API that works with our OIDC `profile` scope tokens.
  // The legacy /v2/me required r_liteprofile (not available to OIDC apps).
  // `publicIdentifier` is the versioned API's name for what /v2/me called `vanityName`.

  it("Step B: confirms when UGC returns 403 + publicIdentifier matches URL vanityName", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publicIdentifier: "henri-durand" }),
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

  it("Step B: is case-insensitive when comparing publicIdentifier with URL vanityName", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publicIdentifier: "Henri-Durand" }),
      } as Response);

    const result = await verifyPostOwnership(
      "token",
      "urn:li:ugcPost:123",
      "abc123",
      "henri-durand"
    );

    expect(result.confirmed).toBe(true);
  });

  it("throws when Step A (403) + publicIdentifier does not match URL vanityName", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publicIdentifier: "someone-else" }),
      } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", "henri-durand")
    ).rejects.toThrow("doesn't belong to your LinkedIn account");
  });

  it("throws when Step A (403) + /rest/me also fails", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '{"message":"ACCESS_DENIED"}',
      } as Response);

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
