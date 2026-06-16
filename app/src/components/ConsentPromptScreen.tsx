import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'

// One-time first-login prompt asking for the user's Communication & analytics consent.
// Shown by RequireAuth until users.consentPromptedAt is set. Both toggles default OFF; the user
// can change them anytime in Settings → Privacy & Data.
export default function ConsentPromptScreen() {
  const { t } = useTranslation()
  const complete = useMutation(api.privacy.consent.completeConsentPrompt)
  const [marketing, setMarketing] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [working, setWorking] = useState(false)

  async function save() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await complete({ sessionToken: token, marketing, analytics })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="text-lg font-bold text-slate-900">{t('privacy.consentPrompt.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('privacy.consentPrompt.intro')}</p>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              aria-label={t('privacy.consent.marketing')}
              checked={marketing}
              onChange={e => setMarketing(e.target.checked)}
              className="h-4 w-4"
            />
            <span>{t('privacy.consent.marketing')}</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              aria-label={t('privacy.consent.analytics')}
              checked={analytics}
              onChange={e => setAnalytics(e.target.checked)}
              className="h-4 w-4"
            />
            <span>{t('privacy.consent.analytics')}</span>
          </label>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={working}
          className="mt-5 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working ? '…' : t('privacy.consentPrompt.save')}
        </button>
        <p className="mt-3 text-xs text-slate-400">{t('privacy.consentPrompt.note')}</p>
      </div>
    </div>
  )
}
