import { describe, it, expect } from 'vitest'
import { validateFeedbackMessage, MAX_FEEDBACK_LENGTH, FEEDBACK_CATEGORIES } from './feedback'

describe('validateFeedbackMessage', () => {
  it('trims and returns a valid message', () => {
    expect(validateFeedbackMessage('  hello  ')).toBe('hello')
  })

  it('throws on an empty / whitespace-only message', () => {
    expect(() => validateFeedbackMessage('')).toThrow(/empty/i)
    expect(() => validateFeedbackMessage('   ')).toThrow(/empty/i)
  })

  it(`throws when longer than ${MAX_FEEDBACK_LENGTH} chars (after trim)`, () => {
    expect(() => validateFeedbackMessage('a'.repeat(MAX_FEEDBACK_LENGTH + 1))).toThrow(/4000/)
  })

  it('accepts exactly the max length', () => {
    expect(validateFeedbackMessage('a'.repeat(MAX_FEEDBACK_LENGTH)).length).toBe(MAX_FEEDBACK_LENGTH)
  })
})

describe('FEEDBACK_CATEGORIES', () => {
  it('lists the 8 categories', () => {
    expect(FEEDBACK_CATEGORIES).toEqual([
      'feature_request',
      'bug',
      'comment',
      'criticism',
      'praise',
      'question',
      'suggestion',
      'other'
    ])
  })
})
