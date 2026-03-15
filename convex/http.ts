// convex/http.ts
import { httpRouter, makeFunctionReference } from "convex/server";
import { httpAction } from "convex/server";
import { buildAuthUrl, exchangeCodeForTokens, fetchLinkedInProfile } from "./linkedin/oauth";

const http = httpRouter();

// LinkedIn OAuth routes
http.route({
  path: "/auth/linkedin",
  method: "GET",
  handler: httpAction(async (_ctx, _req) => {
    const state = crypto.randomUUID();
    const url = buildAuthUrl(state);
    return new Response(null, { status: 302, headers: { Location: url } });
  }),
});

const upsertUserMutation = makeFunctionReference<"internalMutation">("linkedin/auth:upsertUser");

http.route({
  path: "/auth/linkedin/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      return new Response(null, { status: 302, headers: { Location: `${appUrl}/login?error=oauth_failed` } });
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      const profile = await fetchLinkedInProfile(tokens.access_token);
      const tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
      const pictureElements = profile.profilePicture?.["displayImage~"]?.elements;
      const profilePictureUrl = pictureElements?.[pictureElements.length - 1]?.identifiers?.[0]?.identifier;

      const userId = await ctx.runMutation(upsertUserMutation, {
        linkedinId: profile.id,
        name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
        headline: profile.headline,
        profilePictureUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
      });

      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      return new Response(null, { status: 302, headers: { Location: `${appUrl}/auth/success?userId=${userId}` } });
    } catch (err) {
      console.error("OAuth callback error:", err);
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      return new Response(null, { status: 302, headers: { Location: `${appUrl}/login?error=auth_failed` } });
    }
  }),
});

// NOTE: Stripe webhook route is registered by @convex-dev/stripe component.
// It requires _generated/api to be available (run `npx convex dev` first).
// The registration code lives in a separate file to avoid import errors
// before code generation runs.
// See: convex/stripeRoutes.ts (created after `npx convex dev` generates types)

export default http;
