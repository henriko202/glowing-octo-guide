import { describe, it, expect } from 'vitest'
import { parseConnectionIds } from './syncConnections'

describe('parseConnectionIds', () => {
  it('extracts LinkedIn person IDs from connections response', () => {
    const raw = {
      elements: [{ connectedMember: 'urn:li:person:abc123' }, { connectedMember: 'urn:li:person:def456' }]
    }
    const ids = parseConnectionIds(raw)
    expect(ids).toEqual(['abc123', 'def456'])
  })

  it('returns empty array for empty elements', () => {
    expect(parseConnectionIds({ elements: [] })).toEqual([])
  })

  it('filters out elements with missing connectedMember', () => {
    const raw = {
      elements: [{ connectedMember: 'urn:li:person:abc123' }, { connectedMember: '' }, { connectedMember: null }]
    }
    const ids = parseConnectionIds(raw)
    expect(ids).toEqual(['abc123'])
  })
})
