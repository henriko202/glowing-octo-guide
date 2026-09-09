// convex/lib/policy.ts
// Single source of truth for the current published privacy-policy version.
// Bump this string (and the policy text) whenever the privacy policy materially
// changes — users whose `acknowledgedPolicyVersion` differs are re-prompted to
// acknowledge on next login (re-consent flow lands in Phase 3).
export const POLICY_VERSION = '2026-09-08'
