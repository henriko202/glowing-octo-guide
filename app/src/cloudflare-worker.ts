interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
}

// LinkedIn's consent screen prints the host of `redirect_uri`, so the callback lands on the app host and is
// passed on to the Convex HTTP action, which owns the nonce cookie and the code exchange. This is the
// production deployment; it must equal the VITE_CONVEX_SITE build variable.
const CONVEX_SITE = 'https://whimsical-elk-440.convex.site'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/auth/linkedin/callback') {
      return new Response(null, {
        status: 302,
        headers: { Location: `${CONVEX_SITE}${url.pathname}${url.search}`, 'Cache-Control': 'no-store' }
      })
    }

    if (url.hostname === 'app.linkintothessi.com') {
      url.hostname = 'www.app.linkintothessi.com'
      return Response.redirect(url, 308)
    }

    return env.ASSETS.fetch(request)
  }
}
