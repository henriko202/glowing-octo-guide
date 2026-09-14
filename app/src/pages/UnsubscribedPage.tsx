import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import BrandMark from '@/components/BrandMark'
import { SUPPORT_EMAIL } from '@/lib/support'

type Status = 'ok' | 'invalid' | 'unavailable' | null

export default function UnsubscribedPage() {
  const { t } = useTranslation()
  const [status] = useState<Status>(() => {
    const value = new URLSearchParams(window.location.search).get('status')
    return value === 'ok' || value === 'invalid' || value === 'unavailable' ? value : null
  })
  const messageKey = status === 'ok' ? 'ok' : status === 'unavailable' ? 'unavailable' : 'invalid'

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">{t('unsubscribed.title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t(`unsubscribed.${messageKey}`)}</p>
        <div className="mt-5 flex flex-col items-start gap-2 text-sm">
          {status === 'ok' ? (
            <Link
              to="/settings"
              className="text-primary hover:underline"
            >
              {t('unsubscribed.reEnable')}
            </Link>
          ) : (
            <Link
              to="/settings"
              className="text-primary hover:underline"
            >
              {t('unsubscribed.privacyLink')}
            </Link>
          )}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-primary hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  )
}
