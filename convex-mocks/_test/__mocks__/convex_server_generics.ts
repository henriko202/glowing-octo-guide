// Re-exports the convex-server mock and also exports Generic-suffixed aliases.
// Used so that source files can import the Generic names (for TypeScript
// compatibility with the real convex package) and tests still get stubs.

export * from './convex_server.js'

// Generic aliases — map to the same stubs
export {
  query as queryGeneric,
  mutation as mutationGeneric,
  action as actionGeneric,
  internalQuery as internalQueryGeneric,
  internalMutation as internalMutationGeneric,
  internalAction as internalActionGeneric,
  httpAction as httpActionGeneric
} from './convex_server.js'

// componentsGeneric is called by _generated/api.js to build the components object.
// Return a Proxy so any property access (e.g. components.stripe.foo) returns
// undefined rather than throwing, which keeps tests that import job files working.
export function componentsGeneric(): Record<string, unknown> {
  return new Proxy({}, { get: () => new Proxy({}, { get: () => undefined }) })
}
