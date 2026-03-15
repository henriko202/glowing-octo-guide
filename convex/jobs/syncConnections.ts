// convex/jobs/syncConnections.ts
import { internalAction, internalMutation, cronJobs } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

export function parseConnectionIds(data: any): string[] {
  return (data.elements ?? [])
    .map((el: any) => {
      const urn: string = el.connectedMember ?? "";
      return urn.split(":").pop() ?? null;
    })
    .filter((id: string | null): id is string => !!id && id.length > 0);
}

const getUserWithTokens = makeFunctionReference<"internalQuery">("users:getWithTokens");

export const upsertConnections = internalMutation({
  args: {
    userId: v.id("users"),
    connectionLinkedinIds: v.array(v.string()),
  },
  handler: async (ctx, { userId, connectionLinkedinIds }) => {
    const existing = await ctx.db
      .query("userConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { connectionLinkedinIds, lastSyncedAt: Date.now() });
    } else {
      await ctx.db.insert("userConnections", {
        userId,
        connectionLinkedinIds,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

export const syncUserConnections = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(getUserWithTokens, { userId });
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

      const data = await res.json() as { elements?: any[] };
      const ids = parseConnectionIds(data);
      allIds.push(...ids);
      if (ids.length < count) break;
      start += count;
    }

    const upsertFn = makeFunctionReference<"internalMutation">("jobs/syncConnections:upsertConnections");
    await ctx.runMutation(upsertFn, { userId, connectionLinkedinIds: allIds });
  },
});

const getActiveSubscribers = makeFunctionReference<"internalQuery">("users:getActiveSubscribers");

export const syncAllConnections = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(getActiveSubscribers, {});
    const syncFn = makeFunctionReference<"internalAction">("jobs/syncConnections:syncUserConnections");
    await Promise.allSettled(
      users.map((u: any) => ctx.runAction(syncFn, { userId: u._id }))
    );
  },
});

// Weekly cron: refresh connection caches every Monday at 3am UTC
export const connectionCrons = cronJobs();
connectionCrons.weekly(
  "sync LinkedIn connections",
  { dayOfWeek: "monday", hourUTC: 3, minuteUTC: 0 },
  makeFunctionReference<"internalAction">("jobs/syncConnections:syncAllConnections"),
  {}
);
