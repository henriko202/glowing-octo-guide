import { beforeEach, describe, expect, it } from 'vitest'
import html from '../index.html?raw'

// The OAuth return capture runs inline in index.html before any bundle, so the test runs that exact text.
const captureScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

function land(url: string) {
  window.history.replaceState(null, '', url)
  new Function(captureScript)()
}

describe('index.html OAuth capture', () => {
  beforeEach(() => sessionStorage.clear())

  it('moves the code and plan into sessionStorage and scrubs the fragment', () => {
    land('/auth/success#code=code-1&plan=growth')
    expect(sessionStorage.getItem('oauthCode')).toBe('code-1')
    expect(sessionStorage.getItem('chosenPlan')).toBe('growth')
    expect(window.location.hash).toBe('')
  })

  // A member who clicks sign-in on the landing while signed in: AuthSuccessPage redeems it, so the funnel counts it.
  it('captures the code even when the tab already holds a session', () => {
    sessionStorage.setItem('sessionToken', 'tok-old')
    land('/auth/success#code=code-1')
    expect(sessionStorage.getItem('oauthCode')).toBe('code-1')
  })

  it('ignores a code on any other path', () => {
    land('/feed#code=code-1')
    expect(sessionStorage.getItem('oauthCode')).toBeNull()
  })
})
