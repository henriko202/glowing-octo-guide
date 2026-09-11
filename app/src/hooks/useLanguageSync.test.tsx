import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { useLanguageSync } from './useLanguageSync'

const mutationMock = vi.fn(async () => {})
vi.mock('convex/react', () => ({
  useMutation: () => mutationMock
}))
vi.mock('../convex', () => ({
  api: { users: { setLanguage: 'setLanguage' } }
}))

describe('useLanguageSync', () => {
  beforeEach(() => {
    mutationMock.mockClear()
  })

  afterEach(async () => {
    // The i18n instance is a singleton — reset it so a leaked language cannot bleed into other files.
    await i18n.changeLanguage('en')
  })

  it('does nothing without a session token', () => {
    renderHook(() => useLanguageSync({ language: 'en' }, undefined))
    expect(mutationMock).not.toHaveBeenCalled()
  })

  it('does nothing before the member loads', () => {
    renderHook(() => useLanguageSync(null, 'tok'))
    expect(mutationMock).not.toHaveBeenCalled()
  })

  it('does not write when the account language already matches the UI', () => {
    renderHook(() => useLanguageSync({ language: 'en' }, 'tok'))
    expect(mutationMock).not.toHaveBeenCalled()
  })

  it('persists the current UI language when the account has none', () => {
    renderHook(() => useLanguageSync({}, 'tok'))
    expect(mutationMock).toHaveBeenCalledTimes(1)
    expect(mutationMock).toHaveBeenCalledWith({ sessionToken: 'tok', language: 'en' })
  })

  it('persists an in-app language switch', async () => {
    renderHook(() => useLanguageSync({ language: 'en' }, 'tok'))
    await act(async () => {
      await i18n.changeLanguage('pt')
    })
    expect(mutationMock).toHaveBeenCalledTimes(1)
    expect(mutationMock).toHaveBeenCalledWith({ sessionToken: 'tok', language: 'pt' })
  })

  it('does not add a call when re-rendered with equal values', () => {
    const { rerender } = renderHook(({ me }: { me: { language?: string } }) => useLanguageSync(me, 'tok'), {
      initialProps: { me: { language: 'en' } }
    })
    rerender({ me: { language: 'en' } })
    expect(mutationMock).not.toHaveBeenCalled()
  })
})
