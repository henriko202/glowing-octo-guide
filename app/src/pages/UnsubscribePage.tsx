import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import BrandMark from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { api } from '../convex'
import { SUPPORT_EMAIL } from '@/lib/support'

type Scope = 'digest' | 'all'
type ResultStatus = 'ok' | 'okAll' | 'invalid' | 'unavailable'
type Status = ResultStatus | 'confirm'

export default function UnsubscribePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const unsubscribeByToken = useMutation(api.users.unsubscribeByToken)
  const [result, setResult] = useState<ResultStatus | null>(null)
  const [pendingScope, setPendingScope] = useState<Scope | null>(null)

  const token = searchParams.get('token') ?? ''
  const urlStatus = searchParams.get('status')
  // The mutation result wins over the URL (it also lands in the URL). With neither, a token means the member has
  // something to confirm; anything else is not a usable link.
  const status: Status =
    result ??
    (urlStatus === 'ok' || urlStatus === 'invalid' || urlStatus === 'unavailable'
      ? urlStatus
      : token
        ? 'confirm'
        : 'invalid')

  async function handleUnsubscribe(scope: Scope) {
    if (!token || pendingScope !== null) return
    setPendingScope(scope)
    try {
      const { status: outcome } = await unsubscribeByToken({ token, scope })
      if (outcome === 'ok') {
        setResult(scope === 'all' ? 'okAll' : 'ok')
        // Drop the token from the address bar: the status is all the URL needs to keep.
        setSearchParams({ status: 'ok' }, { replace: true })
      } else {
        setResult(outcome)
      }
    } catch {
      setResult('unavailable')
    } finally {
      setPendingScope(null)
    }
  }

  const pending = pendingScope !== null
  const succeeded = status === 'ok' || status === 'okAll'
  const messageKey =
    status === 'ok'
      ? 'unsubscribed.ok'
      : status === 'okAll'
        ? 'unsubscribed.okAll'
        : status === 'unavailable'
          ? 'unsubscribed.unavailable'
          : 'unsubscribed.invalid'

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">{t('unsubscribed.title')}</h1>
        {status === 'confirm' ? (
          <>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('unsubscribed.intro')}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={pending}
                onClick={() => void handleUnsubscribe('digest')}
              >
                {t('unsubscribed.confirmDigest')}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={pending}
                onClick={() => void handleUnsubscribe('all')}
              >
                {t('unsubscribed.confirmAll')}
              </Button>
            </div>
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{t('unsubscribed.allNote')}</p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t(messageKey)}</p>
            <div className="mt-5 flex flex-col items-start gap-2 text-sm">
              {succeeded ? (
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
          </>
        )}
      </div>
    </div>
  )
}
