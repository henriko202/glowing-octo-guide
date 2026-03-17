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
      "henri-durand",
      "henri-durand"
    );

    expect(result.confirmed).toBe(true);
    expect(result.content).toBe("Hello world");
    expect(result.publishedAt).toBe(1700000000000);
    expect(result.strategy).toBe("ugc-api");
    // Step A succeeded — only one fetch (UGC API)
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
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
      verifyPostOwnership("token", "urn:li:ugcPost:123", "abc123", null, null)
    ).rejects.toThrow("doesn't belong to your LinkedIn account");
  });

  // Step B: local comparison only — no API calls.
  // We compare the vanityName extracted from the URL against the user's stored
  // linkedinPublicIdentifier. No LinkedIn API calls are made in Step B because
  // standard OAuth apps don't have access to profile identity endpoints.

  it("Step B: confirms when stored publicIdentifier matches URL vanityName (no extra API call)", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    const result = await verifyPostOwnership(
      "token",
      "urn:li:ugcPost:123",
      "abc123",
      "henri-durand",
      "henri-durand"        // stored identifier matches URL vanityName
    );

    expect(result.confirmed).toBe(true);
    expect(result.strategy).toBe("vanity-heuristic");
    // Only ONE fetch call (Step A attempt) — Step B makes NO API call
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
  });

  it("Step B: comparison is case-insensitive", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    const result = await verifyPostOwnership(
      "token",
      "urn:li:ugcPost:123",
      "abc123",
      "Henri-Durand",       // URL vanityName with uppercase
      "henri-durand"        // stored identifier with lowercase
    );

    expect(result.confirmed).toBe(true);
  });

  it("Step B: throws when stored publicIdentifier does not match URL vanityName", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", "other-persons-name", "henri-durand")
    ).rejects.toThrow("doesn't belong to your LinkedIn account");
  });

  it("Step B: throws asking user to set LinkedIn profile URL when no stored identifier", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", "henri-durand", null)
    ).rejects.toThrow("Settings");
  });

  it("throws immediately for Format 2 URL (null vanityName) when Step A returns 403", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", null, null)
    ).rejects.toThrow("Use a /posts/\u2026 URL format");
  });
});
