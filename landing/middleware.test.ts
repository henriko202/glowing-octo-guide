import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

describe('landing middleware', () => {
  it('permanently redirects the apex domain to the same www path and query', () => {
    const request = new NextRequest('https://linkintothessi.com/pricing?ref=launch')

    const response = middleware(request)

    expect(response?.status).toBe(308)
    expect(response?.headers.get('location')).toBe('https://www.linkintothessi.com/pricing?ref=launch')
  })

  it('passes through static files on the www domain', () => {
    const request = new NextRequest('https://www.linkintothessi.com/favicon.ico')

    expect(middleware(request)).toBeUndefined()
  })

  it.each(['/.well-known/api-catalog', '/openapi.json', '/auth.md', '/llms-full.txt', '/robots.txt'])(
    'passes %s through without locale routing',
    path => {
      const request = new NextRequest(`https://www.linkintothessi.com${path}`)

      expect(middleware(request)).toBeUndefined()
    }
  )
})
