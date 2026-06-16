import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setIdentifierFn = vi.fn(async () => {})
const dismissFn = vi.fn(async () => {})

vi.mock('convex/react', () => ({
  useMutation: (ref: string) => (ref === 'setRef' ? setIdentifierFn : dismissFn)
}))
vi.mock('../convex', () => ({
  api: { users: { setPublicIdentifier: 'setRef', dismissPublicIdentifierPrompt: 'dismissRef' } }
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import PublicIdentifierPromptScreen from './PublicIdentifierPromptScreen'

describe('PublicIdentifierPromptScreen', () => {
  beforeEach(() => {
    setIdentifierFn.mockClear()
    dismissFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('disables Save until a valid profile URL is entered', () => {
    render(<PublicIdentifierPromptScreen />)
    const save = screen.getByRole('button', { name: 'onboarding.linkedinIdentifier.save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it('saves the extracted vanity name (lowercased)', async () => {
    render(<PublicIdentifierPromptScreen />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://www.linkedin.com/in/Henriko202' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.linkedinIdentifier.save' }))
    await waitFor(() =>
      expect(setIdentifierFn).toHaveBeenCalledWith({ sessionToken: 'tok', publicIdentifier: 'henriko202' })
    )
  })

  it('records a skip when the user clicks Skip for now', async () => {
    render(<PublicIdentifierPromptScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.linkedinIdentifier.skip' }))
    await waitFor(() => expect(dismissFn).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })
})
