import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requestExport = vi.fn(async () => ({ requestId: 'r1' }))
const requestDeletion = vi.fn(async () => ({ deletionScheduledAt: 1893456000000 }))
let exportStatusVal: unknown = null
let downloadUrlVal: unknown = null

vi.mock('convex/react', () => ({
  useQuery: (ref: string) =>
    ref === 'getExportStatus' ? exportStatusVal : ref === 'getExportDownloadUrl' ? downloadUrlVal : null,
  useMutation: (ref: string) =>
    ref === 'requestDataExport' ? requestExport : ref === 'requestAccountDeletion' ? requestDeletion : vi.fn()
}))
vi.mock('../convex', () => ({
  api: {
    privacy: {
      export: {
        getExportStatus: 'getExportStatus',
        getExportDownloadUrl: 'getExportDownloadUrl',
        requestDataExport: 'requestDataExport'
      },
      deletion: { requestAccountDeletion: 'requestAccountDeletion' },
      consent: { getConsents: 'getConsents', recordConsent: 'recordConsent' }
    }
  }
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { date?: string }) => (o?.date ? `${k}:${o.date}` : k) })
}))

import PrivacyDataPage from './PrivacyDataPage'

describe('PrivacyDataPage', () => {
  beforeEach(() => {
    requestExport.mockClear()
    requestDeletion.mockClear()
    exportStatusVal = null
    downloadUrlVal = null
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('requests an export when the export button is clicked', async () => {
    render(<PrivacyDataPage />)
    fireEvent.click(screen.getByRole('button', { name: 'privacy.exportButton' }))
    await waitFor(() => expect(requestExport).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })

  it('shows a download link when an export is ready', () => {
    exportStatusVal = { status: 'ready', requestedAt: 1 }
    downloadUrlVal = 'https://files/export.json'
    render(<PrivacyDataPage />)
    const link = screen.getByRole('link', { name: 'privacy.download' })
    expect(link).toHaveAttribute('href', 'https://files/export.json')
  })

  it('requires typing DELETE before deleting, then schedules deletion', async () => {
    render(<PrivacyDataPage />)
    fireEvent.click(screen.getByRole('button', { name: 'privacy.deleteButton' }))
    const confirmBtn = screen.getByRole('button', { name: 'privacy.confirmDeleteButton' })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('privacy.confirmInputLabel'), { target: { value: 'DELETE' } })
    expect(confirmBtn).toBeEnabled()
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(requestDeletion).toHaveBeenCalledWith({ sessionToken: 'tok' }))
    expect(screen.getByText('privacy.deletionScheduledTitle')).toBeInTheDocument()
  })
})
