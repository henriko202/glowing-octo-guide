# Admin Plan Limits UI — v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope change from v1 — tier default rows become read-only; admins can only create/edit/delete per-user contact
overrides. A live name-search form below the table lets admins add new overrides.

**Context:** v1 tasks 1–4 are already committed. The current state has:

- `AdminPage.tsx` with tab bar (Settings / Plan Limits)
- `PlanLimitsTab.tsx` with unified table + EditModal — tier default rows currently have Edit buttons
- 27 tests passing

**This plan changes:**

1. Backend: add `searchContactUsers` query to `convex/admin.ts`
2. Frontend: remove Edit buttons from tier default rows; add live search form for creating new overrides
3. Tests: update to match new behaviour

**Spec:** `docs/superpowers/specs/2026-04-09-admin-plan-limits-ui-design.md`

**Tech Stack:** React 18, Tailwind CSS, Convex React (`useQuery` / `useMutation`), Vitest + @testing-library/react,
TypeScript

---

## File Map

| File                                        | Action | Responsibility                                                        |
| ------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `convex/admin.ts`                           | Modify | Add `searchContactUsers` query                                        |
| `app/src/components/PlanLimitsTab.tsx`      | Modify | Remove Edit from tier rows; add search form + new-override modal flow |
| `app/src/components/PlanLimitsTab.test.tsx` | Modify | Update tests to match new behaviour                                   |

---

## Task 1: Add `searchContactUsers` query to `convex/admin.ts`

**Files:**

- Modify: `convex/admin.ts`

**Context:** The `users` table has no `by_tier` index. The query must use a bounded scan (`.take(1000)`) and filter
JS-side. This is acceptable for an admin tool. The `name` field on `users` is optional.

- [ ] **Step 1.1: Read `convex/admin.ts`**

Read the full file to understand its existing structure and imports before adding to it.

- [ ] **Step 1.2: Add `searchContactUsers` at the end of the public exports (before the internal functions section)**

Add this export:

```typescript
// Returns up to 10 contact-tier users whose name contains nameQuery (case-insensitive).
// Uses a bounded JS-side scan since there is no by_tier index on users.
export const searchContactUsers = query({
  args: {
    sessionToken: v.string(),
    nameQuery: v.string()
  },
  handler: async (ctx, { sessionToken, nameQuery }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const allUsers = await ctx.db.query('users').take(1000)
    const q = nameQuery.toLowerCase()

    return allUsers
      .filter(u => u.tier === 'contact' && (u.name ?? '').toLowerCase().includes(q))
      .slice(0, 10)
      .map(u => ({ _id: u._id, name: u.name ?? '' }))
  }
})
```

Insert this block just before the line `// ─── Internal functions` comment.

- [ ] **Step 1.3: Check TypeScript compiles**

```bash
cd D:/ERP/LinkIntoTheSSI/LinkIntoTheSSI && npx convex codegen --dry-run 2>/dev/null || npx tsc --noEmit -p convex/tsconfig.json 2>/dev/null || echo "TypeScript check complete"
```

If no Convex tsconfig exists, run:

```bash
cd D:/ERP/LinkIntoTheSSI/LinkIntoTheSSI/app && npx tsc --noEmit
```

- [ ] **Step 1.4: Commit**

```bash
git add convex/admin.ts
git commit -m "feat(admin): add searchContactUsers query for contact override creation"
```

---

## Task 2: Update PlanLimitsTab — read-only tier rows + search form

**Files:**

- Modify: `app/src/components/PlanLimitsTab.tsx`

**Context:** The current file has:

- `sortRows()` helper splitting rows into `defaults` and `overrides`
- Tier default rows with an Edit button (to be removed)
- Contact override rows with Edit + Reset buttons (unchanged)
- `EditModal` co-located in the same file, receiving 3 mutation handles as props
- The modal currently handles both tier-default editing and contact-override editing

**What changes:**

1. Remove Edit button from tier default rows (show a muted "Default" label instead, or just leave Actions cell empty)
2. Remove `updateTierDefault` useMutation call (no longer needed)
3. Remove `updateTierDefault` from EditModal props
4. Update EditModal to only handle contact overrides (always calls `setContactUserLimit`)
5. Add `EditTarget` type to represent both existing overrides and new overrides (no `_id`)
6. Add search state: `searchQuery: string`, replaced with `useQuery` for live results
7. Add search input + results list below the table
8. When user is selected from results, find contact default row for pre-fill values, set `editingRow`
9. Update modal title logic: existing override → "Edit [name] limits"; new override → "Add override for [name]"
10. Hide "Reset to default" link when creating a new override (no existing row to reset)

**New types needed:**

```typescript
// EditTarget covers both existing contact override rows and new overrides (no _id yet)
type EditTarget = {
  _id?: Id<'planLimits'>
  tier: 'contact'
  userId: Id<'users'>
  userName: string
  interactionsPerPost: number
  postsPerWeek: number
  isNew?: boolean // true when opened from search (no existing row)
}
```

**Search query usage:**

```typescript
const [searchQuery, setSearchQuery] = useState('')

const searchResults = useQuery(
  api.admin.searchContactUsers,
  sessionToken && isAdmin && searchQuery ? { sessionToken, nameQuery: searchQuery } : 'skip'
) as { _id: Id<'users'>; name: string }[] | undefined
```

**Opening modal from search result:**

```typescript
function handleSelectUser(user: { _id: Id<'users'>; name: string }) {
  // Find contact tier default values for pre-fill
  const contactDefault = rows?.find(r => r.tier === 'contact' && !r.userId)
  setEditingRow({
    tier: 'contact',
    userId: user._id,
    userName: user.name,
    interactionsPerPost: contactDefault?.interactionsPerPost ?? 200,
    postsPerWeek: contactDefault?.postsPerWeek ?? 5,
    isNew: true
  })
  setSearchQuery('')
}
```

**Search UI below the table:**

```tsx
<div className="mt-4">
  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add contact override</p>
  <input
    type="text"
    placeholder="Search contact users..."
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
  />
  {searchQuery && searchResults && searchResults.length > 0 && (
    <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {searchResults.map(user => (
        <button
          key={user._id}
          onClick={() => handleSelectUser(user)}
          className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          {user.name}
        </button>
      ))}
    </div>
  )}
  {searchQuery && searchResults?.length === 0 && (
    <p className="mt-2 text-xs text-slate-400">No contact users found matching "{searchQuery}"</p>
  )}
</div>
```

**Steps:**

- [ ] **Step 2.1: Read the current `PlanLimitsTab.tsx`**

Read the full file before modifying.

- [ ] **Step 2.2: Rewrite `PlanLimitsTab.tsx` with the changes above**

Key implementation points:

- Keep `PlanLimitRow` type for the query result rows
- Add `EditTarget` type (as shown above)
- Change `editingRow` state from `PlanLimitRow | null` to `EditTarget | null`
- Remove `updateTierDefault` useMutation; keep only `setContactUserLimit` and `removeContactUserLimit`
- Remove Edit button from tier default row rendering; render an empty cell or a muted "—" in Actions
- Update EditModal props: remove `updateTierDefault`; add `isNew` boolean
- Update EditModal title: `isNew ? "Add override for ${row.userName}" : "Edit ${row.userName} limits"`
- Hide "Reset to default" link when `isNew` is true
- EditModal always calls `setContactUserLimit` (no longer dispatches to `updateTierDefault`)
- Add search state + query + results UI below the table
- `useMutation` is now called only twice in the parent (setContactUserLimit, removeContactUserLimit)

- [ ] **Step 2.3: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.4: Run existing tests (will fail — update in Task 3)**

```bash
cd app && npx vitest run src/components/PlanLimitsTab.test.tsx
```

Note which tests fail and why — this informs Task 3.

- [ ] **Step 2.5: Commit**

```bash
git add app/src/components/PlanLimitsTab.tsx
git commit -m "feat(admin): read-only tier rows and contact override search in PlanLimitsTab"
```

---

## Task 3: Update PlanLimitsTab tests

**Files:**

- Modify: `app/src/components/PlanLimitsTab.test.tsx`

**Context:** Current tests (10 total):

Table rendering tests:

1. renders all four tier badge pills ✅ (unchanged)
2. renders limit values for tier default rows ✅ (unchanged)
3. renders contact override row with user name ✅ (unchanged)
4. shows a Reset button only on contact override rows — **update**: tier rows no longer have Edit buttons
5. shows loading spinner when query returns undefined ✅ (unchanged)

Modal interaction tests:

6. opens modal with pre-filled values when Edit is clicked on a tier row — **remove**: tier rows have no Edit button
7. disables Save when an input is set to 0 — **update**: must open modal from a contact override row now
8. calls updateTierDefault... — **remove**: updateTierDefault no longer called from frontend
9. calls setContactUserLimit when Save is clicked on a contact override row ✅ (may need minor update)
10. calls removeContactUserLimit when Reset to default is clicked in modal ✅ (may need minor update)

**New tests to add:**

- renders search input below the table
- shows search results when searchResults are returned
- clicking a search result opens modal titled "Add override for [name]"
- Save on new-override modal calls setContactUserLimit with correct userId

**Updated mock setup:** useMutation is now called **twice** (not 3 times) — update mock accordingly.

**Steps:**

- [ ] **Step 3.1: Read the current `PlanLimitsTab.test.tsx`**

Read the full current test file to understand what to keep and what to change.

- [ ] **Step 3.2: Rewrite `PlanLimitsTab.test.tsx`**

Full replacement with updated tests. Key changes:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useQuery, useMutation } from 'convex/react'

// Default mock data: 4 tier defaults + 1 contact override
const mockRows = [
  { _id: 'r1', tier: 'starter', interactionsPerPost: 25, postsPerWeek: 1 },
  { _id: 'r2', tier: 'growth', interactionsPerPost: 50, postsPerWeek: 2 },
  { _id: 'r3', tier: 'pro', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r4', tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r5', tier: 'contact', userId: 'u1', userName: 'Bob Smith', interactionsPerPost: 500, postsPerWeek: 10 }
]

// useMutation is called TWICE in PlanLimitsTab (setContactUserLimit, removeContactUserLimit)
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockRows),
  useMutation: vi.fn(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }))
}))

import PlanLimitsTab from './PlanLimitsTab'

describe('PlanLimitsTab — table', () => {
  it('renders all four tier badge pills', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText('starter')).toBeInTheDocument()
    expect(screen.getByText('growth')).toBeInTheDocument()
    expect(screen.getByText('pro')).toBeInTheDocument()
    expect(screen.getAllByText('contact').length).toBeGreaterThan(0)
  })

  it('renders limit values for tier default rows', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByTestId('row-r1-interactions')).toHaveTextContent('25')
    expect(screen.getByTestId('row-r1-posts')).toHaveTextContent('1')
  })

  it('renders contact override row with user name', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByTestId('row-r5-interactions')).toHaveTextContent('500')
  })

  it('shows no Edit button on tier default rows', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    // Only 1 Edit button total — for the contact override row (Bob Smith)
    expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(1)
  })

  it('shows a Reset button only on the contact override row', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getAllByRole('button', { name: /reset/i })).toHaveLength(1)
  })

  it('shows loading spinner when query returns undefined', async () => {
    vi.mocked(useQuery).mockReturnValueOnce(undefined)
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders the search input for adding contact overrides', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByPlaceholderText(/search contact users/i)).toBeInTheDocument()
  })

  it('shows search results from the query when search input has text', () => {
    const mockSearchResults = [{ _id: 'u2', name: 'Alice Johnson' }]
    vi.mocked(useQuery)
      .mockReturnValueOnce(mockRows) // listPlanLimits
      .mockReturnValueOnce(mockSearchResults) // searchContactUsers

    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/search contact users/i), {
      target: { value: 'alice' }
    })
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
  })

  it('opens modal titled "Add override for [name]" when a search result is clicked', () => {
    const mockSearchResults = [{ _id: 'u2', name: 'Alice Johnson' }]
    vi.mocked(useQuery).mockReturnValueOnce(mockRows).mockReturnValueOnce(mockSearchResults)

    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/search contact users/i), {
      target: { value: 'alice' }
    })
    fireEvent.click(screen.getByText('Alice Johnson'))
    expect(screen.getByText(/add override for alice johnson/i)).toBeInTheDocument()
  })
})

describe('PlanLimitsTab — edit modal (contact override)', () => {
  beforeEach(() => {
    vi.mocked(useMutation).mockReset()
    vi.mocked(useMutation).mockImplementation(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }))
    vi.mocked(useQuery).mockReturnValue(mockRows)
  })

  it('opens modal with pre-filled values when Edit is clicked on a contact override row', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByText(/edit bob smith limits/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it('disables Save when interactions is set to 0', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('calls setContactUserLimit with correct args when Save is clicked', async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(() => Object.assign(mockMutate, { withOptimisticUpdate: vi.fn() }))

    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: 'tok',
          userId: 'u1',
          interactionsPerPost: 500,
          postsPerWeek: 10
        })
      )
    })
    // Modal should close
    expect(screen.queryByRole('heading', { name: /edit bob smith limits/i })).not.toBeInTheDocument()
  })

  it('calls removeContactUserLimit when Reset to default is clicked in modal', async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(() => Object.assign(mockMutate, { withOptimisticUpdate: vi.fn() }))

    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset to default/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: 'tok', userId: 'u1' }))
    })
    expect(screen.queryByRole('heading', { name: /edit bob smith limits/i })).not.toBeInTheDocument()
  })

  it('calls setContactUserLimit when Save clicked on new-override modal (from search)', async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(() => Object.assign(mockMutate, { withOptimisticUpdate: vi.fn() }))

    const mockSearchResults = [{ _id: 'u2', name: 'Alice Johnson' }]
    vi.mocked(useQuery).mockReturnValueOnce(mockRows).mockReturnValueOnce(mockSearchResults)

    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/search contact users/i), {
      target: { value: 'alice' }
    })
    fireEvent.click(screen.getByText('Alice Johnson'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: 'tok',
          userId: 'u2'
        })
      )
    })
  })
})
```

- [ ] **Step 3.3: Run PlanLimitsTab tests**

```bash
cd app && npx vitest run src/components/PlanLimitsTab.test.tsx
```

Expected: all tests PASS. If any fail, investigate and fix.

- [ ] **Step 3.4: Run the full test suite**

```bash
cd app && npm test
```

Expected: all tests pass. Fix any regressions.

- [ ] **Step 3.5: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3.6: Commit**

```bash
git add app/src/components/PlanLimitsTab.test.tsx
git commit -m "test(admin): update PlanLimitsTab tests for read-only tier rows and search form"
```

---

## Done Criteria

- [ ] `convex/admin.ts` exports `searchContactUsers`
- [ ] Tier default rows in `PlanLimitsTab` have no Edit button (read-only)
- [ ] Search input below table; typing shows matching contact users
- [ ] Clicking a search result opens modal pre-filled with contact tier defaults
- [ ] Modal title is "Add override for [name]" for new overrides, "Edit [name] limits" for existing
- [ ] "Reset to default" link only appears for existing overrides (not new ones)
- [ ] All tests pass; TypeScript clean
