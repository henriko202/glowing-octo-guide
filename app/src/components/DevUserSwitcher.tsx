import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { api } from '../convex'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clearSignedOut } from '../lib/session'
import type { Id } from '../../../convex/_generated/dataModel'

// Dev-only user impersonation switcher. Rendered from App.tsx behind import.meta.env.DEV; the
// backend additionally refuses every call unless ALLOW_DEV_IMPERSONATION=true on the deployment.
const PREV_TOKEN_KEY = 'devImpersonatePrevToken'
const PREV_NAME_KEY = 'devImpersonatePrevName'

function readPrev(): { token: string; name: string } | null {
  const token = sessionStorage.getItem(PREV_TOKEN_KEY)
  return token ? { token, name: sessionStorage.getItem(PREV_NAME_KEY) ?? '' } : null
}

function restoreSession(token: string, keepPrev: boolean): void {
  if (!keepPrev) {
    sessionStorage.removeItem(PREV_TOKEN_KEY)
    sessionStorage.removeItem(PREV_NAME_KEY)
  }
  clearSignedOut()
  sessionStorage.setItem('sessionToken', token)
  window.location.reload()
}

function SwitcherPanel({
  currentName,
  currentId,
  onClose
}: {
  currentName: string | undefined
  currentId: Id<'users'> | undefined
  onClose: () => void
}) {
  const users = useQuery(api.dev.listUsers, {})
  const impersonate = useMutation(api.dev.impersonate)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const prev = readPrev()

  const filtered = useMemo(() => {
    if (!users) return null
    const q = search.trim().toLowerCase()
    const list = q
      ? users.filter(u => u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
      : users
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [users, search])

  async function pick(userId: Id<'users'>) {
    setError(null)
    setBusyId(userId)
    try {
      const { sessionToken } = await impersonate({ userId })
      const current = sessionStorage.getItem('sessionToken')
      // Keep the original session so "back" always returns to the real account.
      if (current && !sessionStorage.getItem(PREV_TOKEN_KEY)) {
        sessionStorage.setItem(PREV_TOKEN_KEY, current)
        sessionStorage.setItem(PREV_NAME_KEY, currentName ?? '')
      }
      restoreSession(sessionToken, true)
    } catch (e) {
      setBusyId(null)
      setError(e instanceof Error ? e.message : 'Impersonation failed')
    }
  }

  return (
    <div className="bg-background fixed right-5 bottom-[7.5rem] z-50 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-xl border shadow-xl">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <p className="text-sm font-semibold">DEV · Impersonate</p>
          <p className="text-muted-foreground text-xs">Curr: {currentName ?? 'unknown'}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      {prev && (
        <button
          type="button"
          onClick={() => restoreSession(prev.token, false)}
          className="bg-muted/50 hover:bg-muted border-b px-3 py-2 text-left text-xs font-medium"
        >
          ← Back to {prev.name || 'original user'}
        </button>
      )}

      <div className="border-b p-2">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          autoFocus
        />
      </div>

      {error && <p className="text-destructive border-b px-3 py-2 text-xs break-words">{error}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered === null && <p className="text-muted-foreground p-3 text-xs">Loading…</p>}
        {filtered?.length === 0 && <p className="text-muted-foreground p-3 text-xs">No users found.</p>}
        {filtered?.map(u => (
          <button
            key={u._id}
            type="button"
            disabled={busyId !== null}
            onClick={() => void pick(u._id)}
            className={
              'hover:bg-muted block w-full border-b px-3 py-2 text-left text-sm disabled:opacity-50 ' +
              (u._id === currentId ? 'bg-primary/10' : '')
            }
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">
                {u.name}
                {u._id === currentId && <span className="text-muted-foreground"> (current)</span>}
              </span>
              <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                {u.tier ?? 'starter'} · {u.subscriptionStatus}
              </span>
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {u.email ?? 'no email'}
              {u.isBanned && <span className="text-destructive font-semibold"> · BANNED</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SwitcherPanelData({ onClose }: { onClose: () => void }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })
  return (
    <SwitcherPanel
      currentName={me?.name}
      currentId={me?._id}
      onClose={onClose}
    />
  )
}

export default function DevUserSwitcher() {
  const [open, setOpen] = useState(false)
  if (!import.meta.env.DEV) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="fixed right-5 bottom-18 z-50 rounded-full bg-amber-400 px-3 py-2 text-xs font-bold text-black shadow-lg hover:bg-amber-300"
      >
        DEV · Impersonate
      </button>
      {open && <SwitcherPanelData onClose={() => setOpen(false)} />}
    </>
  )
}
