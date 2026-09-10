import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import BrandMark from '@/components/BrandMark'
import { Button } from '@/components/ui/button'

export default function PolicyUpdateScreen() {
  const { t } = useTranslation()
  const acknowledge = useMutation(api.privacy.consent.acknowledgePolicy)
  const [working, setWorking] = useState(false)

  async function handleAcknowledge() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await acknowledge({ sessionToken: token })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">{t('privacy.policyUpdate.title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('privacy.policyUpdate.body')}</p>
        <div className="mt-5 flex items-center gap-3">
          <a
            href="https://www.linkintothessi.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gold-text hover:underline"
          >
            {t('privacy.policyUpdate.readPolicy')}
          </a>
          <Button
            type="button"
            onClick={handleAcknowledge}
            disabled={working}
            className="ml-auto"
          >
            {working ? '…' : t('privacy.policyUpdate.acknowledge')}
          </Button>
        </div>
      </div>
    </div>
  )
}
