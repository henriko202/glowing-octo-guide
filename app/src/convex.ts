// app/src/convex.ts
// Type stubs until 'npx convex dev' generates the real API types.
// Replace these with: import { api } from "../../convex/_generated/api"
//
// makeFunctionReference creates a properly typed FunctionReference<"query"|"mutation"|"action">
// that satisfies the Convex React hooks (useQuery, useAction, useMutation).

import { makeFunctionReference } from "convex/server";

export const api = {
  users: {
    getMe: makeFunctionReference<"query">("users:getMe"),
  },
  feed: {
    getFeed: makeFunctionReference<"query">("feed:getFeed"),
  },
  interactions: {
    commentOnPost: makeFunctionReference<"action">("interactions:commentOnPost"),
    reactToPost: makeFunctionReference<"action">("interactions:reactToPost"),
  },
  billing: {
    createCheckoutSession: makeFunctionReference<"action">("billing:createCheckoutSession"),
  },
} as const;
