// app/src/convex.ts
// Type stubs until 'npx convex dev' generates the real API types.
// Replace these with: import { api } from "../../convex/_generated/api"

export const api = {
  users: {
    getMe: "users:getMe" as any,
  },
  feed: {
    getFeed: "feed:getFeed" as any,
  },
  interactions: {
    commentOnPost: "interactions:commentOnPost" as any,
    reactToPost: "interactions:reactToPost" as any,
  },
  billing: {
    createCheckoutSession: "billing:createCheckoutSession" as any,
  },
} as const;
