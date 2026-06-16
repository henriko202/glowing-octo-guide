import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import Modal from '../components/Modal'
import ConsentToggles from '../components/ConsentToggles'

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
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 mt-0 text-base font-semibold text-slate-900">{t('privacy.deletionScheduledTitle')}</h2>
          <p className="m-0 text-sm text-slate-700">
            {t('privacy.deletionScheduledBody', { date: new Date(deletionDate).toLocaleDateString() })}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 font-sans">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t('privacy.title')}</h1>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 mt-0 text-base font-semibold text-slate-900">{t('privacy.exportTitle')}</h2>
        <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('privacy.exportNote')}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || exportStatus?.status === 'pending'}
            className="rounded-md border-none bg-blue-500 px-4 py-[7px] text-[13px] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? t('privacy.requesting') : t('privacy.exportButton')}
          </button>
          {exportStatus?.status === 'pending' && (
            <span className="text-xs text-slate-500">{t('privacy.exportPending')}</span>
          )}
          {exportStatus?.status === 'ready' && downloadUrl && (
            <a
              href={downloadUrl}
              className="text-[13px] font-semibold text-blue-500 no-underline"
              download
            >
              {t('privacy.download')}
            </a>
          )}
          {exportStatus?.status === 'expired' && (
            <span className="text-xs text-slate-400">{t('privacy.exportExpired')}</span>
          )}
        </div>
      </section>

      <ConsentToggles />

      <section className="rounded-xl border border-red-200 bg-white p-5">
        <h2 className="mb-2 mt-0 text-base font-semibold text-red-700">{t('privacy.deleteTitle')}</h2>
        <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('privacy.deleteNote')}</p>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="rounded-md border border-red-300 bg-white px-4 py-[7px] text-[13px] font-semibold text-red-600 hover:bg-red-50"
        >
          {t('privacy.deleteButton')}
        </button>
      </section>

      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <h2 className="mb-2 mt-0 text-base font-semibold text-slate-900">{t('privacy.confirmTitle')}</h2>
          <p className="mb-3 text-sm text-slate-600">{t('privacy.confirmBody')}</p>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            aria-label={t('privacy.confirmInputLabel')}
            className="mb-3 w-full rounded-md border border-slate-300 px-[10px] py-[7px] text-[13px] outline-none"
          />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="text-sm font-semibold text-slate-500"
            >
              {t('privacy.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="rounded-md border-none bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? t('privacy.deleting') : t('privacy.confirmDeleteButton')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
