import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { Button } from '@/components/ui/button'
import { AUTH_URL } from '@/lib/session'

const DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * DAY_MS

export type ReconnectStatus = { variant: 'expired' } | { variant: 'expiring'; days: number }

/**
 * Pure gate — no tokenExpiresAt (undefined/null, nulled by the retention cron or never issued) OR
 * a tokenExpiresAt already in the past (expired at LinkedIn but not yet swept — submitPost is
 * already failing during that ~24h window) → "expired". A strictly-future tokenExpiresAt inside the
 * next 7 days → "expiring" with a day count (always >= 1). Otherwise (>= 7 days out) or signed-out
 * (`me` falsy) → null, render nothing.
 */
export function shouldShowReconnect(
  me: { tokenExpiresAt?: number | null } | null | undefined,
  now: number
): ReconnectStatus | null {
  if (!me) return null
  if (me.tokenExpiresAt == null || me.tokenExpiresAt <= now) return { variant: 'expired' }
  if (me.tokenExpiresAt >= now + SEVEN_DAYS_MS) return null
  return { variant: 'expiring', days: Math.ceil((me.tokenExpiresAt - now) / DAY_MS) }
}

function reconnect() {
  window.location.href = AUTH_URL
}

// ponytail: persistent, no dismiss state — the user can't route around an expired LinkedIn
// connection anyway, so nothing is lost by not letting them hide the banner. Add a dismiss if that
// changes (e.g. a snooze requirement).
export default function ReconnectBanner() {
  const { t } = useTranslation()
  const token = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken: token })

  // eslint-disable-next-line react-hooks/purity -- intentional: Date.now() used for expiry comparison; stale-by-one-render is acceptable
  const status = shouldShowReconnect(me, Date.now())
  if (!status) return null

  const urgent = status.variant === 'expired'
  const message =
    status.variant === 'expired'
      ? t('reconnectBanner.expiredMessage')
      : t('reconnectBanner.expiringMessage', { count: status.days })

  return (
    <div
      className={
        urgent
          ? 'border-destructive/30 bg-destructive/10 text-destructive w-full border-b px-4 py-2 text-sm'
          : 'border-border bg-accent text-accent-foreground w-full border-b px-4 py-2 text-sm'
      }
    >
      <div className="mx-auto flex max-w-[640px] items-center gap-3">
        <div className="min-w-0 flex-1">{message}</div>
        <Button
          type="button"
          size="sm"
          onClick={reconnect}
          className="shrink-0"
        >
          {t('reconnectBanner.reconnect')}
        </Button>
      </div>
    </div>
  )
}
