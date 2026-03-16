import type { LinkedInTokenResponse, LinkedInUserInfo } from "./types.js";

// Scopes for "Sign In with LinkedIn using OpenID Connect" (default product for new apps).
//
// - openid / profile / email: standard OIDC, requires "Sign In with LinkedIn using OpenID Connect"
// - w_member_social: comment + react as the user, requires "Share on LinkedIn" product
//
// Scopes that need LinkedIn MDP review (NOT included here until approved):
//   r_member_social  — read user's own posts
//   r_network        — read 1st-degree connection IDs
// Add them back to SCOPES once LinkedIn approves the app:
//   "r_member_social", "r_network"
const SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
].join(" ");

export function buildAuthUrl(state: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI!;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<LinkedInTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI!;

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status} — ${body}`);
  }
  return res.json() as Promise<LinkedInTokenResponse>;
}

// OpenID Connect userinfo endpoint — works with openid/profile/email scopes.
// Replaces the deprecated /v2/me + r_liteprofile approach.
export async function fetchLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`UserInfo fetch failed: ${res.status} — ${body}`);
  }
  return res.json() as Promise<LinkedInUserInfo>;
}
