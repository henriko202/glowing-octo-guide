import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'
import { COUNTRY_CODES, countryLabel, INDUSTRIES } from '../../../convex/lib/profileOptions'
import { type ComboboxOption, VirtualizedCombobox } from '@/components/VirtualizedCombobox'
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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
  // Pro/Contact-only defaults copied onto every future post (backlog/B06). See users.setPostVisibility.
  defaultVisibilityIndustries?: string[]
  defaultVisibilityCountries?: string[]
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
  trialEndsAt?: number
  linkedinPublicIdentifier?: string
  createdAt: number
}

/**
 * One "chip picker" field: removable chips for the currently-selected values, plus a searchable
 * combobox (already-selected options excluded) to add more. Shared by the visibility-industries
 * and visibility-countries fields below — same interaction, different option list.
 */
function VisibilityChipField({
  field,
  options,
  selected,
  onAdd,
  onRemove
}: {
  field: 'industries' | 'countries'
  options: ComboboxOption[]
  selected: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
}) {
  const { t } = useTranslation()
  const labelFor = (value: string) => options.find(o => o.value === value)?.label ?? value
  const available = options.filter(o => !selected.includes(o.value))
  const ariaLabel = field === 'industries' ? t('settings.visibilityIndustries') : t('settings.visibilityCountries')
  const addPlaceholder =
    field === 'industries' ? t('settings.visibilityAddIndustry') : t('settings.visibilityAddCountry')

  return (
    <div className="mb-3">
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map(value => (
            <Badge
              key={value}
              variant="outline"
              className="gap-1 py-1 pr-1 pl-2 text-xs font-normal"
            >
              {labelFor(value)}
              <button
                type="button"
                onClick={() => onRemove(value)}
                aria-label={t('settings.visibilityRemove', { label: labelFor(value) })}
                className="hover:bg-muted focus-visible:ring-ring -mr-0.5 rounded-full p-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <VirtualizedCombobox
        options={available}
        value=""
        onChange={onAdd}
        ariaLabel={ariaLabel}
        placeholder={addPlaceholder}
        searchPlaceholder={t('settings.selectPlaceholder')}
        emptyText={t('settings.noResults')}
      />
    </div>
  )
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken }) as MeProfile | null | undefined
  const updateProfile = useMutation(api.users.updateProfile)
  const refreshProfile = useMutation(api.users.refreshProfileFromLinkedIn)
  const refreshEnabled = useQuery(api.users.isProfileRefreshEnabled, sessionToken ? { sessionToken } : 'skip')
  const setCommentLanguage = useMutation(api.users.setCommentLanguage)
  const setPostVisibility = useMutation(api.users.setPostVisibility)

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
  const [visIndustries, setVisIndustries] = useState<string[]>([])
  const [visCountries, setVisCountries] = useState<string[]>([])
  const [visIndustriesDirty, setVisIndustriesDirty] = useState(false)
  const [visCountriesDirty, setVisCountriesDirty] = useState(false)
  const [visSaving, setVisSaving] = useState(false)
  const [visSaved, setVisSaved] = useState(false)

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
  const meVisIndustries = me?.defaultVisibilityIndustries
  const meVisCountries = me?.defaultVisibilityCountries
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value into editable state until the user edits the field
    if (!visIndustriesDirty) setVisIndustries(meVisIndustries ?? [])
  }, [meVisIndustries, visIndustriesDirty])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value into editable state until the user edits the field
    if (!visCountriesDirty) setVisCountries(meVisCountries ?? [])
  }, [meVisCountries, visCountriesDirty])

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

  function addVisIndustry(code: string) {
    if (!code || visIndustries.includes(code)) return
    setVisIndustries(prev => [...prev, code])
    setVisIndustriesDirty(true)
  }
  function removeVisIndustry(code: string) {
    setVisIndustries(prev => prev.filter(c => c !== code))
    setVisIndustriesDirty(true)
  }
  function addVisCountry(code: string) {
    if (!code || visCountries.includes(code)) return
    setVisCountries(prev => [...prev, code])
    setVisCountriesDirty(true)
  }
  function removeVisCountry(code: string) {
    setVisCountries(prev => prev.filter(c => c !== code))
    setVisCountriesDirty(true)
  }

  async function handleSaveVisibility() {
    if (!sessionToken) return
    setVisSaving(true)
    try {
      await setPostVisibility({ sessionToken, industries: visIndustries, countries: visCountries })
      setVisIndustriesDirty(false)
      setVisCountriesDirty(false)
      setVisSaved(true)
      setTimeout(() => setVisSaved(false), 3000)
    } finally {
      setVisSaving(false)
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

          <div className="text-foreground mb-1 text-sm font-medium">{t('settings.visibilityIndustries')}</div>
          <VisibilityChipField
            field="industries"
            options={industryOptions}
            selected={visIndustries}
            onAdd={addVisIndustry}
            onRemove={removeVisIndustry}
          />

          <div className="text-foreground mb-1 text-sm font-medium">{t('settings.visibilityCountries')}</div>
          <VisibilityChipField
            field="countries"
            options={countryOptions}
            selected={visCountries}
            onAdd={addVisCountry}
            onRemove={removeVisCountry}
          />

          <div className="mt-3">
            <Button
              onClick={handleSaveVisibility}
              disabled={visSaving}
              className={visSaved ? 'bg-success text-success-foreground' : undefined}
            >
              {visSaved ? t('settings.saved') : visSaving ? t('settings.saving') : t('settings.save')}
            </Button>
          </div>
        </section>
      ) : (
        <section className="border-border bg-accent rounded-xl border p-5">
          <p className="text-accent-foreground m-0 text-sm">{t('settings.upgradePrompt')}</p>
        </section>
      )}
    </div>
  )
}
