import { describe, it, expect } from 'vitest'
import { feedbackReplyEmail } from './emails'

describe('feedbackReplyEmail', () => {
  it('includes the reply, quotes the original, and names the app', () => {
    const m = feedbackReplyEmail({ replyText: 'Thanks, fixed it!', originalMessage: 'The button is broken' })
    expect(m.subject).toMatch(/feedback/i)
    expect(m.html).toContain('Link Into The SSI')
    expect(m.html).toContain('Thanks, fixed it!')
    expect(m.html).toContain('The button is broken')
    expect(m.text).toContain('Thanks, fixed it!')
    expect(m.text).toContain('The button is broken')
  })

  it('HTML-escapes user-provided content to prevent injection', () => {
    const m = feedbackReplyEmail({ replyText: '<script>x</script>', originalMessage: 'a & b <img>' })
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.html).toContain('a &amp; b &lt;img&gt;')
  })
})
