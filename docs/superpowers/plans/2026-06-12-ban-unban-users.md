# Ban / Unban Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a hard-lockout Ban/Unban for users, enforced centrally server-side and surfaced through a kebab menu in the admin Users tab plus a banned screen for the locked-out user.

**Architecture:** Four fields on the `users` doc record the ban. A single `requireAuth` chokepoint throws for banned users (covering every protected endpoint); `getMe` resolves the session *without* that throw and returns an `isBanned` signal so the client shows a banned screen instead of looping back to LinkedIn OAuth. Convex reactivity re-runs `getMe` the instant a ban is written, so no session bookkeeping is needed.

**Tech Stack:** Convex (custom LinkedIn-OAuth + session-token auth), React 19 + React Router 7, raw Tailwind. Tests: `vitest` with the project's pure-function convention on the convex side and `@testing-library/react` (mocking `convex/react`) on the app side.

**Conventions (match exactly):** no semicolons, single quotes, 2-space indent. Convex tests import **pure exported functions** (never mocked handlers) — see `convex/posts.test.ts`. App tests mirror `app/src/components/PlanLimitsTab.test.tsx`.

**Test commands (run from repo root):**
- Single convex file: `pnpm --filter convex exec vitest run <file>`
- All convex: `pnpm --filter convex test`
- Single app file: `pnpm --filter app exec vitest run <file>`
- All app: `pnpm --filter app test`

---

### Task 1: Schema & type fields

**Files:**
- Modify: `convex/schema.ts:31-32` (inside the `users` table, after `isAdmin`)
- Modify: `convex/convexTypes.ts:99-100` (inside `UserDoc`, after `isAdmin`)

> Setup/config change — no unit test (the fields are exercised by Tasks 2–4). Verified by the convex suite still compiling/passing.

- [ ] **Step 1: Add the four ban fields to the `users` table**

In `convex/schema.ts`, the `users` table currently ends with:

```ts
    // Admin flag — MUST only be set directly in the database.
    // All application code (upsertUser, setPublicIdentifier, etc.) must ignore this field.
    isAdmin: v.optional(v.boolean()),
    createdAt: v.number()
  })
```

Change it to:

```ts
    // Admin flag — MUST only be set directly in the database.
    // All application code (upsertUser, setPublicIdentifier, etc.) must ignore this field.
    isAdmin: v.optional(v.boolean()),
    // Ban state — set/cleared only by the admin banUser/unbanUser mutations.
    // bannedReason is user-visible (shown on the banned screen).
    isBanned: v.optional(v.boolean()),
    bannedAt: v.optional(v.number()),
    bannedBy: v.optional(v.id('users')),
    bannedReason: v.optional(v.string()),
    createdAt: v.number()
  })
```

(No new index — `isBanned` is read per-row, never queried as a set. No `sessions` change.)

- [ ] **Step 2: Mirror the fields on the `UserDoc` structural type**

In `convex/convexTypes.ts`, `UserDoc` currently has:

```ts
  linkedinPublicIdentifier?: string
  isAdmin?: boolean
  createdAt: number
}
```

Change to:

```ts
  linkedinPublicIdentifier?: string
  isAdmin?: boolean
  isBanned?: boolean
  bannedAt?: number
  bannedBy?: string
  bannedReason?: string
  createdAt: number
}
```

- [ ] **Step 3: Verify the convex suite still passes**

Run: `pnpm --filter convex test`
Expected: PASS (same green suite as before — proves the edits compile and break nothing).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/convexTypes.ts
git commit -m "feat(schema): add ban fields to users table"
```

---

### Task 2: Banned enforcement in `requireAuth` (`assertNotBanned`)

**Files:**
- Create: `convex/lib/auth.test.ts`
- Modify: `convex/lib/auth.ts`

This is the central chokepoint: every protected query/mutation/action calls `requireAuth`/`requireAuthAction`, so adding the banned check here blocks all of them. We extract a pure `assertNotBanned` (testable per project convention) and extract a non-throwing `resolveSession` (reused by `getMe` in Task 3).

- [ ] **Step 1: Write the failing test**

Create `convex/lib/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { assertNotBanned } from './auth'

describe('assertNotBanned', () => {
  it('does not throw for a user with no ban flag', () => {
    expect(() => assertNotBanned({})).not.toThrow()
    expect(() => assertNotBanned({ isBanned: false })).not.toThrow()
  })

  it('throws "Account suspended" for a banned user', () => {
    expect(() => assertNotBanned({ isBanned: true })).toThrow('Account suspended')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter convex exec vitest run lib/auth.test.ts`
Expected: FAIL — `assertNotBanned` is not exported.

- [ ] **Step 3: Add `resolveSession` + `assertNotBanned` and rewire `requireAuth`/`requireAuthAction`**

Replace the body of `convex/lib/auth.ts` (keep the file header comment block at the top) from the first `export` onward with:

```ts
/**
 * Resolves a session token to a user document WITHOUT enforcing ban state.
 * Returns null when the token is missing, expired, or invalid.
 * Used by getMe (which must distinguish "banned" from "logged out").
 */
export async function resolveSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined
): Promise<Doc<'users'> | null> {
  if (!sessionToken) return null

  const session = await (ctx as QueryCtx).db
    .query('sessions')
    .withIndex('by_token', q => q.eq('token', sessionToken))
    .unique()

  if (!session || session.expiresAt < Date.now()) return null

  const user = await (ctx as QueryCtx).db.get(session.userId)
  return user ?? null
}

/**
 * Throws if the user is banned. Pure guard — the single definition of "what a
 * ban blocks". Called by requireAuth/requireAuthAction so every protected
 * endpoint is covered automatically.
 */
export function assertNotBanned(user: { isBanned?: boolean }): void {
  if (user.isBanned) throw new Error('Account suspended')
}

/**
 * Resolves a session token to an authenticated, non-banned user document.
 * For use in queries and mutations (which have ctx.db access).
 * Throws "Unauthorized" if the token is missing/expired/invalid, or
 * "Account suspended" if the user is banned.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined
): Promise<Doc<'users'>> {
  const user = await resolveSession(ctx, sessionToken)
  if (!user) throw new Error('Unauthorized')
  assertNotBanned(user)
  return user
}

/**
 * Resolves a session token to an authenticated, non-banned user document (with tokens).
 * For use in actions (which must use ctx.runQuery instead of ctx.db).
 * Throws "Unauthorized" if the token is missing/expired/invalid, or
 * "Account suspended" if the user is banned.
 */
export async function requireAuthAction(ctx: ActionCtx, sessionToken: string | undefined): Promise<Doc<'users'>> {
  if (!sessionToken) throw new Error('Unauthorized')

  const session = await ctx.runQuery(internal.sessions.getByToken, { token: sessionToken })
  if (!session || session.expiresAt < Date.now()) {
    throw new Error('Unauthorized')
  }

  const user = await ctx.runQuery(internal.users.getWithTokens, { userId: session.userId })
  if (!user) throw new Error('Unauthorized')
  assertNotBanned(user)

  return user
}
```

(The imports at the top of the file — `ActionCtx, MutationCtx, QueryCtx`, `internal`, `Doc` — are unchanged and already present.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter convex exec vitest run lib/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full convex suite for regressions**

Run: `pnpm --filter convex test`
Expected: PASS (the `requireAuth` refactor preserves existing behavior for non-banned users).

- [ ] **Step 6: Commit**

```bash
git add convex/lib/auth.ts convex/lib/auth.test.ts
git commit -m "feat(auth): block banned users in requireAuth chokepoint"
```

---

### Task 3: `getMe` returns a banned signal (`toSafeMe`)

**Files:**
- Create: `convex/users.test.ts`
- Modify: `convex/users.ts:28-44` (`getMe`) and its imports (`convex/users.ts:5`)

`getMe` must NOT route through the throwing `requireAuth` (its `catch` would turn a ban into `null`, re-triggering the LinkedIn redirect loop). It uses `resolveSession` and a pure `toSafeMe` that strips tokens, conditionally re-adds `isAdmin`, and passes `isBanned`/`bannedReason` through to the client.

- [ ] **Step 1: Write the failing test**

Create `convex/users.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toSafeMe } from './users'
import type { UserDoc } from './convexTypes'

function makeUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: 'u1',
    _creationTime: 0,
    linkedinId: 'li1',
    name: 'Jordan Maxwell',
    tier: 'growth',
    subscriptionStatus: 'active',
    linkedinAccessToken: 'secret-access',
    linkedinRefreshToken: 'secret-refresh',
    tokenExpiresAt: 123,
    createdAt: 0,
    ...overrides
  } as UserDoc
}

describe('toSafeMe', () => {
  it('strips token fields and the raw isAdmin flag', () => {
    const safe = toSafeMe(makeUser({ isAdmin: true })) as Record<string, unknown>
    expect(safe.linkedinAccessToken).toBeUndefined()
    expect(safe.linkedinRefreshToken).toBeUndefined()
    expect(safe.tokenExpiresAt).toBeUndefined()
    expect(safe.name).toBe('Jordan Maxwell')
  })

  it('re-adds isAdmin: true only for admins', () => {
    expect((toSafeMe(makeUser({ isAdmin: true })) as Record<string, unknown>).isAdmin).toBe(true)
    expect((toSafeMe(makeUser({ isAdmin: false })) as Record<string, unknown>).isAdmin).toBeUndefined()
  })

  it('passes the ban signal through to the client', () => {
    const safe = toSafeMe(makeUser({ isBanned: true, bannedReason: 'Spam' })) as Record<string, unknown>
    expect(safe.isBanned).toBe(true)
    expect(safe.bannedReason).toBe('Spam')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter convex exec vitest run users.test.ts`
Expected: FAIL — `toSafeMe` is not exported.

- [ ] **Step 3: Add `toSafeMe` and rewrite `getMe`**

In `convex/users.ts`, update the import on line 5 from:

```ts
import { requireAuth } from './lib/auth'
```

to:

```ts
import { requireAuth, resolveSession } from './lib/auth'
```

Then replace the `getMe` query (lines 26-44) with:

```ts
// Pure: turns a full user doc into the safe client payload.
// Strips tokens + the raw isAdmin flag; re-adds isAdmin:true only for admins
// (needed by the frontend route guard); passes the ban signal through so the
// client can render the banned screen.
export function toSafeMe(user: UserDoc) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, isAdmin, ...safeUser } = user
  return isAdmin ? { ...safeUser, isAdmin: true as const } : safeUser
}

// Public: returns safe user profile — strips ALL token fields.
// Auth: resolves the session token server-side; never accepts a userId from the client.
// NOTE: resolves via resolveSession (not requireAuth) so a banned user gets an
// isBanned signal instead of null — otherwise the client would loop back to LinkedIn.
export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = (await resolveSession(ctx, sessionToken)) as UserDoc | null
    if (!user) return null
    return toSafeMe(user)
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter convex exec vitest run users.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/users.ts convex/users.test.ts
git commit -m "feat(users): getMe surfaces isBanned instead of null"
```

---

### Task 4: `banUser` / `unbanUser` mutations + `assertNotSelfBan`

**Files:**
- Modify: `convex/admin.test.ts` (append a describe block)
- Modify: `convex/admin.ts` (add guard + two mutations; extend `listUsers` map)

- [ ] **Step 1: Write the failing test**

Append to `convex/admin.test.ts`:

```ts
import { assertNotSelfBan } from './admin'

describe('assertNotSelfBan', () => {
  it('throws when an admin targets their own id', () => {
    expect(() => assertNotSelfBan('admin1', 'admin1')).toThrow("can't ban yourself")
  })

  it('does not throw when targeting a different user', () => {
    expect(() => assertNotSelfBan('admin1', 'user2')).not.toThrow()
  })
})
```

(Also add `assertNotSelfBan` to the existing top import — change line 2 `import { validateLimitArgs } from './admin'` to `import { validateLimitArgs, assertNotSelfBan } from './admin'`, and delete the duplicate `import { assertNotSelfBan } from './admin'` line above if your editor added it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter convex exec vitest run admin.test.ts`
Expected: FAIL — `assertNotSelfBan` is not exported.

- [ ] **Step 3: Add the guard, the mutations, and expose `isBanned` in `listUsers`**

In `convex/admin.ts`, add the guard just below `assertAdmin` (after line 13):

```ts
// Pure guardrail: an admin may not ban their own account. (Banning OTHER admins
// is intentionally allowed — self-ban being blocked guarantees at least one admin
// always remains.)
export function assertNotSelfBan(adminId: string, targetId: string): void {
  if (adminId === targetId) throw new Error("You can't ban yourself")
}
```

In `listUsers` (the `users.map` around lines 223-230), add `isBanned`:

```ts
    return users.map(u => ({
      _id: u._id,
      name: u.name,
      headline: u.headline,
      tier: u.tier,
      subscriptionStatus: u.subscriptionStatus,
      isBanned: u.isBanned,
      createdAt: u._creationTime,
    }))
```

At the end of `convex/admin.ts` (before the `// ─── Internal functions` divider on line 286), add the two mutations:

```ts
// Bans a user — hard lockout enforced centrally in requireAuth. Admin-only.
// reason is optional and user-visible (shown on the banned screen).
export const banUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, userId, reason }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    assertNotSelfBan(admin._id, userId)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')

    const trimmed = reason?.trim()
    await ctx.db.patch(userId, {
      isBanned: true,
      bannedAt: Date.now(),
      bannedBy: admin._id,
      ...(trimmed ? { bannedReason: trimmed } : {}),
    })
  },
})

// Unbans a user — clears all ban fields. Admin-only.
export const unbanUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')

    await ctx.db.patch(userId, {
      isBanned: false,
      bannedAt: undefined,
      bannedBy: undefined,
      bannedReason: undefined,
    })
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter convex exec vitest run admin.test.ts`
Expected: PASS (both `validateLimitArgs` and `assertNotSelfBan` blocks green).

- [ ] **Step 5: Commit**

```bash
git add convex/admin.ts convex/admin.test.ts
git commit -m "feat(admin): add banUser/unbanUser mutations and self-ban guard"
```

---

### Task 5: Generic `Modal` shell

**Files:**
- Create: `app/src/components/Modal.tsx`
- Create: `app/src/components/Modal.test.tsx`

Reusable overlay used by the ban dialog and the unban confirm. Closes on backdrop click and Escape.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/Modal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Modal from './Modal'

describe('Modal', () => {
  it('renders its children', () => {
    render(<Modal onClose={() => {}}><p>Hello</p></Modal>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose}><p>Body</p></Modal>)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the card body is clicked', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose}><p>Body</p></Modal>)
    fireEvent.click(screen.getByText('Body'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose}><p>Body</p></Modal>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter app exec vitest run Modal.test.tsx`
Expected: FAIL — cannot find `./Modal`.

- [ ] **Step 3: Implement `Modal`**

Create `app/src/components/Modal.tsx`:

```tsx
import { type ReactNode, useEffect } from 'react'

type Props = {
  onClose: () => void
  children: ReactNode
}

export default function Modal({ onClose, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      data-testid="modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl"
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter app exec vitest run Modal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Modal.tsx app/src/components/Modal.test.tsx
git commit -m "feat(ui): add generic Modal shell"
```

---

### Task 6: `RowActionsMenu` kebab

**Files:**
- Create: `app/src/components/RowActionsMenu.tsx`
- Create: `app/src/components/RowActionsMenu.test.tsx`

A `···` button that toggles a dropdown of actions and closes on outside click / Escape.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/RowActionsMenu.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import RowActionsMenu from './RowActionsMenu'

describe('RowActionsMenu', () => {
  it('hides menu items until the kebab is clicked', () => {
    render(<RowActionsMenu label="Actions for Jordan" items={[{ label: 'Ban user…', onClick: () => {} }]} />)
    expect(screen.queryByText('Ban user…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Jordan' }))
    expect(screen.getByText('Ban user…')).toBeInTheDocument()
  })

  it('fires the item callback and closes the menu', () => {
    const onClick = vi.fn()
    render(<RowActionsMenu label="Actions" items={[{ label: 'Unban', onClick }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Unban'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Unban')).not.toBeInTheDocument()
  })

  it('closes when clicking outside', () => {
    render(<RowActionsMenu label="Actions" items={[{ label: 'Ban user…', onClick: () => {} }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByText('Ban user…')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Ban user…')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter app exec vitest run RowActionsMenu.test.tsx`
Expected: FAIL — cannot find `./RowActionsMenu`.

- [ ] **Step 3: Implement `RowActionsMenu`**

Create `app/src/components/RowActionsMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

export type RowAction = {
  label: string
  onClick: () => void
  danger?: boolean
}

type Props = {
  label: string
  items: RowAction[]
}

export default function RowActionsMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(o => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
      >
        <span className="text-base leading-none tracking-widest">···</span>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                item.danger ? 'text-red-600' : 'text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter app exec vitest run RowActionsMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/RowActionsMenu.tsx app/src/components/RowActionsMenu.test.tsx
git commit -m "feat(ui): add RowActionsMenu kebab"
```

---

### Task 7: `BanUserDialog` modal

**Files:**
- Create: `app/src/components/BanUserDialog.tsx`
- Create: `app/src/components/BanUserDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/BanUserDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import BanUserDialog from './BanUserDialog'

describe('BanUserDialog', () => {
  it('shows the target name and a suspension warning', () => {
    render(<BanUserDialog userName="Priya Nayar" pending={false} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/ban priya nayar\?/i)).toBeInTheDocument()
    expect(screen.getByText(/signed out immediately/i)).toBeInTheDocument()
  })

  it('confirms with the trimmed reason text', () => {
    const onConfirm = vi.fn()
    render(<BanUserDialog userName="Priya Nayar" pending={false} onConfirm={onConfirm} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/spam/i), { target: { value: '  TOS violation  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^ban user$/i }))
    expect(onConfirm).toHaveBeenCalledWith('TOS violation')
  })

  it('confirms with an empty string when no reason is typed', () => {
    const onConfirm = vi.fn()
    render(<BanUserDialog userName="Priya Nayar" pending={false} onConfirm={onConfirm} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^ban user$/i }))
    expect(onConfirm).toHaveBeenCalledWith('')
  })

  it('calls onCancel from the Cancel button', () => {
    const onCancel = vi.fn()
    render(<BanUserDialog userName="Priya Nayar" pending={false} onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter app exec vitest run BanUserDialog.test.tsx`
Expected: FAIL — cannot find `./BanUserDialog`.

- [ ] **Step 3: Implement `BanUserDialog`**

Create `app/src/components/BanUserDialog.tsx`:

```tsx
import { useState } from 'react'
import Modal from './Modal'

type Props = {
  userName: string
  pending: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export default function BanUserDialog({ userName, pending, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('')

  return (
    <Modal onClose={onCancel}>
      <h2 className="text-base font-semibold text-slate-900">Ban {userName}?</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        They'll be signed out immediately and blocked from the app until an admin unbans them.
      </p>

      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Reason (optional — shown to the user)
      </label>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={2}
        placeholder="Spam / repeated TOS violations…"
        className="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onConfirm(reason.trim())}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? '…' : 'Ban user'}
        </button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter app exec vitest run BanUserDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/BanUserDialog.tsx app/src/components/BanUserDialog.test.tsx
git commit -m "feat(ui): add BanUserDialog modal"
```

---

### Task 8: `BannedScreen`

**Files:**
- Create: `app/src/components/BannedScreen.tsx`
- Create: `app/src/components/BannedScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/BannedScreen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import BannedScreen from './BannedScreen'

describe('BannedScreen', () => {
  it('shows the suspension heading and a support mailto link', () => {
    render(<BannedScreen />)
    expect(screen.getByText(/account has been suspended/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /contact support/i })
    expect(link).toHaveAttribute('href', 'mailto:contact@email.com')
  })

  it('shows the reason block when a reason is provided', () => {
    render(<BannedScreen reason="Repeated TOS violations" />)
    expect(screen.getByText('Repeated TOS violations')).toBeInTheDocument()
  })

  it('omits the reason block when no reason is given', () => {
    render(<BannedScreen />)
    expect(screen.queryByText(/^reason$/i)).not.toBeInTheDocument()
  })

  it('clears the session token on sign out', () => {
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    render(<BannedScreen />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(remove).toHaveBeenCalledWith('sessionToken')
    remove.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter app exec vitest run BannedScreen.test.tsx`
Expected: FAIL — cannot find `./BannedScreen`.

- [ ] **Step 3: Implement `BannedScreen`**

Create `app/src/components/BannedScreen.tsx`:

```tsx
const SUPPORT_EMAIL = 'contact@email.com' // TODO: replace with the real support address

type Props = {
  reason?: string
}

function handleSignOut() {
  sessionStorage.removeItem('sessionToken')
  window.location.assign('/')
}

export default function BannedScreen({ reason }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-3 flex items-center gap-2 text-red-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-wider">Account suspended</span>
        </div>

        <h1 className="text-lg font-bold text-slate-900">Your account has been suspended</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          An administrator has revoked your access to this app.
        </p>

        {reason && (
          <div className="mt-4 rounded-r-md border-l-[3px] border-red-500 bg-red-50 px-3 py-2 text-sm text-slate-700">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reason</span>
            <p className="mt-0.5">{reason}</p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Contact support
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter app exec vitest run BannedScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/BannedScreen.tsx app/src/components/BannedScreen.test.tsx
git commit -m "feat(ui): add BannedScreen"
```

---

### Task 9: Integrate ban/unban into `UsersTab`

**Files:**
- Create: `app/src/components/UsersTab.test.tsx`
- Modify: `app/src/components/UsersTab.tsx`

Replace the inline action cell with the kebab; add a "Banned" badge; wire the ban dialog and an inline unban confirm to the new mutations.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/UsersTab.test.tsx` (mirrors `PlanLimitsTab.test.tsx`):

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useQuery, useMutation } from 'convex/react'

const mockUsers = [
  { _id: 'u1', name: 'Jordan Maxwell', headline: 'Growth marketer', tier: 'growth', subscriptionStatus: 'active', isBanned: false, createdAt: 0 },
  { _id: 'u2', name: 'Priya Nayar', headline: 'Founder', tier: 'starter', subscriptionStatus: 'trialing', isBanned: true, createdAt: 0 },
]

let mockBan: ReturnType<typeof vi.fn>
let mockUnban: ReturnType<typeof vi.fn>
let mockSetTier: ReturnType<typeof vi.fn>

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockUsers),
  useMutation: vi.fn(),
}))

import UsersTab from './UsersTab'

beforeEach(() => {
  mockBan = vi.fn().mockResolvedValue(undefined)
  mockUnban = vi.fn().mockResolvedValue(undefined)
  mockSetTier = vi.fn().mockResolvedValue(undefined)
  // UsersTab calls useMutation in source order: setUserTier, banUser, unbanUser
  let n = 0
  vi.mocked(useMutation).mockImplementation(() => {
    n++
    return (n === 1 ? mockSetTier : n === 2 ? mockBan : mockUnban) as never
  })
  vi.mocked(useQuery).mockReturnValue(mockUsers)
})

describe('UsersTab — ban/unban', () => {
  it('shows a Banned badge for banned users only', () => {
    render(<UsersTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByText('Banned')).toBeInTheDocument()
  })

  it('offers "Ban user…" for an active user and calls banUser with the reason', async () => {
    render(<UsersTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    fireEvent.click(screen.getByText('Ban user…'))
    fireEvent.change(screen.getByPlaceholderText(/spam/i), { target: { value: 'Spam' } })
    fireEvent.click(screen.getByRole('button', { name: /^ban user$/i }))
    await waitFor(() => {
      expect(mockBan).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1', reason: 'Spam' })
    })
  })

  it('offers "Unban" for a banned user and calls unbanUser after confirm', async () => {
    render(<UsersTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /actions for priya nayar/i }))
    fireEvent.click(screen.getByText('Unban'))
    fireEvent.click(screen.getByRole('button', { name: /^unban$/i }))
    await waitFor(() => {
      expect(mockUnban).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u2' })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter app exec vitest run UsersTab.test.tsx`
Expected: FAIL — current `UsersTab` has no kebab/badge/ban wiring.

- [ ] **Step 3: Rewrite `UsersTab` to add the kebab, badge, dialog, and unban confirm**

Replace the entire contents of `app/src/components/UsersTab.tsx` with:

```tsx
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'
import BanUserDialog from './BanUserDialog'
import Modal from './Modal'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'

type Tier = 'starter' | 'growth' | 'pro' | 'contact'

type UserRow = {
  _id: Id<'users'>
  name: string
  headline?: string
  tier?: Tier
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
  isBanned?: boolean
  createdAt: number
}

type TierFilter = Tier | 'none' | 'all'

const TIER_COLOURS: Record<Tier, string> = {
  starter: 'bg-slate-100 text-slate-600',
  growth: 'bg-blue-100 text-blue-700',
  pro: 'bg-green-100 text-green-700',
  contact: 'bg-purple-100 text-purple-700',
}

const STATUS_COLOURS: Record<UserRow['subscriptionStatus'], string> = {
  active: 'text-green-600',
  trialing: 'text-blue-600',
  canceled: 'text-slate-400',
  past_due: 'text-red-500',
  none: 'text-slate-400',
}

const FILTER_LABELS: { value: TierFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'contact', label: 'Contact' },
  { value: 'pro', label: 'Pro' },
  { value: 'growth', label: 'Growth' },
  { value: 'starter', label: 'Starter' },
  { value: 'none', label: 'No Tier' },
]

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

export default function UsersTab({ sessionToken, isAdmin }: Props) {
  const users = useQuery(
    api.admin.listUsers,
    sessionToken && isAdmin ? { sessionToken } : 'skip'
  ) as UserRow[] | undefined

  const setUserTier = useMutation(api.admin.setUserTier)
  const banUser = useMutation(api.admin.banUser)
  const unbanUser = useMutation(api.admin.unbanUser)

  const [filter, setFilter] = useState<TierFilter>('all')
  const [pendingId, setPendingId] = useState<Id<'users'> | null>(null)
  const [nameSearch, setNameSearch] = useState('')
  const [banTarget, setBanTarget] = useState<UserRow | null>(null)
  const [unbanTarget, setUnbanTarget] = useState<UserRow | null>(null)

  if (users === undefined) {
    return <LoadingSpinner />
  }

  const filtered = users.filter(u => {
    const matchesTier =
      filter === 'all' ||
      (filter === 'none' ? !u.tier : u.tier === filter)
    const matchesName = !nameSearch || u.name.toLowerCase().includes(nameSearch.toLowerCase())
    return matchesTier && matchesName
  })

  async function handleSetContact(userId: Id<'users'>) {
    if (!sessionToken) return
    setPendingId(userId)
    try {
      await setUserTier({ sessionToken, userId, tier: 'contact' })
    } finally {
      setPendingId(null)
    }
  }

  async function handleBan(reason: string) {
    if (!sessionToken || !banTarget) return
    setPendingId(banTarget._id)
    try {
      await banUser({ sessionToken, userId: banTarget._id, reason })
      setBanTarget(null)
    } finally {
      setPendingId(null)
    }
  }

  async function handleUnban() {
    if (!sessionToken || !unbanTarget) return
    setPendingId(unbanTarget._id)
    try {
      await unbanUser({ sessionToken, userId: unbanTarget._id })
      setUnbanTarget(null)
    } finally {
      setPendingId(null)
    }
  }

  function actionsFor(user: UserRow): RowAction[] {
    const items: RowAction[] = []
    if (user.tier !== 'contact') {
      items.push({ label: 'Set to Contact', onClick: () => void handleSetContact(user._id) })
    }
    if (user.isBanned) {
      items.push({ label: 'Unban', onClick: () => setUnbanTarget(user) })
    } else {
      items.push({ label: 'Ban user…', danger: true, onClick: () => setBanTarget(user) })
    }
    return items
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTER_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name..."
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none sm:w-48"
        />
      </div>

      <p className="mb-2 text-xs text-slate-400">
        {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        {filter !== 'all' && ` · filtered to ${filter === 'none' ? 'no tier' : filter}`}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_100px_90px_56px] border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div>Name</div>
          <div>Tier</div>
          <div>Status</div>
          <div></div>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No users match this filter.
          </div>
        )}

        {filtered.map(user => (
          <div
            key={user._id}
            className="grid grid-cols-[1fr_100px_90px_56px] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
          >
            {/* Name + headline */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-800">{user.name}</span>
                {user.isBanned && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                    Banned
                  </span>
                )}
              </div>
              {user.headline && (
                <div className="truncate text-xs text-slate-400">{user.headline}</div>
              )}
            </div>

            {/* Tier badge */}
            <div>
              {user.tier ? (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLOURS[user.tier]}`}>
                  {user.tier}
                </span>
              ) : (
                <span className="text-xs text-slate-300">—</span>
              )}
            </div>

            {/* Subscription status */}
            <div className={`text-xs font-medium capitalize ${STATUS_COLOURS[user.subscriptionStatus]}`}>
              {user.subscriptionStatus}
            </div>

            {/* Row actions */}
            <div className="flex justify-end">
              <RowActionsMenu label={`Actions for ${user.name}`} items={actionsFor(user)} />
            </div>
          </div>
        ))}
      </div>

      {/* Ban dialog */}
      {banTarget && (
        <BanUserDialog
          userName={banTarget.name}
          pending={pendingId === banTarget._id}
          onConfirm={reason => void handleBan(reason)}
          onCancel={() => setBanTarget(null)}
        />
      )}

      {/* Unban confirm */}
      {unbanTarget && (
        <Modal onClose={() => setUnbanTarget(null)}>
          <h2 className="text-base font-semibold text-slate-900">Unban {unbanTarget.name}?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            They'll regain access to the app immediately.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUnbanTarget(null)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pendingId === unbanTarget._id}
              onClick={() => void handleUnban()}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {pendingId === unbanTarget._id ? '…' : 'Unban'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter app exec vitest run UsersTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/UsersTab.tsx app/src/components/UsersTab.test.tsx
git commit -m "feat(admin): kebab ban/unban actions in UsersTab"
```

---

### Task 10: Render the banned branch in `RequireAuth`

**Files:**
- Modify: `app/src/App.tsx:1-36`

Integration wiring (a route guard that reads the live `getMe` result). Verified by `tsc` + the full app suite + manual smoke, since the redirect/`useQuery` guard isn't a unit-test target in this codebase.

- [ ] **Step 1: Add the import**

In `app/src/App.tsx`, after the existing component imports (after line 12 `import LoadingSpinner from './components/LoadingSpinner'`), add:

```tsx
import BannedScreen from './components/BannedScreen'
```

- [ ] **Step 2: Add the banned branch to `RequireAuth`**

Replace the `RequireAuth` function (lines 17-36) with:

```tsx
function RequireAuth({ children }: { children: ReactNode }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })

  useEffect(() => {
    if (me === null) {
      // Redirect directly to LinkedIn auth
      window.location.href = AUTH_URL
    }
  }, [me])

  if (me === undefined || me === null) return <LoadingSpinner />

  if (me.isBanned) return <BannedScreen reason={me.bannedReason ?? undefined} />

  return (
    <>
      <AppNav />
      {children}
    </>
  )
}
```

- [ ] **Step 3: Regenerate Convex types, then typecheck the app**

Run: `npx convex codegen`
Then run: `pnpm --filter app exec tsc --noEmit`
Expected: PASS. `npx convex codegen` refreshes `convex/_generated` so `getMe`'s new return type (now carrying `isBanned`/`bannedReason` via `toSafeMe` → `UserDoc`) is visible to the app. This confirms `me.isBanned` / `me.bannedReason` typecheck. If `tsc` reports them missing, the codegen step didn't run or recheck Task 1 Step 2 and Task 3 Step 3.

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(auth): show BannedScreen for banned users in RequireAuth"
```

---

### Task 11: Full regression — tests, typecheck, lint

**Files:** none (verification only)

- [ ] **Step 1: Run the full convex suite**

Run: `pnpm --filter convex test`
Expected: PASS (includes `lib/auth.test.ts`, `users.test.ts`, `admin.test.ts`).

- [ ] **Step 2: Run the full app suite**

Run: `pnpm --filter app test`
Expected: PASS (new component tests + existing `AdminPage.test.tsx`, `PlanLimitsTab.test.tsx`, etc.). If `AdminPage.test.tsx` regressed from the UsersTab changes, fix the assertions there to match the kebab.

- [ ] **Step 3: Typecheck the app (regenerate Convex types first if not already done)**

Run: `npx convex codegen` then `pnpm --filter app exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS (0 warnings — the repo lints with `--max-warnings 0`). Fix any unused-import or hook-deps warnings introduced.

- [ ] **Step 5: Manual smoke (optional but recommended)**

With `npx convex dev` + the app running: as an admin, open `/admin` → Users → `···` → Ban a test user with a reason; confirm the user's open session flips to the banned screen showing the reason; `···` → Unban → confirm access returns. Verify self-ban is rejected (ban yourself → error toast / no-op).

- [ ] **Step 6: Final commit (only if Step 2/4 required fixes)**

```bash
git add -A
git commit -m "test: fix regressions from ban/unban integration"
```

---

## Notes for the executor

- **Convex test idiom:** import the **pure exported function** under test (`assertNotBanned`, `toSafeMe`, `assertNotSelfBan`) — never try to invoke a `query`/`mutation` wrapper. This is a hard project convention (`convex/posts.test.ts` documents why).
- **No session deletion:** banning relies on Convex reactivity re-running `getMe` for the live client. Do not add `sessions` deletion — it's intentionally omitted.
- **Style:** no semicolons, single quotes, 2-space indent. `pnpm lint` enforces zero warnings.
- **Support email** `contact@email.com` is a placeholder (`app/src/components/BannedScreen.tsx`) — swap when the real address is known.
