// Re-exports the convex-server mock and also exports Generic-suffixed aliases.
// Used so that source files can import the Generic names (for TypeScript
// compatibility with the real convex package) and tests still get stubs.

export * from "./convex_server.js";

// Generic aliases — map to the same stubs
export {
  query as queryGeneric,
  mutation as mutationGeneric,
  action as actionGeneric,
  internalQuery as internalQueryGeneric,
  internalMutation as internalMutationGeneric,
  internalAction as internalActionGeneric,
  httpAction as httpActionGeneric,
} from "./convex_server.js";
