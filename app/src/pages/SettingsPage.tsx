import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'
import { COUNTRY_CODES, countryLabel, INDUSTRIES } from '../../../convex/lib/profileOptions'
import { VirtualizedCombobox } from '@/components/VirtualizedCombobox'
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const updateProfile = useMutation(api.users.updateProfile)
  const refreshProfile = useMutation(api.users.refreshProfileFromLinkedIn)
  const refreshEnabled = useQuery(api.users.isProfileRefreshEnabled, sessionToken ? { sessionToken } : 'skip')
  const setCommentLanguage = useMutation(api.users.setCommentLanguage)

  const [industry, setIndustry] = useState<string>('')
  const [country, setCountry] = useState<string>('')
  const [industryDirty, setIndustryDirty] = useState(false)
  const [countryDirty, setCountryDirty] = useState(false)
  const [headline, setHeadline] = useState<string>('')
  const [headlineDirty, setHeadlineDirty] = useState(false)
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
  const meHeadline = me?.headline
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value into editable state until the user edits the field
    if (!headlineDirty) setHeadline(meHeadline ?? '')
  }, [meHeadline, headlineDirty])
  const meCommentLanguage = me?.commentLanguage
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value until the user picks a language
    if (!commentLangDirty) setCommentLang(resolveCommentLanguage(meCommentLanguage))
  }, [meCommentLanguage, commentLangDirty])

  if (!me) {
    return <LoadingSpinner />
  }

  const isPro = me.tier === 'pro' || me.tier === 'contact'

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
      await updateProfile({ sessionToken, industry, country, headline })
      // Saved values are now the server truth — resume mirroring the reactive `me`.
      setIndustryDirty(false)
      setCountryDirty(false)
      setHeadlineDirty(false)
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

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 font-sans">
      <PageHeader title={t('settings.title')} />

      <section className="border-border bg-card mb-4 rounded-xl border p-5">
        <h2 className="text-foreground mt-0 mb-3 text-base font-semibold">{t('settings.profile')}</h2>

        <div className="text-foreground mb-1 text-sm font-medium">{t('settings.industry')}</div>
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

        <div className="text-foreground mb-1 text-sm font-medium">{t('settings.country')}</div>
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

        <div className="text-foreground mb-1 text-sm font-medium">{t('settings.headline')}</div>
        <div className="mb-1">
          <Input
            type="text"
            maxLength={220}
            value={headline}
            onChange={e => {
              setHeadline(e.target.value)
              setHeadlineDirty(true)
            }}
            placeholder={t('settings.headlinePlaceholder')}
            aria-label={t('settings.headline')}
          />
        </div>
        <p className="text-muted-foreground mt-0 mb-3 text-xs">{t('settings.headlineHint')}</p>

        {me.location && (
          <p className="text-muted-foreground my-1 text-sm">
            {t('settings.location')}: <span className="text-foreground">{me.location}</span>
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className={profileSaved ? 'bg-success text-success-foreground' : undefined}
          >
            {profileSaved ? t('settings.saved') : profileSaving ? t('settings.saving') : t('settings.save')}
          </Button>
          {refreshEnabled && (
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing || !me.linkedinPublicIdentifier}
            >
              {refreshing ? t('settings.refreshing') : t('settings.refresh')}
            </Button>
          )}
        </div>
        {refreshError && <p className="text-destructive mt-2 mb-0 text-xs">{refreshError}</p>}
        <p className="text-muted-foreground mt-2 mb-0 text-xs">{t('settings.profileNote')}</p>
      </section>

      <section className="border-border bg-card mb-4 rounded-xl border p-5">
        <h2 className="text-foreground mt-0 mb-1 text-base font-semibold">{t('settings.aiComments')}</h2>
        <p className="text-muted-foreground mt-0 mb-3 text-[13px]">{t('settings.aiCommentsNote')}</p>
        <div className="text-foreground mb-1 text-sm font-medium">{t('settings.commentLanguage')}</div>
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
          <Button
            onClick={handleSaveCommentLanguage}
            disabled={commentLangSaving}
            className={commentLangSaved ? 'bg-success text-success-foreground' : undefined}
          >
            {commentLangSaved ? t('settings.saved') : commentLangSaving ? t('settings.saving') : t('settings.save')}
          </Button>
        </div>
      </section>

      {isPro ? (
        <section className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-foreground mt-0 mb-2 text-base font-semibold">{t('settings.visibility')}</h2>
          <p className="text-muted-foreground mb-3 text-sm">{t('settings.visibilityNote')}</p>
          <p className="text-[13px] text-gold-text">{t('settings.visibilityComingSoon')}</p>
        </section>
      ) : (
        <section className="border-border bg-accent rounded-xl border p-5">
          <p className="text-accent-foreground m-0 text-sm">{t('settings.upgradePrompt')}</p>
        </section>
      )}
    </div>
  )
}
