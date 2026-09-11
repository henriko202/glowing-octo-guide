// Where the landing trial buttons send visitors:
// to the app's PKCE entry point, `/auth/start`. That route generates the verifier (kept in this
// browser's sessionStorage) and its SHA-256 challenge, then bounces to Convex's OAuth start with the
// challenge. Convex rejects a direct hit on its OAuth start without a valid challenge, so every CTA
// must go through the app route first.
//
// Routing through `/auth/start` — rather than the app root — keeps a previously-signed-out visitor
// from ping-ponging between the app and this site: the route begins OAuth immediately, and the app's
// AuthSuccessPage clears that signed-out state on success.
//
// Falls back to the local app dev server when NEXT_PUBLIC_APP_URL isn't configured.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173'

export const SIGN_IN_URL = `${APP_URL}/auth/start`
