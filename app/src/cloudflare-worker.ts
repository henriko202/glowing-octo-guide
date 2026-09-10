interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.hostname === 'app.linkintothessi.com') {
      url.hostname = 'www.app.linkintothessi.com'
      return Response.redirect(url, 308)
    }

    return env.ASSETS.fetch(request)
  }
}
