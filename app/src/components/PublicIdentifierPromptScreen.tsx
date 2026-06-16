import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { extractVanityName } from '../lib/linkedinProfile'

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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="text-lg font-bold text-slate-900">{t('onboarding.linkedinIdentifier.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('onboarding.linkedinIdentifier.intro')}</p>
        <input
          type="text"
          value={profileUrl}
          onChange={e => setProfileUrl(e.target.value)}
          placeholder={t('onboarding.linkedinIdentifier.placeholder')}
          className="mt-4 w-full rounded-md border border-slate-300 px-[10px] py-[7px] text-[13px] outline-none"
        />
        {profileUrl && !vanity && (
          <p className="mb-0 mt-[6px] text-xs text-red-500">{t('onboarding.linkedinIdentifier.invalid')}</p>
        )}
        {vanity && (
          <p className="mb-0 mt-[6px] text-xs text-slate-500">
            {t('onboarding.linkedinIdentifier.willSaveAs', { vanity })}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!vanity || working}
          className="mt-5 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working ? '…' : t('onboarding.linkedinIdentifier.save')}
        </button>
        <button
          type="button"
          onClick={skip}
          disabled={working}
          className="mt-3 w-full cursor-pointer border-none bg-transparent text-center text-xs font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-60"
        >
          {t('onboarding.linkedinIdentifier.skip')}
        </button>
      </div>
    </div>
  )
}
