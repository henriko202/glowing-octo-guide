import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import WindowToggle from '@/components/WindowToggle'
import PeopleAccordion from '@/components/PeopleAccordion'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { timeAgo } from '@/lib/relativeDay'
import { floorToHour } from '../../../convex/lib/recap'

type Tab = 'received' | 'made' | 'all'
const TABS: ReadonlyArray<Tab> = ['received', 'made', 'all']
const WINDOWS: ReadonlyArray<'7d' | '30d'> = ['7d', '30d']
const DIRECTORY_PAGE = 50
const SEARCH_DEBOUNCE_MS = 300
const MIN_SEARCH_LENGTH = 2

interface PersonRowData {
  name: string
  headline?: string
  profilePictureUrl?: string
  total?: number
  lastAt?: number
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
      {person.total !== undefined && (
        <span className="text-muted-foreground shrink-0 text-xs">{t('people.count', { count: person.total })}</span>
      )}
      {person.lastAt !== undefined && (
        <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(person.lastAt, t)}</span>
      )}
    </li>
  )
}

function DirectoryList() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])
  const searching = debouncedQuery.length >= MIN_SEARCH_LENGTH
  // Same api.search.search the command palette uses; below the minimum length the paginated directory is the
  // source, so an almost-empty box never fires a query.
  const searchResults = useQuery(
    api.search.search,
    sessionToken && searching ? { sessionToken, queryText: debouncedQuery } : 'skip'
  )
  const { results, status, loadMore } = usePaginatedQuery(
    api.users.listMembers,
    sessionToken && !searching ? { sessionToken } : 'skip',
    { initialNumItems: DIRECTORY_PAGE }
  )
  // The backend pages in creation order, so each loaded page is sorted alphabetically here.
  const sorted = [...results].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <>
      <Input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        aria-label={t('people.searchLabel')}
        placeholder={t('people.searchPlaceholder')}
      />
      <div className="mt-4">
        {searching ? (
          searchResults === undefined ? (
            <p className="text-muted-foreground text-sm">…</p>
          ) : searchResults.people.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('people.emptySearch')}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {searchResults.people.map(person => (
                <PersonRow
                  key={person._id}
                  person={person}
                />
              ))}
            </ul>
          )
        ) : status === 'LoadingFirstPage' ? (
          <p className="text-muted-foreground text-sm">…</p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('people.emptyAll')}</p>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col p-0">
              {sorted.map(person => (
                <PersonRow
                  key={person._id}
                  person={person}
                />
              ))}
            </ul>
            {status === 'CanLoadMore' && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => loadMore(DIRECTORY_PAGE)}
                >
                  {t('feed.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// PeoplePage is R22's home for the three raw-note items: who interacted with you (accordion by post), who you
// interacted with, and the members directory. Personal windows are 7d/30d like Recap; the directory is unfiltered.
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

  const made = useQuery(
    api.interactions.listPeopleIInteractedWith,
    tab === 'made' && sessionToken ? { sessionToken, window, now } : 'skip'
  )
  const byPost = useQuery(
    api.interactions.listInteractionsByPost,
    tab === 'received' && sessionToken ? { sessionToken, window, now } : 'skip'
  )

  return (
    <div className="mx-auto max-w-[720px] px-4">
      <PageHeader
        title={t('people.title')}
        lead={t('people.lead')}
      >
        {tab !== 'all' && (
          <WindowToggle
            value={window}
            onChange={setWindow}
            options={WINDOWS}
          />
        )}
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
              <p className="text-muted-foreground text-sm">{t('people.emptyReceived')}</p>
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
        {tab === 'all' && <DirectoryList />}
      </div>
    </div>
  )
}
