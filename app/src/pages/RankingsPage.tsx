import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { EyeOff } from 'lucide-react'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import WindowToggle from '@/components/WindowToggle'
import RankingList from '@/components/RankingList'
import NextUpdate from '@/components/NextUpdate'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { floorToHour } from '../../../convex/lib/recap'

type Window = '7d' | '30d'
const WINDOWS: ReadonlyArray<Window> = ['7d', '30d']

export default function RankingsPage() {
  const { t } = useTranslation()
  const [window, setWindow] = useState<Window>('7d')
  // Floored to the hour so the query args are stable across renders (one Convex subscription per window).
  const [now] = useState(() => floorToHour(Date.now()))
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined

  const rankings = useQuery(api.rankings.getSiteRankings, sessionToken ? { sessionToken, window } : 'skip')
  const mine = useQuery(api.rankings.getMyRankings, sessionToken ? { sessionToken, window, now } : 'skip')
  const setLeaderboardOptOut = useMutation(api.users.setLeaderboardOptOut)
  const me = rankings?.me ?? null
  const [optOutSaving, setOptOutSaving] = useState(false)

  async function handleOptOut() {
    if (!sessionToken || me === null) return
    setOptOutSaving(true)
    try {
      await setLeaderboardOptOut({ sessionToken, optOut: !me.optedOut })
    } catch {
      toast(t('rankings.updateFailed'))
    } finally {
      setOptOutSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-6">
      <PageHeader
        title={t('rankings.title')}
        lead={t('rankings.lead')}
      >
        <WindowToggle
          value={window}
          onChange={setWindow}
          options={WINDOWS}
        />
      </PageHeader>
      {rankings === undefined ? (
        <p className="text-muted-foreground text-sm">…</p>
      ) : (
        <>
          <section>
            <h2 className="text-foreground text-base font-semibold">{t('rankings.you')}</h2>
            {mine === undefined ? (
              <p className="text-muted-foreground text-sm">…</p>
            ) : (
              <>
                <RankingList
                  titleKey="rankings.toYou"
                  variant="personal"
                  titleTo="/people?tab=received"
                  rows={mine.received.slice(0, 5).map(row => ({
                    userId: row.userId,
                    name: row.name,
                    headline: row.headline,
                    profilePictureUrl: row.profilePictureUrl,
                    count: row.total,
                    lastAt: row.lastAt,
                    postsCount: row.postsCount
                  }))}
                />
                <RankingList
                  titleKey="rankings.byYou"
                  variant="personal"
                  titleTo="/people?tab=made"
                  rows={mine.made.slice(0, 5).map(row => ({
                    userId: row.userId,
                    name: row.name,
                    headline: row.headline,
                    profilePictureUrl: row.profilePictureUrl,
                    count: row.total,
                    lastAt: row.lastAt,
                    postsCount: row.postsCount
                  }))}
                />
                {mine.truncated && <p className="text-muted-foreground mt-2 text-sm">{t('people.truncated')}</p>}
              </>
            )}
          </section>
          <section className="mt-8">
            <h2 className="text-foreground text-base font-semibold">{t('rankings.site')}</h2>
            {rankings.generatedAt === null ? (
              <p className="text-muted-foreground text-sm">{t('rankings.empty')}</p>
            ) : (
              <>
                <p className="text-muted-foreground mt-2 mb-0 text-sm">
                  {t('rankings.boardCaption', { window: t(`recap.window.${window}`) })}
                </p>
                <NextUpdate />
                {rankings.partial && <p className="text-muted-foreground mt-2 mb-0 text-sm">{t('rankings.partial')}</p>}
                <RankingList
                  titleKey="rankings.topPosters"
                  variant="posts"
                  rows={rankings.posters}
                  meId={me?.id}
                />
                <RankingList
                  titleKey="rankings.topInteractors"
                  variant="interactors"
                  rows={rankings.interactors}
                  meId={me?.id}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {me === null || me.count === 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-muted-foreground m-0 text-sm">{t('rankings.emptyFresh')}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link to="/feed">{t('people.goToFeed')}</Link>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {me.position !== null
                        ? t('rankings.yourPosition', { position: me.position })
                        : t('rankings.noPosition')}
                      {me.position !== null && me.movement !== null && (
                        <>
                          {' '}
                          {me.movement > 0
                            ? t('rankings.movementUp', { count: me.movement })
                            : me.movement < 0
                              ? t('rankings.movementDown', { count: -me.movement })
                              : t('rankings.movementSame')}
                        </>
                      )}
                    </p>
                  )}
                  {me !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full cursor-pointer sm:w-auto"
                      disabled={optOutSaving}
                      onClick={handleOptOut}
                    >
                      <EyeOff aria-hidden="true" />
                      {me.optedOut ? t('rankings.optIn') : t('rankings.optOut')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
