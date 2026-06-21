import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { extractVanityName } from '../lib/linkedinProfile'
import BrandMark from '@/components/BrandMark'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// One-time first-login onboarding prompt that asks the user to confirm their LinkedIn profile URL.
// Shown by RequireAuth when the user has no linkedinPublicIdentifier and hasn't been prompted yet.
// LinkedIn's OIDC login doesn't expose the vanityName, so we capture it from the user here (they can
// still change it later in Settings). "Skip for now" stamps publicIdentifierPromptedAt so this shows
// only once.
export default function PublicIdentifierPromptScreen() {
  const { t } = useTranslation()
  const setPublicIdentifier = useMutation(api.users.setPublicIdentifier)
  const dismiss = useMutation(api.users.dismissPublicIdentifierPrompt)
  const [profileUrl, setProfileUrl] = useState('')
  const [working, setWorking] = useState(false)
  const vanity = extractVanityName(profileUrl)

  async function save() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token || !vanity) return
    setWorking(true)
    try {
      await setPublicIdentifier({ sessionToken: token, publicIdentifier: vanity })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  async function skip() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await dismiss({ sessionToken: token })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">
          {t('onboarding.linkedinIdentifier.title')}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('onboarding.linkedinIdentifier.intro')}</p>
        <Input
          type="url"
          inputMode="url"
          value={profileUrl}
          onChange={e => setProfileUrl(e.target.value)}
          placeholder={t('onboarding.linkedinIdentifier.placeholder')}
          className="mt-4"
        />
        {profileUrl && !vanity && (
          <p className="text-destructive mb-0 mt-[6px] text-xs">{t('onboarding.linkedinIdentifier.invalid')}</p>
        )}
        {vanity && (
          <p className="text-muted-foreground mb-0 mt-[6px] text-xs">
            {t('onboarding.linkedinIdentifier.willSaveAs', { vanity })}
          </p>
        )}
        <Button
          type="button"
          onClick={save}
          disabled={!vanity || working}
          className="mt-5 w-full"
        >
          {working ? '…' : t('onboarding.linkedinIdentifier.save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={skip}
          disabled={working}
          className="mt-3 w-full"
        >
          {t('onboarding.linkedinIdentifier.skip')}
        </Button>
      </div>
    </div>
  )
}
