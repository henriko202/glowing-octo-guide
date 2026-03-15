// convex/http.ts
// NOTE: httpRouter and httpAction are from "convex/server" — no _generated imports needed.
import { httpRouter } from "convex/server";
import { httpAction } from "convex/server";
import { buildAuthUrl, exchangeCodeForTokens, fetchLinkedInProfile } from "./linkedin/oauth";
import { upsertUserHandler } from "./linkedin/auth";

const http = httpRouter();

// Step 1: Redirect to LinkedIn OAuth page
http.route({
  path: "/auth/linkedin",
  method: "GET",
  handler: httpAction(async (_ctx, _req) => {
    const state = crypto.randomUUID();
    const url = buildAuthUrl(state);
    return new Response(null, {
      status: 302,
      headers: { Location: url },
    });
  }),
});

// Step 2: Handle LinkedIn OAuth callback
http.route({
  path: "/auth/linkedin/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/login?error=oauth_failed` },
      });
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      const profile = await fetchLinkedInProfile(tokens.access_token);

      const tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

      // Get profile picture URL from nested structure
      const pictureElements = profile.profilePicture?.["displayImage~"]?.elements;
      const profilePictureUrl = pictureElements?.[pictureElements.length - 1]?.identifiers?.[0]?.identifier;

      const userId = await upsertUserHandler(ctx.db, {
        linkedinId: profile.id,
        name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
        headline: profile.headline,
        profilePictureUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
      });

      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/auth/success?userId=${userId}` },
      });
    } catch (err) {
      console.error("OAuth callback error:", err);
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/login?error=auth_failed` },
      });
    }
  }),
});

export default http;
