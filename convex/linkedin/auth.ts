// convex/linkedin/auth.ts
// NOTE: Cannot use _generated imports until `npx convex dev` has been run.
// These functions will be wired via http.ts once generated types exist.
import { v } from "convex/values";

// Trial duration: 3 days in milliseconds
const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Upsert a user record after LinkedIn OAuth.
 * New users start on Starter tier with a 3-day trial.
 * Existing users get their tokens updated.
 */
export interface UpsertUserArgs {
  linkedinId: string;
  name: string;
  headline?: string;
  profilePictureUrl?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

// This will become an internalMutation once _generated/ exists.
// For now, export the handler logic as a plain function for testability.
export async function upsertUserHandler(
  db: any,
  args: UpsertUserArgs
): Promise<string> {
  const existing = await db
    .query("users")
    .withIndex("by_linkedin_id", (q: any) => q.eq("linkedinId", args.linkedinId))
    .first();

  if (existing) {
    await db.patch(existing._id, {
      name: args.name,
      headline: args.headline,
      profilePictureUrl: args.profilePictureUrl,
      linkedinAccessToken: args.accessToken,
      linkedinRefreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
    });
    return existing._id;
  }

  // New user: start Starter trial
  const trialEndsAt = Date.now() + TRIAL_DURATION_MS;
  return await db.insert("users", {
    linkedinId: args.linkedinId,
    name: args.name,
    headline: args.headline,
    profilePictureUrl: args.profilePictureUrl,
    tier: "starter" as const,
    subscriptionStatus: "trialing" as const,
    trialEndsAt,
    linkedinAccessToken: args.accessToken,
    linkedinRefreshToken: args.refreshToken,
    tokenExpiresAt: args.tokenExpiresAt,
    createdAt: Date.now(),
  });
}
