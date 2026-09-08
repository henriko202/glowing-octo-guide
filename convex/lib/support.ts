// convex/lib/support.ts
/**
 * The one monitored support / data-subject-rights address. The app re-exports it from
 * app/src/lib/support.ts so the cap email (backlog/R20), the banned screen and the
 * upgrade-at-limit mailto can never drift apart.
 */
export const SUPPORT_EMAIL = 'contact@linkintothessi.com'
