import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'
import { COUNTRY_CODES, INDUSTRIES, countryLabel } from '../../../convex/lib/profileOptions'
import { VirtualizedCombobox } from '../components/VirtualizedCombobox'
import { extractVanityName } from '../lib/linkedinProfile'
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'

/** Safe user profile as returned by the getMe query (no token fields) */
interface MeProfile {
  _id: string
  linkedinId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  industry?: string
  country?: string
  location?: string
  primaryLocale?: string
  commentLanguage?: string
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
  trialEndsAt?: number
  linkedinPublicIdentifier?: string
  createdAt: number
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken }) as MeProfile | null | undefined
  const setPublicIdentifier = useMutation(api.users.setPublicIdentifier)
  const updateProfile = useMutation(api.users.updateProfile)
  const refreshProfile = useMutation(api.users.refreshProfileFromLinkedIn)
  const setCommentLanguage = useMutation(api.users.setCommentLanguage)

  const [profileUrl, setProfileUrl] = useState('')
  const [identifierSaving, setIdentifierSaving] = useState(false)
  const [identifierSaved, setIdentifierSaved] = useState(false)
  const [industry, setIndustry] = useState<string>('')
  const [country, setCountry] = useState<string>('')
  const [industryDirty, setIndustryDirty] = useState(false)
  const [countryDirty, setCountryDirty] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [commentLang, setCommentLang] = useState<string>(AUTO_LANGUAGE)
  const [commentLangDirty, setCommentLangDirty] = useState(false)
  const [commentLangSaving, setCommentLangSaving] = useState(false)
  const [commentLangSaved, setCommentLangSaved] = useState(false)

  // Mirror the server value for each field so a backend scrape that fills country/industry shows up
  // live — but stop mirroring a field once the user edits it (their unsaved edit wins until save).
  const meIndustry = me?.industry
  const meCountry = me?.country
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value into editable state until the user edits the field
    if (!industryDirty) setIndustry(meIndustry ?? '')
  }, [meIndustry, industryDirty])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value into editable state until the user edits the field
    if (!countryDirty) setCountry(meCountry ?? '')
  }, [meCountry, countryDirty])
  const meCommentLanguage = me?.commentLanguage
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value until the user picks a language
    if (!commentLangDirty) setCommentLang(resolveCommentLanguage(meCommentLanguage))
  }, [meCommentLanguage, commentLangDirty])

  if (!me) {
    return <LoadingSpinner />
  }

  const isPro = me.tier === 'pro' || me.tier === 'contact'
  const extractedVanity = extractVanityName(profileUrl)

  const lang = i18n.language?.split('-')[0] ?? 'en'
  const industryOptions = INDUSTRIES.map(i => ({ value: i.code, label: i.label }))
  const countryOptions = COUNTRY_CODES.map(code => ({ value: code, label: countryLabel(code, lang) })).sort((a, b) =>
    a.label.localeCompare(b.label)
  )
  const commentLangOptions = [
    { value: AUTO_LANGUAGE, label: t('comment.languageAuto') },
    ...LANGUAGE_CODES.map(code => ({ value: code, label: languageLabel(code, lang) })).sort((a, b) =>
      a.label.localeCompare(b.label)
    )
  ]

  async function handleSaveProfile() {
    if (!sessionToken) return
    setProfileSaving(true)
    try {
      await updateProfile({ sessionToken, industry, country })
      // Saved values are now the server truth — resume mirroring the reactive `me`.
      setIndustryDirty(false)
      setCountryDirty(false)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleSaveCommentLanguage() {
    if (!sessionToken) return
    setCommentLangSaving(true)
    try {
      await setCommentLanguage({ sessionToken, commentLanguage: commentLang })
      setCommentLangDirty(false)
      setCommentLangSaved(true)
      setTimeout(() => setCommentLangSaved(false), 3000)
    } finally {
      setCommentLangSaving(false)
    }
  }

  async function handleRefresh() {
    if (!sessionToken) return
    setRefreshing(true)
    setRefreshError(null)
    try {
      await refreshProfile({ sessionToken })
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

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

        <div className="mb-1 text-sm font-medium text-slate-700">{t('settings.industry')}</div>
        <div className="mb-3">
          <VirtualizedCombobox
            options={industryOptions}
            value={industry}
            onChange={value => {
              setIndustry(value)
              setIndustryDirty(true)
            }}
            ariaLabel={t('settings.industry')}
            placeholder={t('settings.notSet')}
            searchPlaceholder={t('settings.selectPlaceholder')}
            emptyText={t('settings.noResults')}
          />
        </div>

        <div className="mb-1 text-sm font-medium text-slate-700">{t('settings.country')}</div>
        <div className="mb-3">
          <VirtualizedCombobox
            options={countryOptions}
            value={country}
            onChange={value => {
              setCountry(value)
              setCountryDirty(true)
            }}
            ariaLabel={t('settings.country')}
            placeholder={t('settings.notSet')}
            searchPlaceholder={t('settings.selectPlaceholder')}
            emptyText={t('settings.noResults')}
          />
        </div>

        {me.location && (
          <p className="my-1 text-sm text-slate-500">
            {t('settings.location')}: <span className="text-slate-700">{me.location}</span>
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className={`rounded-md border-none px-4 py-[7px] text-[13px] text-white transition-colors duration-200 ${profileSaved ? 'bg-green-500' : 'bg-blue-500'} ${profileSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
          >
            {profileSaved ? t('settings.saved') : profileSaving ? t('settings.saving') : t('settings.save')}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing || !me.linkedinPublicIdentifier}
            className={`rounded-md border border-slate-300 bg-white px-4 py-[7px] text-[13px] text-slate-700 ${refreshing || !me.linkedinPublicIdentifier ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            {refreshing ? t('settings.refreshing') : t('settings.refresh')}
          </button>
        </div>
        {refreshError && <p className="mb-0 mt-2 text-xs text-red-500">{refreshError}</p>}
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

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 mt-0 text-base font-semibold text-slate-900">{t('settings.aiComments')}</h2>
        <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('settings.aiCommentsNote')}</p>
        <div className="mb-1 text-sm font-medium text-slate-700">{t('settings.commentLanguage')}</div>
        <VirtualizedCombobox
          options={commentLangOptions}
          value={commentLang}
          onChange={value => {
            setCommentLang(value === '' ? AUTO_LANGUAGE : value)
            setCommentLangDirty(true)
          }}
          ariaLabel={t('settings.commentLanguage')}
          placeholder={t('comment.languageAuto')}
        />
        <div className="mt-3">
          <button
            onClick={handleSaveCommentLanguage}
            disabled={commentLangSaving}
            className={`rounded-md border-none px-4 py-[7px] text-[13px] text-white transition-colors duration-200 ${commentLangSaved ? 'bg-green-500' : 'bg-blue-500'} ${commentLangSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            {commentLangSaved ? t('settings.saved') : commentLangSaving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
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
