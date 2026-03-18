// convex/http.ts
import { httpRouter, httpActionGeneric as httpAction } from "convex/server";
import { internal } from "./_generated/api.js";
import { buildAuthUrl, exchangeCodeForTokens, fetchLinkedInUserInfo, fetchLinkedInPublicIdentifier } from "./linkedin/oauth.js";

const http = httpRouter();

// ─── LinkedIn OAuth ──────────────────────────────────────────────────────────

http.route({
  path: "/auth/linkedin",
  method: "GET",
  handler: httpAction(async (_ctx, _req) => {
    const state = crypto.randomUUID();
    const url = buildAuthUrl(state);
    return new Response(null, { status: 302, headers: { Location: url } });
  }),
});

http.route({
  path: "/auth/linkedin/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const appUrl = process.env.APP_URL ?? "http://localhost:5173";

    try {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        console.error("LinkedIn OAuth error param:", error, url.searchParams.get("error_description"));
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/login?error=oauth_denied` },
        });
      }

      if (!code) {
        console.error("LinkedIn callback: missing code parameter");
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/login?error=oauth_failed` },
        });
      }

      const tokens = await exchangeCodeForTokens(code);
      // Run userInfo and publicIdentifier fetches concurrently — independent requests
      const [userInfo, publicIdentifier] = await Promise.all([
        fetchLinkedInUserInfo(tokens.access_token),
        fetchLinkedInPublicIdentifier(tokens.access_token),
      ]);

      const tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

      const userId = await ctx.runMutation(internal.linkedin.auth.upsertUser, {
        linkedinId: userInfo.sub,
        name: userInfo.name,
        headline: undefined, // OIDC userinfo doesn't include headline
        profilePictureUrl: userInfo.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        // May be null if identityMe is unavailable — upsertUser handles null-safety
        linkedinPublicIdentifier: publicIdentifier ?? undefined,
      });

      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/auth/success?userId=${userId}` },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("OAuth callback error:", message, err);
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/login?error=auth_failed&reason=${encodeURIComponent(message)}` },
      });
    }
  }),
});

// NOTE: Stripe webhook route is registered by @convex-dev/stripe component.
export default http;
