// convex/lib/html.ts
// Shared HTML escaping for transactional-email builders. The layout helpers and the per-flow
// templates all route interpolated user text through this one function.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
