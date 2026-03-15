const SCOPES = [
  "r_liteprofile",
  "r_emailaddress",
  "r_member_social",
  "w_member_social",
  "r_network",
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

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
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
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function fetchLinkedInProfile(accessToken: string): Promise<{
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  headline?: string;
  profilePicture?: { "displayImage~": { elements: Array<{ identifiers: Array<{ identifier: string }> }> } };
}> {
  const res = await fetch(
    "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,headline,profilePicture(displayImage~:playableStreams))",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return res.json() as Promise<any>;
}
