// Shared session / sign-out helpers for the app shell.
import { syncAnalyticsConsent } from './observability/analytics'

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE as string

/** The Convex HTTP endpoint that kicks off LinkedIn OAuth. */
export const AUTH_URL = `${CONVEX_SITE_URL}/auth/linkedin`

/**
 * The marketing/landing site (the separate Next.js app — its own origin). Sign-out returns here, and
 * RequireAuth bounces signed-out users here too. Defaults to the landing dev server (`next dev` →
 * :3000) when `VITE_LANDING_URL` is unset.
 */
export const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string | undefined) ?? 'http://localhost:3000'

// Persistent "the user explicitly signed out" marker (localStorage, app origin). It must survive the
// redirect to the landing site AND a later return to the app, so it can't be in-memory: on return,
// RequireAuth sees it and bounces the user back to the landing site instead of auto-starting OAuth
// (LinkedIn's SSO session is still alive, so auto-OAuth would silently re-log them in). It is also
// set BEFORE users.logout — which makes the reactive getMe go null while the app is still mounted and
// would otherwise trip the auto-OAuth redirect mid-sign-out. Cleared on the next successful login
// (AuthSuccessPage), so normal "auto-redirect for login" resumes for fresh/expired sessions.
const SIGNED_OUT_KEY = 'signedOut'

export function isSignedOut(): boolean {
  return localStorage.getItem(SIGNED_OUT_KEY) === '1'
}

export function markSignedOut(): void {
  localStorage.setItem(SIGNED_OUT_KEY, '1')
}

export function clearSignedOut(): void {
  localStorage.removeItem(SIGNED_OUT_KEY)
}

/** Begin a sign-out. Call this BEFORE users.logout, since logout is what flips getMe to null. */
export function beginSignOut(): void {
  markSignedOut()
}

/**
 * Sign the user out: turn analytics off the way a withdrawal does (DataFast stopped and its cookies deleted, PostHog
 * opted out and its stored identity cleared, so the next member on this browser starts as a new visitor), mark the
 * explicit sign-out, drop the local session token, and leave the SPA for the landing site (a separate origin).
 * Callers holding a live Convex session should invalidate it server-side (users.logout) before calling this, and
 * call beginSignOut() first so the marker is set before logout flips getMe to null.
 */
export function signOut(): void {
  syncAnalyticsConsent(undefined, null)
  markSignedOut()
  sessionStorage.removeItem('sessionToken')
  // The dismissed-MOTD memory stores the session token, so it must die with the session.
  sessionStorage.removeItem('motdDismissed')
  window.location.assign(LANDING_URL)
}

/**
 * Full sign-out orchestration used by the app shell's user menu: set the explicit-sign-out marker
 * BEFORE logout (so the reactive getMe→null doesn't trip auto-OAuth), invalidate the session
 * server-side when a token exists, then leave the SPA for the landing site.
 */
export async function performSignOut(
  logout: (args: { sessionToken: string }) => Promise<unknown>,
  token: string | null
): Promise<void> {
  beginSignOut()
  if (token) {
    try {
      await logout({ sessionToken: token })
    } catch {
      /* ignore — we sign out locally regardless */
    }
  }
  signOut()
}
