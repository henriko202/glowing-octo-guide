// Where the landing trial buttons send visitors:
// straight into LinkedIn OAuth, which Convex initiates at `${NEXT_PUBLIC_CONVEX_SITE}/auth/linkedin`.
//
// Going directly to OAuth — rather than to the app root — matters because the app bounces a
// previously-signed-out visitor BACK to this landing site (so sign-out sticks). If the CTAs pointed
// at the app root, such a visitor would ping-pong between the app and this site and could never log
// in. Hitting OAuth directly clears that signed-out state on success (app's AuthSuccessPage).
//
// Falls back to the app root when NEXT_PUBLIC_CONVEX_SITE isn't configured.
const CONVEX_SITE = process.env.NEXT_PUBLIC_CONVEX_SITE
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173'

export const SIGN_IN_URL = CONVEX_SITE ? `${CONVEX_SITE}/auth/linkedin` : APP_URL
