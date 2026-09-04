import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { signOut } from '../lib/session'
import BrandMark from '@/components/BrandMark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Props = {
  deletionScheduledAt?: number
}

export default function CancelDeletionScreen({ deletionScheduledAt }: Props) {
  const { t } = useTranslation()
  const cancelDeletion = useMutation(api.privacy.deletion.cancelAccountDeletion)
  const [working, setWorking] = useState(false)
  const dateLabel = deletionScheduledAt ? new Date(deletionScheduledAt).toLocaleDateString() : null

  async function keepAccount() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await cancelDeletion({ sessionToken: token })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />

        <div className="mb-3">
          <Badge variant="warning">{t('cancelDeletion.badge')}</Badge>
        </div>

        <h1 className="text-foreground font-display text-2xl font-semibold">{t('cancelDeletion.heading')}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {dateLabel ? t('cancelDeletion.bodyWithDate', { date: dateLabel }) : t('cancelDeletion.bodyNoDate')}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button
            type="button"
            onClick={keepAccount}
            disabled={working}
          >
            {working ? t('cancelDeletion.cancelling') : t('cancelDeletion.keepAccount')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={signOut}
          >
            {t('nav.signOut')}
          </Button>
        </div>
      </div>
    </div>
  )
}
