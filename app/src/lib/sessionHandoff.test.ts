import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { joinSessionChannel } from './sessionHandoff'

// jsdom has no BroadcastChannel. This one delivers synchronously to every OTHER instance, which is
// the only property the handoff relies on (a tab never hears its own message).
type Listener = (event: { data: unknown }) => void
class FakeChannel {
  static all = new Set<FakeChannel>()
  listeners = new Set<Listener>()
  constructor() {
    FakeChannel.all.add(this)
  }
  addEventListener(_type: string, listener: Listener) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: string, listener: Listener) {
    this.listeners.delete(listener)
  }
  postMessage(data: unknown) {
    for (const other of FakeChannel.all) {
      if (other !== this) for (const listener of [...other.listeners]) listener({ data })
    }
  }
}

/** A sibling tab: answers a request with `token` when it holds one, and records what it hears. */
function sibling(token?: string) {
  const channel = new FakeChannel()
  const heard: unknown[] = []
  channel.addEventListener('message', event => {
    heard.push(event.data)
    if (event.data === 'session-request' && token) channel.postMessage({ token })
  })
  return { channel, heard }
}

beforeEach(() => {
  sessionStorage.clear()
  FakeChannel.all.clear()
  vi.stubGlobal('BroadcastChannel', FakeChannel)
  vi.useFakeTimers()
  window.history.replaceState(null, '', '/billing')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('joinSessionChannel', () => {
  it('takes the token from a sibling tab before resolving', async () => {
    sibling('tok-a')
    await joinSessionChannel()
    expect(sessionStorage.getItem('sessionToken')).toBe('tok-a')
  })

  it('resolves without a token once the wait runs out with no sibling', async () => {
    let resolved = false
    void joinSessionChannel().then(() => (resolved = true))
    await vi.advanceTimersByTimeAsync(299)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
    expect(sessionStorage.getItem('sessionToken')).toBeNull()
  })

  it('does not ask, and answers siblings, when the tab already holds a token', async () => {
    sessionStorage.setItem('sessionToken', 'mine')
    const other = sibling('theirs')
    await joinSessionChannel()
    expect(other.heard).toEqual([])
    expect(sessionStorage.getItem('sessionToken')).toBe('mine')

    other.channel.postMessage('session-request')
    expect(other.heard).toEqual([{ token: 'mine' }])
  })

  it('does not wait on the sign-in routes', async () => {
    window.history.replaceState(null, '', '/auth/success')
    const other = sibling('tok-a')
    await joinSessionChannel()
    expect(other.heard).toEqual([])
    expect(sessionStorage.getItem('sessionToken')).toBeNull()
  })

  it('ignores an answer that is not a token', async () => {
    const other = sibling()
    const joined = joinSessionChannel()
    other.channel.postMessage({ token: 42 })
    other.channel.postMessage('session-request')
    await vi.advanceTimersByTimeAsync(300)
    await joined
    expect(sessionStorage.getItem('sessionToken')).toBeNull()
  })

  it('resolves at once in a browser without BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    await joinSessionChannel()
    expect(sessionStorage.getItem('sessionToken')).toBeNull()
  })
})
