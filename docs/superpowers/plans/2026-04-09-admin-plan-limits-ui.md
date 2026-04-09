# Admin Plan Limits UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Plan Limits" tab to the Admin Panel that lets admins view and edit tier defaults and contact-tier per-user overrides via the existing backend API.

**Architecture:** `AdminPage.tsx` gets a two-tab layout (Settings / Plan Limits). A new `PlanLimitsTab` component owns all query/mutation logic and renders a unified table plus an edit modal. No new Convex functions are needed — all four backend mutations (`listPlanLimits`, `updateTierDefault`, `setContactUserLimit`, `removeContactUserLimit`) are already deployed.

**Tech Stack:** React 18, Tailwind CSS, Convex React (`useQuery` / `useMutation`), Vitest + @testing-library/react, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-09-admin-plan-limits-ui-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/src/pages/AdminPage.tsx` | Modify | Add tab bar; route to Settings or Plan Limits tab |
| `app/src/components/PlanLimitsTab.tsx` | Create | Table + edit modal; owns all plan-limits state, queries, mutations |
| `app/src/components/PlanLimitsTab.test.tsx` | Create | Vitest tests for PlanLimitsTab |
| `app/src/pages/AdminPage.test.tsx` | Create | Vitest test: tab bar renders and switches |

---

## Task 1: Add tab bar to AdminPage

**Files:**
- Modify: `app/src/pages/AdminPage.tsx`
- Create: `app/src/pages/AdminPage.test.tsx`

- [ ] **Step 1.1: Write failing test for tab bar**

Create `app/src/pages/AdminPage.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({
  useQuery: vi.fn((query: unknown) => {
    // checkIsAdmin → true; everything else → undefined (skipped)
    const name = (query as { _def?: { exportedName?: string } })?._def?.exportedName
    if (name === 'admin:checkIsAdmin') return true
    return undefined
  }),
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

import AdminPage from './AdminPage'

describe('AdminPage tabs', () => {
  it('renders Settings and Plan Limits tab buttons', () => {
    render(<AdminPage />)
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /plan limits/i })).toBeInTheDocument()
  })

  it('defaults to Settings tab', () => {
    render(<AdminPage />)
    expect(screen.getByText(/apify post sync/i)).toBeInTheDocument()
  })

  it('switches to Plan Limits tab on click', () => {
    render(<AdminPage />)
    fireEvent.click(screen.getByRole('button', { name: /plan limits/i }))
    expect(screen.queryByText(/apify post sync/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
cd app && npx vitest run src/pages/AdminPage.test.tsx
```

Expected: FAIL — `Settings` and `Plan Limits` buttons not found.

- [ ] **Step 1.3: Update AdminPage.tsx with tab bar**

Replace `app/src/pages/AdminPage.tsx` with:

```tsx
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import PlanLimitsTab from '../components/PlanLimitsTab'

export default function AdminPage() {
  const navigate = useNavigate()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const isAdmin = useQuery(api.admin.checkIsAdmin, { sessionToken })
  const settings = useQuery(api.admin.getSettings, sessionToken && isAdmin ? { sessionToken } : 'skip')
  const toggleSync = useMutation(api.admin.toggleApifySync)
  const [toggling, setToggling] = useState(false)
  const [tab, setTab] = useState<'settings' | 'planLimits'>('settings')

  if (isAdmin === undefined) {
    return <LoadingSpinner />
  }

  if (!isAdmin) {
    navigate('/')
  }

  async function handleToggle() {
    if (!sessionToken || !settings) return
    setToggling(true)
    try {
      await toggleSync({ sessionToken, enabled: !settings.apifySyncEnabled })
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px] p-8 font-sans">
      <h1 className="mb-4 text-[22px] font-bold text-slate-900">Admin Panel</h1>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'settings'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setTab('planLimits')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'planLimits'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Plan Limits
        </button>
      </div>

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-900">Apify Post Sync</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Scrapes LinkedIn posts for all active users every hour via Apify.
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling || !settings}
              className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${toggling ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifySyncEnabled ? 'bg-red-500' : 'bg-green-500'}`}
            >
              {toggling ? '…' : settings?.apifySyncEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
          {settings?.lastApifySyncAt && (
            <div className="mt-3 text-xs text-slate-400">
              Last sync: {new Date(settings.lastApifySyncAt).toLocaleString()}
              {settings.lastApifySyncError && (
                <span className="ml-2 text-red-500">— {settings.lastApifySyncError}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Plan Limits tab */}
      {tab === 'planLimits' && (
        <PlanLimitsTab sessionToken={sessionToken} isAdmin={isAdmin} />
      )}
    </div>
  )
}
```

- [ ] **Step 1.4: Run test to confirm it passes**

```bash
cd app && npx vitest run src/pages/AdminPage.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add app/src/pages/AdminPage.tsx app/src/pages/AdminPage.test.tsx
git commit -m "feat(admin): add Settings/Plan Limits tab bar to AdminPage"
```

---

## Task 2: Add data-testid to LoadingSpinner (prerequisite)

**Files:**
- Modify: `app/src/components/LoadingSpinner.tsx` (only if `data-testid` is missing)

- [ ] **Step 2.1: Read LoadingSpinner.tsx**

Read `app/src/components/LoadingSpinner.tsx`. If the root element already has `data-testid="loading-spinner"`, skip this task entirely and continue to Task 3.

- [ ] **Step 2.2: Add data-testid if missing**

If the root element does not have `data-testid`, add `data-testid="loading-spinner"` to it. Do not change anything else.

- [ ] **Step 2.3: Commit (only if LoadingSpinner was changed)**

```bash
git add app/src/components/LoadingSpinner.tsx
git commit -m "chore: add data-testid to LoadingSpinner for test targeting"
```

---

## Task 3: Create PlanLimitsTab — table with loading and data states

**Files:**
- Create: `app/src/components/PlanLimitsTab.tsx`
- Create: `app/src/components/PlanLimitsTab.test.tsx`

- [ ] **Step 3.1: Write failing tests for table rendering**

Create `app/src/components/PlanLimitsTab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Default mock: 4 tier defaults, 1 contact override
const mockRows = [
  { _id: 'r1', tier: 'starter', interactionsPerPost: 25, postsPerWeek: 1 },
  { _id: 'r2', tier: 'growth', interactionsPerPost: 50, postsPerWeek: 2 },
  { _id: 'r3', tier: 'pro', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r4', tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r5', tier: 'contact', userId: 'u1', userName: 'Bob Smith', interactionsPerPost: 500, postsPerWeek: 10 },
]

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockRows),
  useMutation: vi.fn(() => vi.fn()),
}))

import PlanLimitsTab from './PlanLimitsTab'

describe('PlanLimitsTab — table', () => {
  it('renders all four tier badge pills', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByText('starter')).toBeInTheDocument()
    expect(screen.getByText('growth')).toBeInTheDocument()
    expect(screen.getByText('pro')).toBeInTheDocument()
    // 'contact' appears as both a tier badge and a row label — at least one must exist
    expect(screen.getAllByText('contact').length).toBeGreaterThan(0)
  })

  it('renders limit values for tier default rows', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // starter: 25 interactions, 1 post
    expect(screen.getByTestId('row-r1-interactions')).toHaveTextContent('25')
    expect(screen.getByTestId('row-r1-posts')).toHaveTextContent('1')
  })

  it('renders contact override row with user name', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByTestId('row-r5-interactions')).toHaveTextContent('500')
  })

  it('shows a Reset button only on contact override rows', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // Only 1 contact override row (r5) should have a Reset button
    expect(screen.getAllByRole('button', { name: /reset/i })).toHaveLength(1)
  })

  it('shows loading spinner when query returns undefined', async () => {
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockReturnValueOnce(undefined)
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
cd app && npx vitest run src/components/PlanLimitsTab.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Create PlanLimitsTab.tsx with table**

Create `app/src/components/PlanLimitsTab.tsx`:

```tsx
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { useState } from 'react'
import type { Id } from '../convex/_generated/dataModel'

type Tier = 'starter' | 'growth' | 'pro' | 'contact'

type PlanLimitRow = {
  _id: Id<'planLimits'>
  tier: Tier
  userId?: Id<'users'>
  userName?: string
  interactionsPerPost: number
  postsPerWeek: number
}

// Fixed display order for tier default rows
const TIER_ORDER: Tier[] = ['starter', 'growth', 'pro', 'contact']

// Tier badge colour classes
const TIER_COLOURS: Record<Tier, string> = {
  starter: 'bg-slate-100 text-slate-600',
  growth: 'bg-blue-100 text-blue-700',
  pro: 'bg-green-100 text-green-700',
  contact: 'bg-purple-100 text-purple-700',
}

function sortRows(rows: PlanLimitRow[]): { defaults: PlanLimitRow[]; overrides: PlanLimitRow[] } {
  const defaults = TIER_ORDER.map(tier => rows.find(r => r.tier === tier && !r.userId)).filter(
    Boolean
  ) as PlanLimitRow[]
  const overrides = rows
    .filter(r => r.userId)
    .sort((a, b) => (a.userName ?? '').localeCompare(b.userName ?? ''))
  return { defaults, overrides }
}

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

export default function PlanLimitsTab({ sessionToken, isAdmin }: Props) {
  const rows = useQuery(
    api.admin.listPlanLimits,
    sessionToken && isAdmin ? { sessionToken } : 'skip'
  ) as PlanLimitRow[] | undefined

  const updateTierDefault = useMutation(api.admin.updateTierDefault)
  const setContactUserLimit = useMutation(api.admin.setContactUserLimit)
  const removeContactUserLimit = useMutation(api.admin.removeContactUserLimit)

  const [editingRow, setEditingRow] = useState<PlanLimitRow | null>(null)
  const [resetting, setResetting] = useState<string | null>(null) // _id being reset

  if (rows === undefined) {
    return <LoadingSpinner />
  }

  const { defaults, overrides } = sortRows(rows)

  async function handleReset(row: PlanLimitRow) {
    if (!row.userId || !sessionToken) return
    setResetting(row._id)
    try {
      await removeContactUserLimit({ sessionToken, userId: row.userId })
    } finally {
      setResetting(null)
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_100px_130px] border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div>Tier / User</div>
          <div>Int / Post</div>
          <div>Posts / Wk</div>
          <div>Actions</div>
        </div>

        {/* Tier default rows */}
        {defaults.map(row => (
          <div
            key={row._id}
            className="grid grid-cols-[1fr_100px_100px_130px] items-center border-b border-slate-100 px-4 py-3 text-sm"
          >
            <div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLOURS[row.tier]}`}>
                {row.tier}
              </span>
            </div>
            <div data-testid={`row-${row._id}-interactions`}>{row.interactionsPerPost}</div>
            <div data-testid={`row-${row._id}-posts`}>{row.postsPerWeek}</div>
            <div>
              <button
                onClick={() => setEditingRow(row)}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Edit
              </button>
            </div>
          </div>
        ))}

        {/* Contact override rows */}
        {overrides.length > 0 && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Contact overrides
            </div>
            {overrides.map(row => (
              <div
                key={row._id}
                className="grid grid-cols-[1fr_100px_100px_130px] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              >
                <div className="text-slate-700">{row.userName ?? row.userId}</div>
                <div data-testid={`row-${row._id}-interactions`}>{row.interactionsPerPost}</div>
                <div data-testid={`row-${row._id}-posts`}>{row.postsPerWeek}</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingRow(row)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleReset(row)}
                    disabled={resetting === row._id}
                    className="text-xs font-medium text-slate-400 hover:text-red-500 disabled:opacity-50"
                  >
                    {resetting === row._id ? '…' : 'Reset'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Edit modal */}
      {editingRow && (
        <EditModal
          row={editingRow}
          sessionToken={sessionToken!}
          onClose={() => setEditingRow(null)}
          updateTierDefault={updateTierDefault}
          setContactUserLimit={setContactUserLimit}
          removeContactUserLimit={removeContactUserLimit}
        />
      )}
    </div>
  )
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

type EditModalProps = {
  row: PlanLimitRow
  sessionToken: string
  onClose: () => void
  updateTierDefault: ReturnType<typeof useMutation<typeof api.admin.updateTierDefault>>
  setContactUserLimit: ReturnType<typeof useMutation<typeof api.admin.setContactUserLimit>>
  removeContactUserLimit: ReturnType<typeof useMutation<typeof api.admin.removeContactUserLimit>>
}

function EditModal({ row, sessionToken, onClose, updateTierDefault, setContactUserLimit, removeContactUserLimit }: EditModalProps) {
  const [interactions, setInteractions] = useState(String(row.interactionsPerPost))
  const [posts, setPosts] = useState(String(row.postsPerWeek))
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOverride = Boolean(row.userId)

  // Validation: both fields must be integers >= 1
  const iValid = Number.isInteger(Number(interactions)) && Number(interactions) >= 1
  const pValid = Number.isInteger(Number(posts)) && Number(posts) >= 1
  const isValid = iValid && pValid

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    setError(null)
    try {
      if (isOverride && row.userId) {
        await setContactUserLimit({
          sessionToken,
          userId: row.userId,
          interactionsPerPost: Number(interactions),
          postsPerWeek: Number(posts),
        })
      } else {
        await updateTierDefault({
          sessionToken,
          tier: row.tier,
          interactionsPerPost: Number(interactions),
          postsPerWeek: Number(posts),
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!row.userId) return
    setResetting(true)
    setError(null)
    try {
      await removeContactUserLimit({ sessionToken, userId: row.userId })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const title = isOverride
    ? `Edit ${row.userName ?? 'user'} limits`
    : `Edit ${row.tier} defaults`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-72 rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-[15px] font-semibold text-slate-900">{title}</h3>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Interactions per post
            </span>
            <input
              type="number"
              min="1"
              value={interactions}
              onChange={e => setInteractions(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Posts per week
            </span>
            <input
              type="number"
              min="1"
              value={posts}
              onChange={e => setPosts(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md bg-slate-100 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>

        {isOverride && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
          >
            {resetting ? '…' : 'Reset to default'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3.4: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3.5: Run tests**

```bash
cd app && npx vitest run src/components/PlanLimitsTab.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 3.6: Commit**

```bash
git add app/src/components/PlanLimitsTab.tsx app/src/components/PlanLimitsTab.test.tsx
git commit -m "feat(admin): add PlanLimitsTab with unified table and edit modal"
```

---

## Task 4: Test edit modal interactions (open, validate, save, reset)

**Files:**
- Modify: `app/src/components/PlanLimitsTab.test.tsx`

These tests cover the edit modal — opening it, validation gating the Save button, Save calling the right mutation, and Reset calling `removeContactUserLimit`.

- [ ] **Step 4.1: Add modal interaction tests**

Append to `app/src/components/PlanLimitsTab.test.tsx`:

```tsx
import { fireEvent, waitFor } from '@testing-library/react'

describe('PlanLimitsTab — edit modal', () => {
  it('opens modal with pre-filled values when Edit is clicked on a tier row', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // Click Edit on the starter row
    const editBtns = screen.getAllByRole('button', { name: /^edit$/i })
    fireEvent.click(editBtns[0]) // first Edit = starter row
    expect(screen.getByText(/edit starter defaults/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1')).toBeInTheDocument()
  })

  it('disables Save when an input is set to 0', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    const interactionsInput = screen.getByDisplayValue('25')
    fireEvent.change(interactionsInput, { target: { value: '0' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('calls updateTierDefault with correct args when Save is clicked on tier row', async () => {
    const { useMutation } = await import('convex/react')
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockMutate)

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]) // starter
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: 'tok',
          tier: 'starter',
          interactionsPerPost: 25,
          postsPerWeek: 1,
        })
      )
    })
  })

  it('calls setContactUserLimit when Save is clicked on a contact override row', async () => {
    const { useMutation } = await import('convex/react')
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockMutate)

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // The contact override row (Bob Smith) Edit button
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i, hidden: false }))
    // If there are multiple, select the one near "Bob Smith":
    // (Simpler: click the last Edit button, which corresponds to the contact override)
    // Close and reopen on the correct row
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    const allEdits = screen.getAllByRole('button', { name: /^edit$/i })
    fireEvent.click(allEdits[allEdits.length - 1]) // last Edit = contact override

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: 'tok',
          userId: 'u1',
          interactionsPerPost: 500,
          postsPerWeek: 10,
        })
      )
    })
  })

  it('calls removeContactUserLimit when Reset to default is clicked in modal', async () => {
    const { useMutation } = await import('convex/react')
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockMutate)

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    const allEdits = screen.getAllByRole('button', { name: /^edit$/i })
    fireEvent.click(allEdits[allEdits.length - 1]) // contact override
    fireEvent.click(screen.getByRole('button', { name: /reset to default/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ sessionToken: 'tok', userId: 'u1' })
      )
    })
  })
})
```

- [ ] **Step 4.2: Run all PlanLimitsTab tests**

```bash
cd app && npx vitest run src/components/PlanLimitsTab.test.tsx
```

Expected: all tests PASS. If a test around mutation mocking is fragile (because `useMutation` is called 3 times in the component), adjust the mock to use `vi.fn().mockReturnValue(mockMutate)` as shown — this returns the same mock fn for all three mutation calls, so `expect(mockMutate).toHaveBeenCalledWith(...)` will match regardless of which mutation was called. The test asserts the *arguments*, which uniquely identify which mutation fired.

- [ ] **Step 4.3: Run the full test suite**

```bash
cd app && npm test
```

Expected: all tests PASS (existing tests unaffected).

- [ ] **Step 4.4: Commit**

```bash
git add app/src/components/PlanLimitsTab.test.tsx
git commit -m "test(admin): add modal interaction tests for PlanLimitsTab"
```

---

## Task 5: Manual smoke test

This is the only verification that requires a running dev server. The test suite covers logic; this confirms visual integration.

- [ ] **Step 5.1: Start the dev environment**

Follow the project's existing dev startup instructions (typically `npx convex dev` in one terminal, `cd app && npm run dev` in another).

- [ ] **Step 5.2: Verify each acceptance criterion**

Log in as an admin user, navigate to `/admin`, and confirm:

- [ ] Page loads on the Settings tab by default; Apify sync toggle is visible and functional
- [ ] Clicking "Plan Limits" switches to the plan limits table; 4 tier rows visible (starter, growth, pro, contact)
- [ ] Clicking "Edit" on the starter row opens a modal titled "Edit starter defaults" pre-filled with starter's current values
- [ ] Changing a value to `0` disables the Save button
- [ ] Saving with valid values closes the modal and the table updates immediately (Convex live subscription)
- [ ] In the Convex dashboard, run `setContactUserLimit` to create a contact override for a contact-tier user; the table shows a new row with "Edit" and "Reset" buttons
- [ ] Clicking "Reset" on the table row (no modal) removes the override; row disappears
- [ ] Clicking "Edit" on the contact override row → modal shows "Reset to default" link; clicking it removes the override
- [ ] Hard refresh — stays on the Settings tab (tab state is not persisted, which is correct)

- [ ] **Step 5.3: Final commit (if any fixes were needed)**

```bash
git add -p
git commit -m "fix(admin): <describe what needed fixing>"
```
