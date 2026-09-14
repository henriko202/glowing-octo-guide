import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import BrandMark from '@/components/BrandMark'
import { Button } from '@/components/ui/button'

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
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">{t('privacy.consentPrompt.title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('privacy.consentPrompt.intro')}</p>
        <div className="mt-4 space-y-2">
          <label className="text-foreground flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              aria-label={t('privacy.consent.marketing')}
              checked={marketing}
              onChange={e => setMarketing(e.target.checked)}
              className="h-4 w-4"
            />
            <span>{t('privacy.consent.marketing')}</span>
          </label>
          <label className="text-foreground flex items-center gap-3 text-sm">
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
        <Button
          type="button"
          onClick={save}
          disabled={working}
          className="mt-5 w-full"
        >
          {working ? '…' : t('privacy.consentPrompt.save')}
        </Button>
        <p className="text-muted-foreground mt-3 text-xs">{t('privacy.consentPrompt.note')}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t('privacy.consentPrompt.digestNote')}</p>
      </div>
    </div>
  )
}
