// convex/jobs/syncConnections.ts
import { internalActionGeneric as internalAction, internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import type { MutationCtx, ActionCtx, UserDoc } from "../convexTypes.js";
import type { LinkedInConnectionsResponse } from "../linkedin/types.js";

export function parseConnectionIds(data: LinkedInConnectionsResponse): string[] {
  return (data.elements ?? [])
    .map((el) => {
      const urn: string = el.connectedMember ?? "";
      return urn.split(":").pop() ?? null;
    })
    .filter((id): id is string => !!id && id.length > 0);
}

export const upsertConnections = internalMutation({
  args: {
    userId: v.id("users"),
    connectionLinkedinIds: v.array(v.string()),
  },
  handler: async (ctx, { userId, connectionLinkedinIds }: { userId: string; connectionLinkedinIds: string[] }) => {
    const db = (ctx as unknown as MutationCtx).db;
    const existing = await db
      .query("userConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await db.patch(existing._id, { connectionLinkedinIds, lastSyncedAt: Date.now() });
    } else {
      await db.insert("userConnections", {
        userId,
        connectionLinkedinIds,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

export const syncUserConnections = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }: { userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx;
    const user = await actionCtx.runQuery<UserDoc | null>(
      internal.users.getWithTokens,
      { userId }
    );
    if (!user?.linkedinAccessToken) return;

    let allIds: string[] = [];
    let start = 0;
    const count = 500;

    while (true) {
      const res = await fetch(
        `https://api.linkedin.com/v2/connections?q=viewer&start=${start}&count=${count}`,
        {
          headers: {
            Authorization: `Bearer ${user.linkedinAccessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }
      );

      if (res.status === 403) {
        // r_network scope not granted — degrade gracefully
        console.warn(`r_network scope not available for user ${userId}`);
        return;
      }
      if (!res.ok) throw new Error(`Connections fetch failed: ${res.status}`);

      const data = (await res.json()) as LinkedInConnectionsResponse;
      const ids = parseConnectionIds(data);
      allIds.push(...ids);
      if (ids.length < count) break;
      start += count;
    }

    await actionCtx.runMutation(internal.jobs.syncConnections.upsertConnections, {
      userId,
      connectionLinkedinIds: allIds,
    });
  },
});

// Fan-out action — dispatches per-user connection syncs
export const syncAllConnections = internalAction({
  args: {},
  handler: async (ctx) => {
    const actionCtx = ctx as unknown as ActionCtx;
    const users = await actionCtx.runQuery<UserDoc[]>(
      internal.users.getActiveSubscribers,
      {}
    );
    await Promise.allSettled(
      users.map((u) =>
        actionCtx.runAction(internal.jobs.syncConnections.syncUserConnections, { userId: u._id })
      )
    );
  },
});
