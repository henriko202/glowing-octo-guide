import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../convex'

type EmailPreferencesValue = { digestEmailsEnabled: boolean; leaderboardOptOut: boolean } | null | undefined

export default function EmailPreferences() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const prefs = useQuery(
    api.users.getEmailPreferences,
    sessionToken ? { sessionToken } : 'skip'
  ) as EmailPreferencesValue
  const setDigestEmailsEnabled = useMutation(api.users.setDigestEmailsEnabled)
  const setLeaderboardOptOut = useMutation(api.users.setLeaderboardOptOut)
  // Optimistic checked values: the box follows the click during the roundtrip instead of snapping back to the
  // server value; null means "use the server value", which is also the revert state after a rejection.
  const [digestOptimistic, setDigestOptimistic] = useState<boolean | null>(null)
  const [rankingsOptimistic, setRankingsOptimistic] = useState<boolean | null>(null)
  const [digestSaving, setDigestSaving] = useState(false)
  const [digestError, setDigestError] = useState<string | null>(null)
  const [rankingsSaving, setRankingsSaving] = useState(false)
  const [rankingsError, setRankingsError] = useState<string | null>(null)
  const digestChecked = digestOptimistic ?? prefs?.digestEmailsEnabled === true
  const rankingsChecked = rankingsOptimistic ?? prefs?.leaderboardOptOut === false

  async function saveDigest(enabled: boolean) {
    if (!sessionToken || digestSaving) return
    setDigestOptimistic(enabled)
    setDigestError(null)
    setDigestSaving(true)
    try {
      await setDigestEmailsEnabled({ sessionToken, enabled })
    } catch {
      setDigestOptimistic(null)
      setDigestError(t('settings.emails.saveFailed'))
    } finally {
      setDigestSaving(false)
    }
  }

  async function saveRankings(visible: boolean) {
    if (!sessionToken || rankingsSaving) return
    setRankingsOptimistic(visible)
    setRankingsError(null)
    setRankingsSaving(true)
    try {
      await setLeaderboardOptOut({ sessionToken, optOut: !visible })
    } catch {
      setRankingsOptimistic(null)
      setRankingsError(t('settings.emails.saveFailed'))
    } finally {
      setRankingsSaving(false)
    }
  }

  return (
    <section className="border-border bg-card mb-4 rounded-xl border p-5">
      <h2 className="text-foreground mt-0 mb-1 text-base font-semibold">{t('settings.emails.title')}</h2>
      <p className="text-muted-foreground mt-0 mb-3 text-[13px]">{t('settings.emails.note')}</p>

      <label className="text-foreground mb-2 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          aria-label={t('settings.emails.digest')}
          checked={digestChecked}
          disabled={!prefs || digestSaving}
          onChange={e => void saveDigest(e.target.checked)}
          className="h-4 w-4"
        />
        <span>{t('settings.emails.digest')}</span>
      </label>
      <p className="text-muted-foreground mt-0 mb-3 text-xs">{t('settings.emails.digestNote')}</p>
      {digestError && <p className="text-destructive mt-0 mb-3 text-xs">{digestError}</p>}

      <label className="text-foreground mb-2 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          aria-label={t('settings.emails.rankings')}
          checked={rankingsChecked}
          disabled={!prefs || rankingsSaving}
          onChange={e => void saveRankings(e.target.checked)}
          className="h-4 w-4"
        />
        <span>{t('settings.emails.rankings')}</span>
      </label>
      <p className="text-muted-foreground mt-0 mb-3 text-xs">{t('settings.emails.rankingsNote')}</p>
      {rankingsError && <p className="text-destructive mt-0 mb-3 text-xs">{rankingsError}</p>}

      <Link
        to="/privacy-data"
        className="text-primary text-sm hover:underline"
      >
        {t('settings.emails.consentsLink')}
      </Link>
    </section>
  )
}
