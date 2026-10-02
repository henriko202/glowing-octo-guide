// A tab opened with ctrl/middle click starts with an EMPTY sessionStorage (it is per tab), so it
// looked signed out: RequireAuth sent it through LinkedIn again and the member landed on /feed, not
// on the page they clicked. Tabs of this origin hand the token to each other over a BroadcastChannel
// instead. Nothing is persisted, so the token still dies with the last tab.
const TOKEN_KEY = 'sessionToken'
const REQUEST = 'session-request'
/** How long a tab with no token waits for a sibling to answer before carrying on without one. */
const WAIT_MS = 300

/**
 * Call once, before the first render: every page reads the token from sessionStorage as it renders.
 * Resolves at once for a tab that already holds a token; otherwise when a sibling answers, or after
 * WAIT_MS with no token (no sibling tab: RequireAuth starts the login as before).
 */
export function joinSessionChannel(): Promise<void> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve()
  const channel = new BroadcastChannel('session')
  channel.addEventListener('message', (event: MessageEvent) => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (event.data === REQUEST && token) channel.postMessage({ token })
  })

  // The sign-in routes never need a session, and waiting there would only slow the login down.
  if (sessionStorage.getItem(TOKEN_KEY) || window.location.pathname.startsWith('/auth/')) return Promise.resolve()

  return new Promise(resolve => {
    const finish = () => {
      window.clearTimeout(timer)
      channel.removeEventListener('message', onAnswer)
      resolve()
    }
    // ponytail: the first sibling to answer wins. Two tabs signed in as different accounts (dev
    // impersonation, mostly) make that a coin toss; name the opener if it ever matters.
    const onAnswer = (event: MessageEvent) => {
      const token = (event.data as { token?: unknown } | null)?.token
      if (typeof token !== 'string') return
      sessionStorage.setItem(TOKEN_KEY, token)
      finish()
    }
    const timer = window.setTimeout(finish, WAIT_MS)
    channel.addEventListener('message', onAnswer)
    channel.postMessage(REQUEST)
  })
}
