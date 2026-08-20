# First-Post Onboarding Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a skippable "Share your best recent post" onboarding gate for brand-new users, and remove the
now-redundant "LinkedIn Identity" section from Settings.

**Architecture:** A new full-screen gate (`FirstPostPromptScreen`) slots into the existing `RequireAuth` gate chain
after the consent gate, driven by a single one-shot `users.firstPostPromptedAt` timestamp. The flag is set when the user
submits any post (server-side, inside `submitPost`) or clicks "I'll do this later". The gate reuses the existing
`PostComposer`.

**Tech Stack:** Convex (actions/mutations/schema), React + react-router, react-i18next, Vitest + @testing-library/react
(no user-event).

## Global Constraints

- **NEVER commit to git.** Save file changes only; Henriko makes all commits. (Overrides the writing-plans skill's
  `git commit` steps — there are none here.)
- **Convex CLI runs from repo root** with **pnpm** (never npm; never from inside `convex/`).
- **Copy (verbatim):** title = `Share your best recent post`; skip label = `I'll do this later`.
- **Gate order:** the first-post gate renders *after* `ConsentPromptScreen` in `RequireAuth`.
- **Schema change = widen only:** add a new optional field; no backfill/migration (pre-launch, disposable dev data). Do
  NOT reuse the deprecated `publicIdentifierPromptedAt` slot.
- **Keep `linkedinPublicIdentifier`** on `SettingsPage`'s `MeProfile` interface and in the Refresh-button disable
  logic — only the display *section* is removed.
- **Gate screens use `t()`** (Consent/Policy do); add keys to `en`, `pt`, `es`.
- **Docs are part of done:** update `docs/PLATFORM.md` in this same change.
- **Verify commands** (from repo root):
    - Convex typecheck: `pnpm --filter convex exec tsc --noEmit`
    - Convex tests: `pnpm --filter convex exec vitest run`
    - App typecheck: `pnpm --filter app exec tsc -b`
    - App tests: `pnpm --filter app exec vitest run`
    - Format: `pnpm exec prettier --write <changed files>`

---

### Task 1: Backend — flag field, two mutations, submit-path set

**Files:**

- Modify: `convex/schema.ts:72` (add field after `publicIdentifierPromptedAt`)
- Modify: `convex/users.ts` (add two mutations near the other user mutations)
- Modify: `convex/posts.ts:285` (set flag after successful upsert)
- Test: `convex/*` — no new unit test (thin DB patches; repo convention is pure-logic-only, and there is no pure
  function here). Verified via typecheck + existing suite.

**Interfaces:**

- Produces: `api.users.dismissFirstPostPrompt({ sessionToken })` → `Promise<null>` (public mutation, used by the gate's
  Skip button).
- Produces: `internal.users.markFirstPostPrompted({ userId })` → `Promise<null>` (internal, called from `submitPost`).
- Produces: `users.firstPostPromptedAt?: number` on the user doc (consumed by Task 2's gate).

- [ ] **Step 1: Add the schema field.** In `convex/schema.ts`, immediately after the `publicIdentifierPromptedAt` line
  (`:72`), add:

```ts
    // When the first-post onboarding step was resolved — set once, either by submitting any post
    // (server-side in posts.submitPost) or by skipping the prompt. Unset ⇒ show FirstPostPromptScreen.
    firstPostPromptedAt: v.optional(v.number()),
```

- [ ] **Step 2: Add the two mutations.** In `convex/users.ts`, after `setCommentLanguage` (`:330`), add. (`mutation`,
  `internalMutation`, `internal`, `requireAuth`, `v` are already imported — `setDerivedPublicIdentifier` uses them.)

```ts
// Public: mark the first-post onboarding step resolved when the user skips it ("I'll do this
// later"). Set-once — submitting any post sets the same flag server-side (markFirstPostPrompted).
export const dismissFirstPostPrompt = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (!user.firstPostPromptedAt) await ctx.db.patch(user._id, { firstPostPromptedAt: Date.now() })
  }
})

// Internal: called from posts.submitPost after a post is persisted, so posting (from the
// onboarding gate or the normal My Posts composer) also clears the first-post step. Set-once.
export const markFirstPostPrompted = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (user && !user.firstPostPromptedAt) await ctx.db.patch(userId, { firstPostPromptedAt: Date.now() })
  }
})
```

- [ ] **Step 3: Set the flag on submit.** In `convex/posts.ts`, right after the `if (!postId) { throw ... }` block
  (`:285`) and before the AI-reaction scheduler (`:289`), add:

```ts
    // The first successful submission clears the first-post onboarding step (set-once), whether the
    // post came from the onboarding gate or the normal My Posts composer.
    await ctx.runMutation(internal.users.markFirstPostPrompted, { userId: user._id })
```

- [ ] **Step 4: Verify.** Run `pnpm --filter convex exec tsc --noEmit` (expect OK — new
  `internal.users.markFirstPostPrompted` resolves because it's an added export on an existing module) and
  `pnpm --filter convex exec vitest run` (expect the existing suite still green — 249 tests).

- [ ] **Step 5: Format.** `pnpm exec prettier --write convex/schema.ts convex/users.ts convex/posts.ts`. **Do not
  commit.**

---

### Task 2: Frontend — the gate screen + wiring

**Files:**

- Create: `app/src/components/FirstPostPromptScreen.tsx`
- Modify: `app/src/App.tsx` (import + gate line after `:55`)

**Interfaces:**

- Consumes: `api.posts.submitPost`, `api.users.dismissFirstPostPrompt` (Task 1), `PostComposer`, `BrandMark`.
- Consumes: `me.firstPostPromptedAt` (Task 1 schema field, present on `getMe`).
- Produces: default export `FirstPostPromptScreen`.

- [ ] **Step 1: Create the component.** `app/src/components/FirstPostPromptScreen.tsx`:

```tsx
import { useAction, useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import BrandMark from '@/components/BrandMark'
import PostComposer from './PostComposer'

// One-time first-login nudge to share the member's first post. Shown by RequireAuth until
// users.firstPostPromptedAt is set — which happens when they submit any post (server-side in
// submitPost) or click "I'll do this later". Skippable: it never blocks entry to the app.
export default function FirstPostPromptScreen() {
  const { t } = useTranslation()
  const submitPost = useAction(api.posts.submitPost)
  const dismiss = useMutation(api.users.dismissFirstPostPrompt)

  async function handleSubmit(postUrl: string) {
    const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
    if (!sessionToken) throw new Error('Not signed in')
    await submitPost({ sessionToken, postUrl })
    // submitPost set firstPostPromptedAt server-side; reload drops the gate → lands on /feed.
    window.location.reload()
  }

  async function handleSkip() {
    const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
    if (!sessionToken) return
    await dismiss({ sessionToken })
    window.location.reload()
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-md rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">{t('onboarding.firstPost.title')}</h1>
        <p className="text-muted-foreground mt-2 mb-4 text-sm leading-relaxed">{t('onboarding.firstPost.intro')}</p>
        <PostComposer onSubmit={handleSubmit} />
        <button
          type="button"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground mx-auto block text-xs underline"
        >
          {t('onboarding.firstPost.skip')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into the gate chain.** In `app/src/App.tsx`, add the import near the other gate screens (after
  `:20`):

```tsx
import FirstPostPromptScreen from './components/FirstPostPromptScreen'
```

and add the gate line immediately after the consent gate (`:55`):

```tsx
  if (!me.consentPromptedAt) return <ConsentPromptScreen />

  if (!me.firstPostPromptedAt) return <FirstPostPromptScreen />
```

- [ ] **Step 3: Verify.** `pnpm --filter app exec tsc -b` (expect OK — `me.firstPostPromptedAt` is typed via the new
  schema field).

- [ ] **Step 4: Format.** `pnpm exec prettier --write app/src/components/FirstPostPromptScreen.tsx app/src/App.tsx`.
  **Do not commit.**

---

### Task 3: i18n — swap the dead namespace for `firstPost`

**Files:**

- Modify: `app/src/i18n/locales/en.json` (`onboarding` block, `:28-38`)
- Modify: `app/src/i18n/locales/pt.json` (`onboarding` block, `:28`)
- Modify: `app/src/i18n/locales/es.json` (`onboarding` block)

The old `onboarding.linkedinIdentifier.*` keys are dead (the screen that used them was deleted). Replace the whole
`linkedinIdentifier` object with a `firstPost` object in each locale.

- [ ] **Step 1: en.json.** Replace the `onboarding` block contents:

```json
  "onboarding": {
    "firstPost": {
      "title": "Share your best recent post",
      "intro": "Add one of your LinkedIn posts to bring your feed to life and let others engage with it. You can add more anytime.",
      "skip": "I'll do this later"
    }
  },
```

- [ ] **Step 2: pt.json.** Same shape, translated:

```json
  "onboarding": {
    "firstPost": {
      "title": "Compartilhe seu melhor post recente",
      "intro": "Adicione um dos seus posts do LinkedIn para dar vida ao seu feed e permitir que outras pessoas interajam com ele. Você pode adicionar mais quando quiser.",
      "skip": "Faço isso mais tarde"
    }
  },
```

- [ ] **Step 3: es.json.** Same shape, translated:

```json
  "onboarding": {
    "firstPost": {
      "title": "Comparte tu mejor publicación reciente",
      "intro": "Añade una de tus publicaciones de LinkedIn para dar vida a tu feed y que otras personas puedan interactuar con ella. Puedes añadir más cuando quieras.",
      "skip": "Lo haré más tarde"
    }
  },
```

- [ ] **Step 4: Verify no dangling refs.** Grep the app for `linkedinIdentifier` — expect **zero** hits (the screen
  consuming it was already deleted): `rg "linkedinIdentifier" app/src`.

- [ ] **Step 5: Format.**
  `pnpm exec prettier --write app/src/i18n/locales/en.json app/src/i18n/locales/pt.json app/src/i18n/locales/es.json`.
  **Do not commit.**

---

### Task 4: Settings — remove the LinkedIn Identity section

**Files:**

- Modify: `app/src/pages/SettingsPage.tsx:222-243` (delete the section)

- [ ] **Step 1: Delete the section.** Remove the entire block from the `{/* LinkedIn identity … */}` comment through the
  closing `</section>` (currently `:222-243`). Leave the surrounding profile and AI-comments sections untouched. Do
  **not** touch the `MeProfile` interface's `linkedinPublicIdentifier` field or the Refresh button's
  `disabled={refreshing || !me.linkedinPublicIdentifier}` (`:212`).

- [ ] **Step 2: Verify.** `pnpm --filter app exec tsc -b` (expect OK — `me.linkedinPublicIdentifier` is still referenced
  at `:212`, so no unused-field churn). If a `SettingsPage.test.tsx` exists, run it and confirm no assertion referenced
  the removed section.

- [ ] **Step 3: Format.** `pnpm exec prettier --write app/src/pages/SettingsPage.tsx`. **Do not commit.**

---

### Task 5: Test — FirstPostPromptScreen

**Files:**

- Create: `app/src/components/FirstPostPromptScreen.test.tsx`

Mirrors `MyPostsPage.test.tsx`: mock `../convex` and `convex/react`. Uses `fireEvent` (no `user-event` in the repo).
Real i18n loads `en.json` in tests, so English assertions resolve. Both handlers call `window.location.reload()`,
unimplemented in jsdom — stub it.

- [ ] **Step 1: Write the test.**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FirstPostPromptScreen from './FirstPostPromptScreen'

vi.mock('../convex', () => ({
  api: {
    posts: { submitPost: 'posts.submitPost' },
    users: { dismissFirstPostPrompt: 'users.dismissFirstPostPrompt' }
  }
}))

const mockDismiss = vi.fn(async () => {})
vi.mock('convex/react', () => ({
  useAction: vi.fn(() => async () => {}),
  useMutation: vi.fn(() => mockDismiss)
}))

describe('FirstPostPromptScreen', () => {
  beforeEach(() => {
    mockDismiss.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
    // jsdom has no navigation; stub reload so the skip/submit handlers don't throw.
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: vi.fn() } })
  })

  it('shows the first-post prompt and the composer', () => {
    render(<FirstPostPromptScreen />)
    expect(screen.getByText(/share your best recent post/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/linkedin\.com\/posts/i)).toBeInTheDocument()
  })

  it('fires the dismiss mutation when the user skips', async () => {
    render(<FirstPostPromptScreen />)
    fireEvent.click(screen.getByRole('button', { name: /i'll do this later/i }))
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledOnce())
  })
})
```

- [ ] **Step 2: Verify.** `pnpm --filter app exec vitest run FirstPostPromptScreen` (expect 2 passing). Then the full
  app suite `pnpm --filter app exec vitest run` — expect the new 2 pass and only the 3 **pre-existing** `cookies`/
  `theme` jsdom failures remain (untouched files).

- [ ] **Step 3: Format.** `pnpm exec prettier --write app/src/components/FirstPostPromptScreen.test.tsx`. **Do not
  commit.**

---

### Task 6: Docs — sync PLATFORM.md

**Files:**

- Modify: `docs/PLATFORM.md`

- [ ] **Step 1: Update each spot** (use the doc's "Maintaining This Document" mapping to confirm section numbers):
    1. **RequireAuth gate chain** section + its mermaid: add the `firstPostPromptedAt → FirstPostPromptScreen` step
       after the consent gate.
    2. **Components** section: add a `FirstPostPromptScreen` entry (skippable first-post onboarding nudge).
    3. **Data dictionary** (`users` table): add `firstPostPromptedAt` (set-once; when the first-post step was resolved).
    4. **Function table:** add `users.dismissFirstPostPrompt` (public) and `users.markFirstPostPrompted` (internal);
       note `posts.submitPost` now sets `firstPostPromptedAt`.
    5. **SettingsPage** description: the read-only "LinkedIn Identity" section was removed; the derived vanity is now
       internal-only (Apify seed).

- [ ] **Step 2: Format & verify.** `pnpm exec prettier --write docs/PLATFORM.md` if the repo formats docs (note: docs
  aren't guaranteed Prettier-clean repo-wide — match surrounding style, don't reflow the whole file). **Do not commit.**

---

### Final verification (run all from repo root)

- [ ] `pnpm --filter convex exec tsc --noEmit` → OK
- [ ] `pnpm --filter app exec tsc -b` → OK
- [ ] `pnpm --filter convex exec vitest run` → 249 pass (unchanged)
- [ ] `pnpm --filter app exec vitest run` → new 2 pass; only the 3 pre-existing `cookies`/`theme` failures remain
- [ ] Backlog: mark a new item done or note this feature (optional; not tracked by an existing B-item)
- [ ] **Do not commit — leave all changes for Henriko.**
