import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import Modal from '../components/Modal'
import ConsentToggles from '../components/ConsentToggles'
import { PageHeader } from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function PrivacyDataPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const exportStatus = useQuery(api.privacy.export.getExportStatus, sessionToken ? { sessionToken } : 'skip') as
    | { status: string; requestedAt: number }
    | null
    | undefined
  const downloadUrl = useQuery(api.privacy.export.getExportDownloadUrl, sessionToken ? { sessionToken } : 'skip') as
    | string
    | null
    | undefined
  const requestExport = useMutation(api.privacy.export.requestDataExport)
  const requestDeletion = useMutation(api.privacy.deletion.requestAccountDeletion)

  const [exporting, setExporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deletionDate, setDeletionDate] = useState<number | null>(null)

  async function handleExport() {
    if (!sessionToken) return
    setExporting(true)
    try {
      await requestExport({ sessionToken })
    } finally {
      setExporting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!sessionToken) return
    setDeleting(true)
    try {
      const res = (await requestDeletion({ sessionToken })) as { deletionScheduledAt: number }
      setConfirmOpen(false)
      setDeletionDate(res.deletionScheduledAt)
    } finally {
      setDeleting(false)
    }
  }

  if (deletionDate) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-8 font-sans">
        <section className="border-border bg-accent rounded-xl border p-5">
          <h2 className="text-accent-foreground mb-2 mt-0 text-base font-semibold">
            {t('privacy.deletionScheduledTitle')}
          </h2>
          <p className="text-foreground m-0 text-sm">
            {t('privacy.deletionScheduledBody', { date: new Date(deletionDate).toLocaleDateString() })}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 font-sans">
      <PageHeader title={t('privacy.title')} />

      <section className="border-border bg-card mb-4 rounded-xl border p-5">
        <h2 className="text-foreground mb-2 mt-0 text-base font-semibold">{t('privacy.exportTitle')}</h2>
        <p className="text-muted-foreground mb-3 mt-0 text-[13px]">{t('privacy.exportNote')}</p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleExport}
            disabled={exporting || exportStatus?.status === 'pending'}
          >
            {exporting ? t('privacy.requesting') : t('privacy.exportButton')}
          </Button>
          {exportStatus?.status === 'pending' && (
            <span className="text-muted-foreground text-xs">{t('privacy.exportPending')}</span>
          )}
          {exportStatus?.status === 'ready' && downloadUrl && (
            <a
              href={downloadUrl}
              className="text-gold-text text-[13px] font-semibold no-underline hover:underline"
              download
            >
              {t('privacy.download')}
            </a>
          )}
          {exportStatus?.status === 'expired' && (
            <span className="text-muted-foreground text-xs">{t('privacy.exportExpired')}</span>
          )}
        </div>
      </section>

      <ConsentToggles />

      <section className="border-destructive/40 bg-card rounded-xl border p-5">
        <h2 className="text-destructive mb-2 mt-0 text-base font-semibold">{t('privacy.deleteTitle')}</h2>
        <p className="text-muted-foreground mb-3 mt-0 text-[13px]">{t('privacy.deleteNote')}</p>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
        >
          {t('privacy.deleteButton')}
        </Button>
      </section>

      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <h2 className="text-foreground mb-2 mt-0 text-base font-semibold">{t('privacy.confirmTitle')}</h2>
          <p className="text-muted-foreground mb-3 text-sm">{t('privacy.confirmBody')}</p>
          <Input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            aria-label={t('privacy.confirmInputLabel')}
            className="mb-3 text-[13px]"
          />
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              {t('privacy.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t('privacy.deleting') : t('privacy.confirmDeleteButton')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
