import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'

/** Safe user profile as returned by the getMe query (no token fields) */
interface MeProfile {
  _id: string
  linkedinId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  industry?: string
  country?: string
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
  trialEndsAt?: number
  stripeCustomerId?: string
  linkedinPublicIdentifier?: string
  createdAt: number
}

/** Extract LinkedIn vanityName from a profile URL or bare username */
function extractVanityName(input: string): string | null {
  const trimmed = input.trim()
  try {
    const u = new URL(trimmed)
    const m = u.pathname.match(/^\/in\/([^/?#]+)/)
    return m ? m[1].toLowerCase() : null
  } catch {
    // Also accept bare vanityNames like "henriko202" or "@henriko202"
    const bare = trimmed.replace(/^@/, '')
    return /^[a-zA-Z0-9-]+$/.test(bare) ? bare.toLowerCase() : null
  }
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken }) as MeProfile | null | undefined
  const setPublicIdentifier = useMutation(api.users.setPublicIdentifier)

  const [profileUrl, setProfileUrl] = useState('')
  const [identifierSaving, setIdentifierSaving] = useState(false)
  const [identifierSaved, setIdentifierSaved] = useState(false)

  if (!me) {
    return <LoadingSpinner />
  }

  const isPro = me.tier === 'pro' || me.tier === 'contact'
  const extractedVanity = extractVanityName(profileUrl)

  async function handleSaveIdentifier() {
    if (!sessionToken || !extractedVanity) return
    setIdentifierSaving(true)
    try {
      await setPublicIdentifier({ sessionToken, publicIdentifier: extractedVanity })
      setProfileUrl('')
      setIdentifierSaved(true)
      setTimeout(() => setIdentifierSaved(false), 3000)
    } finally {
      setIdentifierSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 font-sans">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t('settings.title')}</h1>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 mt-0 text-base font-semibold text-slate-900">{t('settings.profile')}</h2>
        <p className="my-1 text-sm text-slate-500">
          {t('settings.industry')}: {me.industry ?? t('settings.notSet')}
        </p>
        <p className="my-1 text-sm text-slate-500">
          {t('settings.country')}: {me.country ?? t('settings.notSet')}
        </p>
        <p className="mb-0 mt-2 text-xs text-slate-400">{t('settings.profileNote')}</p>
      </section>

      {/* LinkedIn identity — required for post ownership verification */}
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 mt-0 text-base font-semibold text-slate-900">LinkedIn Identity</h2>
        <p className="mb-3 mt-0 text-[13px] text-slate-500">
          {me.linkedinPublicIdentifier ? (
            <>
              Verified as{' '}
              <a
                href={`https://www.linkedin.com/in/${me.linkedinPublicIdentifier}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-500 no-underline"
              >
                {me.linkedinPublicIdentifier}
              </a>
              . Update below if your profile URL changes.
            </>
          ) : (
            'Set your LinkedIn profile URL so we can verify that submitted posts belong to your account.'
          )}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={profileUrl}
            onChange={e => setProfileUrl(e.target.value)}
            placeholder={
              me.linkedinPublicIdentifier
                ? `https://www.linkedin.com/in/${me.linkedinPublicIdentifier}`
                : 'https://www.linkedin.com/in/your-name'
            }
            className="flex-1 rounded-md border border-slate-300 px-[10px] py-[7px] text-[13px] outline-none"
          />
          <button
            onClick={handleSaveIdentifier}
            disabled={!extractedVanity || identifierSaving}
            className={`whitespace-nowrap rounded-md border-none px-4 py-[7px] text-[13px] text-white transition-colors duration-200 ${identifierSaved ? 'bg-green-500' : 'bg-blue-500'} ${!extractedVanity || identifierSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
          >
            {identifierSaved ? 'Saved ✓' : identifierSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {profileUrl && !extractedVanity && (
          <p className="mb-0 mt-[6px] text-xs text-red-500">
            Couldn't extract a username from that URL. Try: https://www.linkedin.com/in/your-name
          </p>
        )}
        {extractedVanity && (
          <p className="mb-0 mt-[6px] text-xs text-slate-500">
            Will save as: <strong>{extractedVanity}</strong>
          </p>
        )}
      </section>

      {isPro ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 mt-0 text-base font-semibold text-slate-900">{t('settings.visibility')}</h2>
          <p className="mb-3 text-sm text-slate-500">{t('settings.visibilityNote')}</p>
          <p className="text-[13px] text-blue-500">{t('settings.visibilityComingSoon')}</p>
        </section>
      ) : (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="m-0 text-sm text-blue-700">{t('settings.upgradePrompt')}</p>
        </section>
      )}
    </div>
  )
}
