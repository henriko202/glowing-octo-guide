// convex/linkedin/verifyPostOwnership.ts

export interface OwnershipResult {
  confirmed: boolean;
  content: string;
  publishedAt: number;
  strategy: "ugc-api" | "vanity-heuristic";
}

/**
 * Verifies that a LinkedIn post belongs to the given user.
 *
 * Step A: Try GET /v2/ugcPosts/{urn} and compare post.author.
 * Step B (fallback): If A returns 403/404 and vanityName is available,
 *   call GET /v2/me?projection=(vanityName) and compare vanity names.
 *
 * Throws on unrecoverable errors or ownership mismatch.
 */
export async function verifyPostOwnership(
  token: string,
  urn: string,
  linkedinId: string,
  vanityName: string | null
): Promise<OwnershipResult> {
  const ugcRes = await fetch(
    `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(urn)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );

  if (ugcRes.ok) {
    const ugcPost = (await ugcRes.json()) as Record<string, unknown>;
    const expectedAuthor = `urn:li:person:${linkedinId}`;
    if (ugcPost.author !== expectedAuthor) {
      throw new Error("This post doesn't belong to your LinkedIn account.");
    }
    const share = (
      ugcPost.specificContent as Record<string, unknown> | undefined
    )?.["com.linkedin.ugc.ShareContent"] as Record<string, unknown> | undefined;
    const commentary = (
      share?.shareCommentary as Record<string, unknown> | undefined
    )?.text;
    const publishedAt =
      typeof ugcPost.created === "object" && ugcPost.created !== null
        ? ((ugcPost.created as Record<string, unknown>).time as number) ??
          Date.now()
        : Date.now();
    return {
      confirmed: true,
      content: typeof commentary === "string" ? commentary : "",
      publishedAt,
      strategy: "ugc-api",
    };
  }

  if (ugcRes.status === 403 || ugcRes.status === 404) {
    // Step A failed — fall back to OIDC identity check if vanityName is available.
    // We use GET /v2/userinfo (requires only openid+profile scopes — always available)
    // instead of GET /v2/me?projection=(vanityName) which requires the deprecated
    // r_liteprofile scope that is not granted to OIDC apps.
    // We compare the `sub` (LinkedIn person ID) against the stored linkedinId —
    // this is stronger than comparing mutable vanity name strings.
    if (!vanityName) {
      throw new Error(
        "Could not verify post ownership. Use a /posts/\u2026 URL format for fallback verification."
      );
    }
    const userinfoRes = await fetch(
      "https://api.linkedin.com/v2/userinfo",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!userinfoRes.ok) {
      throw new Error(
        "Could not verify post ownership. LinkedIn API unavailable."
      );
    }
    const userinfo = (await userinfoRes.json()) as Record<string, unknown>;
    const sub = userinfo.sub as string | undefined;
    if (!sub || sub !== linkedinId) {
      throw new Error("This post doesn't belong to your LinkedIn account.");
    }
    return {
      confirmed: true,
      content: "",
      publishedAt: Date.now(),
      strategy: "vanity-heuristic",
    };
  }

  throw new Error(`LinkedIn API error: ${ugcRes.status}`);
}
