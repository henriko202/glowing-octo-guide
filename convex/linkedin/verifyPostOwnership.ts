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
 *   call GET /rest/me?fields=publicIdentifier (versioned API, works with OIDC profile scope)
 *   and compare publicIdentifier against the URL's vanityName (case-insensitive).
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
    // Step A failed — fall back to vanity name heuristic if available.
    // We call GET /v2/me?projection=(vanityName) with the Restli REST header.
    // LinkedIn OIDC `profile` scope grants the same r_liteprofile access, so this
    // endpoint works with our tokens. We compare the returned vanityName against the
    // name extracted from the post URL — this is the actual ownership check.
    if (!vanityName) {
      throw new Error(
        "Could not verify post ownership. Use a /posts/\u2026 URL format for fallback verification."
      );
    }
    // Use the versioned REST API — /v2/me requires r_liteprofile (legacy, blocked for
    // OIDC apps). /rest/me with LinkedIn-Version header works with our profile OIDC scope.
    // `publicIdentifier` is the versioned API's name for the legacy `vanityName` field.
    const meRes = await fetch(
      "https://api.linkedin.com/rest/me?fields=publicIdentifier",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    if (!meRes.ok) {
      const body = await meRes.text().catch(() => "");
      throw new Error(
        `Could not verify post ownership. LinkedIn /rest/me returned ${meRes.status}${body ? `: ${body}` : ""}.`
      );
    }
    const meData = (await meRes.json()) as Record<string, unknown>;
    const myVanity = meData.publicIdentifier as string | undefined;
    if (!myVanity || myVanity.toLowerCase() !== vanityName.toLowerCase()) {
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
