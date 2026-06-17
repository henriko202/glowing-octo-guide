import { describe, it, expect } from 'vitest'
import schema from './schema'

describe('schema', () => {
  it('defines all required tables', () => {
    const tables = schema.tables
    expect(tables).toHaveProperty('users')
    expect(tables).toHaveProperty('posts')
    expect(tables).toHaveProperty('subscriptions')
    expect(tables).toHaveProperty('featuredPostUsage')
    expect(tables).toHaveProperty('planLimits')
    expect(tables).toHaveProperty('postQueue')
  })

  it('defines the privacy & compliance tables', () => {
    const tables = schema.tables
    expect(tables).toHaveProperty('consentRecords')
    expect(tables).toHaveProperty('dataExportRequests')
    expect(tables).toHaveProperty('auditLogs')
  })

  it('defines the feedback table', () => {
    expect(schema.tables).toHaveProperty('feedback')
  })

  it('defines the feedbackResponses table', () => {
    expect(schema.tables).toHaveProperty('feedbackResponses')
  })
})
