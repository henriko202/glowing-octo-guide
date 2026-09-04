import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex'
import { performSignOut } from '@/lib/session'
import { useTheme } from '../ThemeProvider'
import { NAV_GROUPS } from './navItems'
import { Command, CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem } from '../ui/command'

const MIN_QUERY = 2

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { resolved, setPref } = useTheme()
  const logout = useMutation(api.users.logout)
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), 180)
    return () => clearTimeout(id)
  }, [text])

  const searching = debounced.trim().length >= MIN_QUERY
  const results = useQuery(
    api.search.search,
    searching ? { sessionToken: sessionStorage.getItem('sessionToken') ?? undefined, queryText: debounced } : 'skip'
  )
  const hasResults = !!results && (results.people.length > 0 || results.posts.length > 0)

  function run(action: () => void) {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('shell.commandTitle')}
      description={t('shell.searchPlaceholder')}
    >
      {/* shouldFilter=false: results come pre-filtered from the Convex search query — cmdk's own
          substring filter would wrongly hide full-text matches whose text doesn't contain the query. */}
      <Command shouldFilter={false}>
        <CommandInput
          value={text}
          onValueChange={setText}
          placeholder={t('shell.searchPlaceholder')}
        />
        <CommandList>
          {!searching ? (
            <CommandGroup heading={t('shell.groupActions')}>
              {NAV_GROUPS.flatMap(g =>
                g.items.map(item => (
                  <CommandItem
                    key={item.path}
                    value={item.path}
                    onSelect={() => run(() => navigate(item.path))}
                  >
                    {t(item.labelKey)}
                  </CommandItem>
                ))
              )}
              <CommandItem
                value="__toggle-theme"
                onSelect={() => run(() => setPref(resolved === 'dark' ? 'light' : 'dark'))}
              >
                {t('shell.actionToggleTheme')}
              </CommandItem>
              <CommandItem
                value="__sign-out"
                onSelect={() => run(() => void performSignOut(logout, sessionStorage.getItem('sessionToken')))}
              >
                {t('nav.signOut')}
              </CommandItem>
            </CommandGroup>
          ) : !hasResults ? (
            <div className="text-muted-foreground py-6 text-center text-sm">{results ? t('shell.noResults') : '…'}</div>
          ) : (
            <>
              {results.people.length > 0 && (
                <CommandGroup heading={t('shell.groupPeople')}>
                  {results.people.map(p => (
                    <CommandItem
                      key={p._id}
                      value={p._id}
                      disabled={!p.linkedinPublicIdentifier}
                      onSelect={() =>
                        run(
                          () =>
                            p.linkedinPublicIdentifier &&
                            window.open(
                              `https://www.linkedin.com/in/${p.linkedinPublicIdentifier}`,
                              '_blank',
                              'noopener'
                            )
                        )
                      }
                    >
                      <span className="truncate">{p.name}</span>
                      {p.headline ? (
                        <span className="text-muted-foreground ml-2 truncate text-xs">{p.headline}</span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.posts.length > 0 && (
                <CommandGroup heading={t('shell.groupPosts')}>
                  {results.posts.map(post => (
                    <CommandItem
                      key={post._id}
                      value={post._id}
                      disabled={!post.sourceUrl}
                      onSelect={() => run(() => post.sourceUrl && window.open(post.sourceUrl, '_blank', 'noopener'))}
                    >
                      <span className="truncate">{post.content.slice(0, 80)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
