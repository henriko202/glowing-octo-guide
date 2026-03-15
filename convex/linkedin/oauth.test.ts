import { describe, it, expect } from "vitest";
import { buildAuthUrl } from "./oauth";

describe("buildAuthUrl", () => {
  it("generates a valid LinkedIn OAuth URL", () => {
    // Set env vars for the test
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost:5173/auth/callback";

    const url = buildAuthUrl("test-state-123");
    expect(url).toContain("linkedin.com/oauth/v2/authorization");
    expect(url).toContain("response_type=code");
    expect(url).toContain("r_liteprofile");
    expect(url).toContain("w_member_social");
    expect(url).toContain("r_network");
    expect(url).toContain("state=test-state-123");
    expect(url).toContain("client_id=test-client-id");
  });

  it("includes all 5 required scopes", () => {
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost:5173/auth/callback";

    const url = buildAuthUrl("state");
    const parsed = new URL(url);
    const scope = parsed.searchParams.get("scope") ?? "";
    expect(scope).toContain("r_liteprofile");
    expect(scope).toContain("r_emailaddress");
    expect(scope).toContain("r_member_social");
    expect(scope).toContain("w_member_social");
    expect(scope).toContain("r_network");
  });
});
