# Privacy & Compliance — Phase 3b: Consent UI + Re-consent + Cookies (Frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans. Steps use checkbox (`- [ ]`) syntax.

> ⚠️ **DO NOT COMMIT TO GIT.** The owner commits. Every task ends in a **Checkpoint (no commit)**. (Per `CLAUDE.md`.)

> ⚠️ **Prerequisite:** Phases 1–3a in the tree. Runtime needs `pnpm dev:convex` so `api.privacy.consent.*`
> resolves; app tests mock `../convex`, so they don't. The **landing site has no unit-test setup** —
> landing tasks verify via `pnpm lint` + `pnpm --filter landing build` (tsc/next), not Vitest.

> **Plan 3b of the program.** Frontend for consent. Phase 4 = legal/transparency docs (privacy/terms
> rewrite, ROPA, sub-processors, breach runbook, DPA, age affirmation).

**Goal:** The user-facing consent layer — **consent toggles** (marketing/analytics, off by default) in
the Privacy & Data page, a **re-consent prompt** when the privacy policy version changes, and the
**cookie notice + `/cookies` policy page** on the landing site.

**Architecture:** App: a self-contained `ConsentToggles` component (reads `getConsents`, writes
`recordConsent`) rendered in the existing `PrivacyDataPage`; a `PolicyUpdateScreen` shown by a new
`RequireAuth` branch when `me.acknowledgedPolicyVersion !== POLICY_VERSION` (→ `acknowledgePolicy`).
Landing (Next.js, hardcoded content, no i18n): a `/cookies` page mirroring the existing `/privacy`
page, and a dismissible `CookieNotice` client component in the root layout.

**Tech Stack:** React 19 + `convex/react` + react-i18next + Vitest/RTL (app); Next.js 15 (landing,
lint/build only).

**Spec:** `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md` §4.1 (consent toggles),
§4.5 (re-consent), §4.2 (cookies). **Backend (Phase 3a):** `api.privacy.consent.getConsents`
(query → `{marketing?:boolean, analytics?:boolean}|null`), `api.privacy.consent.recordConsent`
(mutation `{sessionToken, purpose, granted}`), `api.privacy.consent.acknowledgePolicy` (mutation
`{sessionToken}`). `POLICY_VERSION` from `convex/lib/policy`. `getMe` exposes `acknowledgedPolicyVersion`.

## Conventions

- App component tests: `vi.mock('convex/react')` (keyed off ref strings) + `vi.mock('../convex')` +
  `vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k)=>k }) }))`. No `any` in source.
- The app imports cross-package values from `convex/` (e.g. `SettingsPage` imports
  `../../../convex/lib/profileOptions`) — so import `POLICY_VERSION` from `../../../convex/lib/policy`.
- Landing: hardcoded English (no i18n), Tailwind `ink/cream/gold` palette (see existing
  `landing/app/privacy/page.tsx`). Client components need `'use client'`.
- Test commands: `pnpm --filter app test`; `pnpm --filter landing build`; lint `pnpm lint`.

---

## File Structure

| File                                                        | Responsibility                                                       |
|-------------------------------------------------------------|----------------------------------------------------------------------|
| `app/src/components/ConsentToggles.tsx` (create) + test     | marketing/analytics consent toggles (getConsents / recordConsent)    |
| `app/src/pages/PrivacyDataPage.tsx` (modify)                | render `<ConsentToggles />`; `PrivacyDataPage.test.tsx` mock updated |
| `app/src/components/PolicyUpdateScreen.tsx` (create) + test | re-consent prompt (acknowledgePolicy)                                |
| `app/src/App.tsx` (modify)                                  | `RequireAuth` re-consent interception                                |
| `app/src/i18n/locales/{en,pt,es}.json` (modify)             | `privacy.consent.*` + `privacy.policyUpdate.*` keys                  |
| `landing/app/cookies/page.tsx` (create)                     | Cookie Policy page                                                   |
| `landing/components/CookieNotice.tsx` (create)              | dismissible first-visit notice                                       |
| `landing/app/layout.tsx` (modify)                           | render `<CookieNotice />`                                            |
| `landing/components/Footer.tsx` (modify)                    | add `/cookies` link                                                  |
| `docs/PLATFORM.md` (modify)                                 | §14 (consent toggles, re-consent) + §15 (cookies)                    |

---

## Task 1: ConsentToggles (app) + render in PrivacyDataPage

**Files:** Create `app/src/components/ConsentToggles.tsx`, `app/src/components/ConsentToggles.test.tsx`; modify
`app/src/pages/PrivacyDataPage.tsx` + `app/src/pages/PrivacyDataPage.test.tsx`

- [ ] **Step 1: Write the failing test** — `app/src/components/ConsentToggles.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const recordConsent = vi.fn(async () => {})
let consentsVal: unknown = null

vi.mock('convex/react', () => ({
  useQuery: () => consentsVal,
  useMutation: () => recordConsent
}))
vi.mock('../convex', () => ({
  api: { privacy: { consent: { getConsents: 'getConsents', recordConsent: 'recordConsent' } } }
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import ConsentToggles from './ConsentToggles'

describe('ConsentToggles', () => {
  beforeEach(() => {
    recordConsent.mockClear()
    consentsVal = null
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('renders marketing + analytics toggles, off by default (no records)', () => {
    render(<ConsentToggles />)
    const marketing = screen.getByLabelText('privacy.consent.marketing') as HTMLInputElement
    const analytics = screen.getByLabelText('privacy.consent.analytics') as HTMLInputElement
    expect(marketing.checked).toBe(false)
    expect(analytics.checked).toBe(false)
  })

  it('reflects stored consent', () => {
    consentsVal = { marketing: true, analytics: false }
    render(<ConsentToggles />)
    expect((screen.getByLabelText('privacy.consent.marketing') as HTMLInputElement).checked).toBe(true)
  })

  it('records consent when a toggle is flipped on', async () => {
    render(<ConsentToggles />)
    fireEvent.click(screen.getByLabelText('privacy.consent.marketing'))
    await waitFor(() =>
      expect(recordConsent).toHaveBeenCalledWith({ sessionToken: 'tok', purpose: 'marketing', granted: true })
    )
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter app test ConsentToggles`.

- [ ] **Step 3: Implement** — `app/src/components/ConsentToggles.tsx`:

```tsx
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'

type ConsentMap = { marketing?: boolean; analytics?: boolean } | null | undefined
const PURPOSES = ['marketing', 'analytics'] as const

export default function ConsentToggles() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const consents = useQuery(api.privacy.consent.getConsents, sessionToken ? { sessionToken } : 'skip') as ConsentMap
  const recordConsent = useMutation(api.privacy.consent.recordConsent)

  async function toggle(purpose: (typeof PURPOSES)[number], granted: boolean) {
    if (!sessionToken) return
    await recordConsent({ sessionToken, purpose, granted })
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 mt-0 text-base font-semibold text-slate-900">{t('privacy.consent.title')}</h2>
      <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('privacy.consent.note')}</p>
      {PURPOSES.map(p => (
        <label
          key={p}
          className="mb-2 flex items-center gap-3 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            aria-label={t(`privacy.consent.${p}`)}
            checked={consents?.[p] === true}
            onChange={e => toggle(p, e.target.checked)}
            className="h-4 w-4"
          />
          <span>{t(`privacy.consent.${p}`)}</span>
        </label>
      ))}
    </section>
  )
}
```

- [ ] **Step 4: Render it in `PrivacyDataPage.tsx`** — import and place `<ConsentToggles />` between the
  export `<section>` and the delete `<section>` (in the main return, not the deletion-confirmed branch):

```tsx
import ConsentToggles from '../components/ConsentToggles'
// ... after the export <section> ... and before the delete <section>:
;<ConsentToggles />
```

- [ ] **Step 5: Update `PrivacyDataPage.test.tsx`** so rendering `ConsentToggles` doesn't break — extend
  the `../convex` mock's `api.privacy` with `consent` and make the `convex/react` mocks tolerate the new
  refs. Replace the `vi.mock('convex/react', ...)` and `vi.mock('../convex', ...)` blocks with:

```tsx
vi.mock('convex/react', () => ({
  useQuery: (ref: string) =>
    ref === 'getExportStatus' ? exportStatusVal : ref === 'getExportDownloadUrl' ? downloadUrlVal : null,
  useMutation: (ref: string) =>
    ref === 'requestDataExport' ? requestExport : ref === 'requestAccountDeletion' ? requestDeletion : vi.fn()
}))
vi.mock('../convex', () => ({
  api: {
    privacy: {
      export: {
        getExportStatus: 'getExportStatus',
        getExportDownloadUrl: 'getExportDownloadUrl',
        requestDataExport: 'requestDataExport'
      },
      deletion: { requestAccountDeletion: 'requestAccountDeletion' },
      consent: { getConsents: 'getConsents', recordConsent: 'recordConsent' }
    }
  }
}))
```

(`getConsents` returns `null` → toggles render off; `recordConsent` → a throwaway `vi.fn()`. The existing
3 PrivacyDataPage tests still assert only export/delete behavior, so they keep passing.)

- [ ] **Step 6: Add i18n keys** — add to the `privacy` block in `en.json`, `pt.json`, `es.json` (identical
  keys in all three):

```json
    "consent": {
"title": "Communication & analytics preferences",
"note": "These are optional and off by default. Change them anytime.",
"marketing": "Send me product news and tips by email",
"analytics": "Allow privacy-friendly usage analytics"
}
```

(en shown; translate the values for pt/es, keep the keys identical. pt example: title "Preferências de comunicação e
análise", marketing "Enviar novidades e dicas por e-mail", analytics "Permitir análise de uso", note "São opcionais e
desativadas por padrão. Altere quando quiser."; es: "Preferencias de comunicación y analítica", "Enviarme novedades y
consejos por correo", "Permitir analítica de uso", "Son opcionales y están desactivadas por defecto. Cámbialas cuando
quieras.")

- [ ] **Step 7: Run + verify** — `pnpm --filter app test ConsentToggles`, then `pnpm --filter app test`
  (incl. PrivacyDataPage + i18n parity), then `pnpm lint`, then `npx prettier --check` on the new/changed
  files. All green.

- [ ] **Step 8: Checkpoint (NO COMMIT).**

---

## Task 2: PolicyUpdateScreen + RequireAuth re-consent interception

**Files:** Create `app/src/components/PolicyUpdateScreen.tsx`, `app/src/components/PolicyUpdateScreen.test.tsx`; modify
`app/src/App.tsx`; add i18n keys

- [ ] **Step 1: Write the failing test** — `app/src/components/PolicyUpdateScreen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ackFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => ackFn }))
vi.mock('../convex', () => ({ api: { privacy: { consent: { acknowledgePolicy: 'ref' } } } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import PolicyUpdateScreen from './PolicyUpdateScreen'

describe('PolicyUpdateScreen', () => {
  beforeEach(() => {
    ackFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('renders the policy-update heading', () => {
    render(<PolicyUpdateScreen />)
    expect(screen.getByText('privacy.policyUpdate.title')).toBeInTheDocument()
  })

  it('calls acknowledgePolicy when acknowledged', async () => {
    render(<PolicyUpdateScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'privacy.policyUpdate.acknowledge' }))
    await waitFor(() => expect(ackFn).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter app test PolicyUpdateScreen`.

- [ ] **Step 3: Implement** — `app/src/components/PolicyUpdateScreen.tsx`:

```tsx
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'

export default function PolicyUpdateScreen() {
  const { t } = useTranslation()
  const acknowledge = useMutation(api.privacy.consent.acknowledgePolicy)
  const [working, setWorking] = useState(false)

  async function handleAcknowledge() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await acknowledge({ sessionToken: token })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="text-lg font-bold text-slate-900">{t('privacy.policyUpdate.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('privacy.policyUpdate.body')}</p>
        <div className="mt-5 flex items-center gap-3">
          <a
            href="https://linkintothessi.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            {t('privacy.policyUpdate.readPolicy')}
          </a>
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={working}
            className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {working ? '…' : t('privacy.policyUpdate.acknowledge')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the interception** in `app/src/App.tsx`. Add imports:

```tsx
import PolicyUpdateScreen from './components/PolicyUpdateScreen'
import { POLICY_VERSION } from '../../convex/lib/policy'
```

Then in `RequireAuth`, AFTER the `deletionScheduledAt` branch and BEFORE the app-shell return:

```tsx
  if (me.deletionScheduledAt) return <CancelDeletionScreen deletionScheduledAt={me.deletionScheduledAt} />

  if (me.acknowledgedPolicyVersion !== POLICY_VERSION) return <PolicyUpdateScreen />

  return (
    <>
      <AppNav />
      {children}
```

(Order: banned → pending-deletion → re-consent → app. New users are stamped with the current
`POLICY_VERSION` at signup, so they aren't prompted.)

> Verify the `../../convex/lib/policy` import path resolves from `app/src/App.tsx`. `app/src/` files
> import convex via `../../../convex/...` from `app/src/pages|components/` (three levels), so from
> `app/src/App.tsx` (two levels) it's `../../convex/lib/policy`. Adjust if the alias/tsconfig differs;
> do not introduce `any`.

- [ ] **Step 5: Add i18n keys** — add to the `privacy` block in all three locales (identical keys):

```json
    "policyUpdate": {
"title": "We've updated our Privacy Policy",
"body": "We've made changes to how we handle your data. Please review and acknowledge to continue.",
"readPolicy": "Read the policy",
"acknowledge": "I acknowledge"
}
```

(Translate values for pt/es; keep keys identical. pt: "Atualizamos nossa Política de Privacidade" / "Fizemos alterações…
Revise e confirme para continuar." / "Ler a política" / "Eu confirmo". es: "Actualizamos nuestra Política de
Privacidad" / "Hicimos cambios… Revísala y confírmala para continuar." / "Leer la política" / "Acepto".)

- [ ] **Step 6: Run + verify** — `pnpm --filter app test PolicyUpdateScreen`, then `pnpm --filter app test`
  (full app suite; i18n parity), then `pnpm lint`, then `npx prettier --check` on changed files.

- [ ] **Step 7: Checkpoint (NO COMMIT).**

---

## Task 3: Landing — `/cookies` page + CookieNotice

**Files:** Create `landing/app/cookies/page.tsx`, `landing/components/CookieNotice.tsx`; modify
`landing/app/layout.tsx`, `landing/components/Footer.tsx`

> The landing site has **no Vitest setup**. Verify with `pnpm lint` + `pnpm --filter landing build`.

- [ ] **Step 1: Create the Cookie Policy page** — `landing/app/cookies/page.tsx` (mirror the structure of
  the existing `landing/app/privacy/page.tsx`):

```tsx
export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Cookie & Storage Policy</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Last updated:</strong> June 2026
        </p>
        <p>
          Link Into The SSI uses only <strong className="text-cream">strictly necessary</strong> browser storage. The
          app stores a session token (to keep you signed in) and your language preference. We do not use advertising or
          cross-site tracking cookies.
        </p>
        <p>
          Because this storage is essential to provide the service you requested, it does not require consent under the
          ePrivacy rules. Optional analytics, if ever introduced, will be off by default and controllable from{' '}
          <strong className="text-cream">Settings → Privacy &amp; Data</strong>.
        </p>
        <p>
          Questions:{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold hover:underline"
          >
            contact@linkintothessi.com
          </a>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create the CookieNotice** — `landing/components/CookieNotice.tsx` (client component;
  dismissible, persists to `localStorage`):

```tsx
'use client'

import { useEffect, useState } from 'react'

const KEY = 'cookieNoticeDismissed'

export default function CookieNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(KEY) !== '1') setShow(true)
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-cream/10 bg-ink/95 px-6 py-4 text-sm text-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row">
        <p className="m-0 flex-1">
          We use only essential browser storage to run the app (sign-in + language). No tracking cookies.{' '}
          <a
            href="/cookies"
            className="text-gold hover:underline"
          >
            Learn more
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(KEY, '1')
            setShow(false)
          }}
          className="rounded-md bg-gold px-4 py-2 font-semibold text-ink"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Render it in the layout** — in `landing/app/layout.tsx`, import `CookieNotice` and render
  it inside `<body>` after `{children}`:

```tsx
import CookieNotice from '../components/CookieNotice'
// ...
;<body className="bg-ink font-body text-cream antialiased">
  {children}
  <CookieNotice />
</body>
```

- [ ] **Step 4: Add a `/cookies` link to the Footer** — read `landing/components/Footer.tsx` and add a
  `/cookies` link (a Next `<Link href="/cookies">Cookies</Link>` or `<a>`) next to the existing `/privacy`
  and `/terms` links, matching their exact markup/styling.

- [ ] **Step 5: Verify** — `pnpm lint`, then `pnpm --filter landing build` (Next/tsc must succeed), then
  `npx prettier --check "landing/app/cookies/page.tsx" "landing/components/CookieNotice.tsx" "landing/app/layout.tsx" "landing/components/Footer.tsx"` (
  write+recheck if needed).

- [ ] **Step 6: Checkpoint (NO COMMIT).**

---

## Task 4: Documentation — §14 + §15

**Files:** Modify `docs/PLATFORM.md`

- [ ] **Step 1: §14 (app)** — document `ConsentToggles` (in PrivacyDataPage; marketing/analytics off by
  default → `recordConsent`/`getConsents`), `PolicyUpdateScreen` + the new `RequireAuth` order (banned →
  pending-deletion → **re-consent** → app), and the new `privacy.consent.*` / `privacy.policyUpdate.*`
  i18n keys.
- [ ] **Step 2: §15 (landing)** — add the `/cookies` route to the routes table; document `CookieNotice`
  (dismissible, essential-storage-only, links `/cookies`) and the Footer `/cookies` link.
- [ ] **Step 3: Footer** — extend the "_Last updated_" note to mention Phase 3b.
- [ ] **Step 4: Verify + Checkpoint (NO COMMIT).**

---

## Phase 3b completion check

- [ ] `pnpm --filter app test` — green (ConsentToggles, PolicyUpdateScreen, PrivacyDataPage, i18n parity).
- [ ] `pnpm --filter landing build` — succeeds.
- [ ] `pnpm lint` — zero warnings.
- [ ] `npx prettier --check` on all created/modified app + landing files + locales — clean.
- [ ] **Nothing committed.** Runtime needs `pnpm dev:convex` for `api.privacy.consent.*`.

## Self-Review (performed during authoring)

- **Spec coverage:** consent toggles (§4.1 → Task 1), re-consent prompt (§4.5 → Task 2), cookie notice +
  policy page (§4.2 → Task 3), docs (Task 4).
- **Placeholder scan:** none — components, tests, and locale blocks are complete; the Footer link + pt/es
  translation strings are explicit instructions with examples, not TODOs.
- **Type/name consistency:** `api.privacy.consent.{getConsents,recordConsent,acknowledgePolicy}` and arg
  shapes match Phase 3a; the `RequireAuth` order extends the Phase 2b chain; i18n keys are added to all
  three locales for parity.
- **Test isolation:** app tests mock `../convex`; landing has no test setup (lint + build verify it).
- **No-commit rule:** every task ends in a no-commit checkpoint.

```

```
