import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import WindowToggle from '@/components/WindowToggle'
import PeopleAccordion, { ReactionGlyph } from '@/components/PeopleAccordion'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/relativeDay'
import { floorToHour } from '../../../convex/lib/recap'
import type { Reaction } from '../../../convex/lib/reactions'

type Tab = 'received' | 'made'
const TABS: ReadonlyArray<Tab> = ['received', 'made']
const WINDOWS: ReadonlyArray<'7d' | '30d'> = ['7d', '30d']

interface PersonRowData {
  name: string
  headline?: string
  profilePictureUrl?: string
  reaction?: Reaction
  total: number
  lastAt?: number
  postsCount?: number
}

function PersonRow({ person }: { person: PersonRowData }) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar
        name={person.name}
        src={person.profilePictureUrl}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm">{person.name}</span>
        {person.headline && <span className="text-muted-foreground block truncate text-xs">{person.headline}</span>}
      </span>
      {person.reaction && <ReactionGlyph reaction={person.reaction} />}
      <span className="text-muted-foreground shrink-0 text-xs">
        {t('people.count', { count: person.total })} · {t('people.postsCount', { count: person.postsCount ?? 0 })}
      </span>
      {person.lastAt !== undefined && (
        <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(person.lastAt, t)}</span>
      )}
    </li>
  )
}

// PeoplePage is R22's home for the two raw-note items: who interacted with you (accordion by post) and who you
// interacted with. Personal windows are 7d/30d like Recap.
export default function PeoplePage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const param = searchParams.get('tab')
    return TABS.includes(param as Tab) ? (param as Tab) : 'received'
  })
  const [window, setWindow] = useState<'7d' | '30d'>('7d')
  // Floored to the hour so the query args are stable across renders (one Convex subscription per window).
  const [now] = useState(() => floorToHour(Date.now()))
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined

  const byPost = useQuery(
    api.interactions.listInteractionsByPost,
    tab === 'received' && sessionToken ? { sessionToken, window, now } : 'skip'
  )
  const receivedEmpty = byPost !== undefined && byPost.posts.length === 0
  const made = useQuery(
    api.interactions.listPeopleIInteractedWith,
    sessionToken && (tab === 'made' || receivedEmpty) ? { sessionToken, window, now } : 'skip'
  )

  return (
    <div className="mx-auto max-w-[720px] px-4">
      <PageHeader
        title={t('people.title')}
        lead={t('people.lead')}
      >
        <WindowToggle
          value={window}
          onChange={setWindow}
          options={WINDOWS}
        />
      </PageHeader>
      <div
        role="tablist"
        className="mt-4 flex gap-1 rounded-full border p-1 text-sm"
      >
        {TABS.map(value => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'bg-primary text-primary-foreground min-h-10 flex-1 rounded-full'
                : 'text-muted-foreground min-h-10 flex-1 rounded-full'
            }
          >
            {t(`people.tabs.${value}`)}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === 'received' && (
          <>
            {byPost === undefined ? (
              <p className="text-muted-foreground text-sm">…</p>
            ) : byPost.posts.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm">{t('people.emptyReceived')}</p>
                {made !== undefined && made.total < 3 && (
                  <div className="mt-3 flex flex-col items-start gap-3">
                    <p className="text-muted-foreground m-0 text-sm">
                      {t('people.graphStarter', { made: made.total })}
                    </p>
                    <Button asChild>
                      <Link to="/feed">{t('people.goToFeed')}</Link>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <PeopleAccordion posts={byPost.posts} />
                {byPost.truncated && <p className="text-muted-foreground mt-2 text-sm">{t('people.truncated')}</p>}
              </>
            )}
          </>
        )}
        {tab === 'made' && (
          <>
            {made === undefined ? (
              <p className="text-muted-foreground text-sm">…</p>
            ) : made.people.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('people.emptyMade')}</p>
            ) : (
              <>
                <ul className="m-0 flex list-none flex-col p-0">
                  {made.people.map(entry => (
                    <PersonRow
                      key={entry.userId}
                      person={entry}
                    />
                  ))}
                </ul>
                {made.truncated && <p className="text-muted-foreground mt-2 text-sm">{t('people.truncated')}</p>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
