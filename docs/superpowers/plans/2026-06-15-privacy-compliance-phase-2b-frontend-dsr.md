# Privacy & Compliance — Phase 2b: Frontend Data-Subject Rights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **DO NOT COMMIT TO GIT.** The repo owner (Henriko) commits. Every task ends in a **Checkpoint
> (no commit)**. (Per `CLAUDE.md`.)

> ⚠️ **Prerequisite:** Phase 2a (backend DSR) must be in the working tree. Tests here **mock
> `../convex`**, so they do NOT require `_generated` to be regenerated — but the running app does
> (`api.privacy.*` only exists after `pnpm dev:convex`). That's the standard Convex workflow and an
> existing action item.

> **Plan 2b of the program.** Frontend only. Backend = Phase 2a. Consent/retention/dormancy/re-consent
> = Phase 3. Legal docs = Phase 4.

**Goal:** Give users the in-app UI for their data-subject rights — a **Privacy & Data** page (request
export, download, delete account with confirmation) and a **CancelDeletionScreen** shown during the
30-day grace window via a new `RequireAuth` interception.

**Architecture:** React 19 + Vite SPA. Each page reads `sessionToken` from `sessionStorage` and calls
Convex via `convex/react` hooks against `api.privacy.*` (Phase 2a). New screen mirrors the existing
`BannedScreen`. `RequireAuth` gains a third branch (order: banned → pending-deletion → app). Tailwind
section-card styling; i18n via a new `privacy.*` namespace. Tests follow the existing
`vi.mock('convex/react')` component-test pattern, additionally mocking `../convex` so they're
independent of generated types.

**Tech Stack:** React 19, react-router-dom 7, `convex/react`, react-i18next, Vitest + React Testing
Library (`pnpm --filter app test`).

**Spec:** `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md` §3.1/§3.2 (export, deletion

- grace), §14 frontend. **Backend signatures (Phase 2a):** `api.privacy.export.requestDataExport`
  (mutation → `{requestId}`), `api.privacy.export.getExportStatus` (query → `{status, requestedAt}|null`),
  `api.privacy.export.getExportDownloadUrl` (query → `string|null`), `api.privacy.deletion.requestAccountDeletion`
  (mutation → `{deletionScheduledAt}`), `api.privacy.deletion.cancelAccountDeletion` (mutation). `getMe`
  already returns `deletionScheduledAt`/`deletionReason`.

---

## File Structure

| File                                                          | Responsibility                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `app/src/components/CancelDeletionScreen.tsx` (create) + test | Grace-window screen: shows the date, "Keep my account" (→ `cancelAccountDeletion`), Sign out |
| `app/src/pages/PrivacyDataPage.tsx` (create) + test           | Export (request/status/download) + delete-with-confirm-modal                                 |
| `app/src/App.tsx` (modify)                                    | New guarded route `/privacy-data`; `RequireAuth` pending-deletion interception               |
| `app/src/components/AppNav.tsx` (modify)                      | "Privacy" nav link → `/privacy-data`                                                         |
| `app/src/i18n/locales/{en,pt,es}.json` (modify)               | New `privacy.*` keys                                                                         |
| `docs/PLATFORM.md` (modify)                                   | §14 — document the page, screen, interception, nav link                                      |

**Test commands:** `pnpm --filter app test [substring]`; lint `pnpm lint`.

> Design note vs spec: the spec said "Privacy & Data **area in Settings**." This plan ships it as a
> **dedicated guarded page** (`/privacy-data`) linked from the nav — cleaner separation, and it avoids
> coupling to `SettingsPage`/its test (which renders without a Router). Same user-facing outcome.

---

## Task 1: CancelDeletionScreen

**Files:** Create `app/src/components/CancelDeletionScreen.tsx`, `app/src/components/CancelDeletionScreen.test.tsx`

- [ ] **Step 1: Write the failing test** — `CancelDeletionScreen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const cancelFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => cancelFn }))
vi.mock('../convex', () => ({ api: { privacy: { deletion: { cancelAccountDeletion: 'ref' } } } }))

import CancelDeletionScreen from './CancelDeletionScreen'

describe('CancelDeletionScreen', () => {
  beforeEach(() => {
    cancelFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('renders the scheduled-deletion heading', () => {
    render(<CancelDeletionScreen deletionScheduledAt={new Date('2026-06-30').getTime()} />)
    expect(screen.getByText(/scheduled for deletion/i)).toBeInTheDocument()
  })

  it('calls cancelAccountDeletion with the session token when Keep is clicked', async () => {
    render(<CancelDeletionScreen deletionScheduledAt={123} />)
    fireEvent.click(screen.getByRole('button', { name: /keep my account/i }))
    await waitFor(() => expect(cancelFn).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter app test CancelDeletionScreen`.

- [ ] **Step 3: Implement** — `CancelDeletionScreen.tsx` (mirrors `BannedScreen.tsx`; hardcoded copy like that component):

```tsx
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex'

type Props = {
  deletionScheduledAt?: number
}

function signOut() {
  sessionStorage.removeItem('sessionToken')
  window.location.assign('/')
}

export default function CancelDeletionScreen({ deletionScheduledAt }: Props) {
  const cancelDeletion = useMutation(api.privacy.deletion.cancelAccountDeletion)
  const [working, setWorking] = useState(false)
  const dateLabel = deletionScheduledAt ? new Date(deletionScheduledAt).toLocaleDateString() : null

  async function keepAccount() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await cancelDeletion({ sessionToken: token })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-amber-700">
          Account scheduled for deletion
        </div>
        <h1 className="text-lg font-bold text-slate-900">Your account is scheduled for deletion</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {dateLabel
            ? `Your account and personal data will be permanently deleted on ${dateLabel}. You can keep your account by cancelling the deletion.`
            : 'Your account is pending deletion. You can keep it by cancelling the deletion.'}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={keepAccount}
            disabled={working}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? 'Cancelling…' : 'Keep my account'}
          </button>
          <button
            type="button"
            onClick={signOut}
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

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter app test CancelDeletionScreen`, then `pnpm lint`,
      then `npx prettier --check "app/src/components/CancelDeletionScreen.tsx" "app/src/components/CancelDeletionScreen.test.tsx"` (write+recheck if needed).

- [ ] **Step 5: Checkpoint (NO COMMIT).**

---

## Task 2: PrivacyDataPage

**Files:** Create `app/src/pages/PrivacyDataPage.tsx`, `app/src/pages/PrivacyDataPage.test.tsx`

- [ ] **Step 1: Write the failing test** — `PrivacyDataPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requestExport = vi.fn(async () => ({ requestId: 'r1' }))
const requestDeletion = vi.fn(async () => ({ deletionScheduledAt: 1893456000000 }))
let exportStatusVal: unknown = null
let downloadUrlVal: unknown = null

vi.mock('convex/react', () => ({
  useQuery: (ref: string) =>
    ref === 'getExportStatus' ? exportStatusVal : ref === 'getExportDownloadUrl' ? downloadUrlVal : null,
  useMutation: (ref: string) => (ref === 'requestDataExport' ? requestExport : requestDeletion)
}))
vi.mock('../convex', () => ({
  api: {
    privacy: {
      export: {
        getExportStatus: 'getExportStatus',
        getExportDownloadUrl: 'getExportDownloadUrl',
        requestDataExport: 'requestDataExport'
      },
      deletion: { requestAccountDeletion: 'requestAccountDeletion' }
    }
  }
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { date?: string }) => (o?.date ? `${k}:${o.date}` : k) })
}))

import PrivacyDataPage from './PrivacyDataPage'

describe('PrivacyDataPage', () => {
  beforeEach(() => {
    requestExport.mockClear()
    requestDeletion.mockClear()
    exportStatusVal = null
    downloadUrlVal = null
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('requests an export when the export button is clicked', async () => {
    render(<PrivacyDataPage />)
    fireEvent.click(screen.getByRole('button', { name: 'privacy.exportButton' }))
    await waitFor(() => expect(requestExport).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })

  it('shows a download link when an export is ready', () => {
    exportStatusVal = { status: 'ready', requestedAt: 1 }
    downloadUrlVal = 'https://files/export.json'
    render(<PrivacyDataPage />)
    const link = screen.getByRole('link', { name: 'privacy.download' })
    expect(link).toHaveAttribute('href', 'https://files/export.json')
  })

  it('requires typing DELETE before the account can be deleted, then schedules deletion', async () => {
    render(<PrivacyDataPage />)
    fireEvent.click(screen.getByRole('button', { name: 'privacy.deleteButton' }))
    const confirmBtn = screen.getByRole('button', { name: 'privacy.confirmDeleteButton' })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('privacy.confirmInputLabel'), { target: { value: 'DELETE' } })
    expect(confirmBtn).toBeEnabled()
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(requestDeletion).toHaveBeenCalledWith({ sessionToken: 'tok' }))
    expect(screen.getByText('privacy.deletionScheduledTitle')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter app test PrivacyDataPage`.

- [ ] **Step 3: Implement** — `PrivacyDataPage.tsx`:

```tsx
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import Modal from '../components/Modal'

export default function PrivacyDataPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const exportStatus = useQuery(api.privacy.export.getExportStatus, sessionToken ? { sessionToken } : 'skip') as
    | { status: string; requestedAt: number }
    | null
    | undefined
  const downloadUrl = useQuery(api.privacy.export.getExportDownloadUrl, sessionToken ? { sessionToken } : 'skip') as
    | string
    | null
    | undefined
  const requestExport = useMutation(api.privacy.export.requestDataExport)
  const requestDeletion = useMutation(api.privacy.deletion.requestAccountDeletion)

  const [exporting, setExporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deletionDate, setDeletionDate] = useState<number | null>(null)

  async function handleExport() {
    if (!sessionToken) return
    setExporting(true)
    try {
      await requestExport({ sessionToken })
    } finally {
      setExporting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!sessionToken) return
    setDeleting(true)
    try {
      const res = (await requestDeletion({ sessionToken })) as { deletionScheduledAt: number }
      setConfirmOpen(false)
      setDeletionDate(res.deletionScheduledAt)
    } finally {
      setDeleting(false)
    }
  }

  if (deletionDate) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-8 font-sans">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 mt-0 text-base font-semibold text-slate-900">{t('privacy.deletionScheduledTitle')}</h2>
          <p className="m-0 text-sm text-slate-700">
            {t('privacy.deletionScheduledBody', { date: new Date(deletionDate).toLocaleDateString() })}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 font-sans">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t('privacy.title')}</h1>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 mt-0 text-base font-semibold text-slate-900">{t('privacy.exportTitle')}</h2>
        <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('privacy.exportNote')}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || exportStatus?.status === 'pending'}
            className="rounded-md border-none bg-blue-500 px-4 py-[7px] text-[13px] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? t('privacy.requesting') : t('privacy.exportButton')}
          </button>
          {exportStatus?.status === 'pending' && (
            <span className="text-xs text-slate-500">{t('privacy.exportPending')}</span>
          )}
          {exportStatus?.status === 'ready' && downloadUrl && (
            <a
              href={downloadUrl}
              className="text-[13px] font-semibold text-blue-500 no-underline"
              download
            >
              {t('privacy.download')}
            </a>
          )}
          {exportStatus?.status === 'expired' && (
            <span className="text-xs text-slate-400">{t('privacy.exportExpired')}</span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-5">
        <h2 className="mb-2 mt-0 text-base font-semibold text-red-700">{t('privacy.deleteTitle')}</h2>
        <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('privacy.deleteNote')}</p>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="rounded-md border border-red-300 bg-white px-4 py-[7px] text-[13px] font-semibold text-red-600 hover:bg-red-50"
        >
          {t('privacy.deleteButton')}
        </button>
      </section>

      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <h2 className="mb-2 mt-0 text-base font-semibold text-slate-900">{t('privacy.confirmTitle')}</h2>
          <p className="mb-3 text-sm text-slate-600">{t('privacy.confirmBody')}</p>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            aria-label={t('privacy.confirmInputLabel')}
            className="mb-3 w-full rounded-md border border-slate-300 px-[10px] py-[7px] text-[13px] outline-none"
          />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="text-sm font-semibold text-slate-500"
            >
              {t('privacy.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="rounded-md border-none bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? t('privacy.deleting') : t('privacy.confirmDeleteButton')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter app test PrivacyDataPage`, then `pnpm lint`, then
      `npx prettier --check` on both files (write+recheck if needed).

- [ ] **Step 5: Checkpoint (NO COMMIT).**

---

## Task 3: Route + RequireAuth interception (`App.tsx`)

**Files:** Modify `app/src/App.tsx`

> `App.tsx` has no test harness in this repo (consistent with how the routing shell is treated). The
> interception is exercised by the `CancelDeletionScreen` test (isolation) + manual verification. Keep
> the change minimal and mechanical.

- [ ] **Step 1: Add imports** at the top of `app/src/App.tsx`:

```tsx
import CancelDeletionScreen from './components/CancelDeletionScreen'
import PrivacyDataPage from './pages/PrivacyDataPage'
```

- [ ] **Step 2: Add the pending-deletion interception** in `RequireAuth`, **after** the `isBanned`
      check and **before** the final `return`:

```tsx
if (me.isBanned) return <BannedScreen reason={me.bannedReason ?? undefined} />

if (me.deletionScheduledAt) return <CancelDeletionScreen deletionScheduledAt={me.deletionScheduledAt} />

return (
  <>
    <AppNav />
    {children}
  </>
)
```

(The `me` object from `getMe` already carries `deletionScheduledAt` — it's a non-secret field passed
through `toSafeMe`. If TypeScript complains it's not on the inferred type, the field is present at
runtime; add it to the local type or access via `me.deletionScheduledAt` as the existing code accesses
`me.isBanned`/`me.primaryLocale`.)

- [ ] **Step 3: Add the guarded route** — alongside the other `<Route>`s (e.g. after `/settings`):

```tsx
<Route
  path="/privacy-data"
  element={
    <RequireAuth>
      <PrivacyDataPage />
    </RequireAuth>
  }
/>
```

- [ ] **Step 4: Verify** — `pnpm --filter app test` (whole app suite still green — no regressions),
      then `pnpm lint`, then `npx prettier --check "app/src/App.tsx"` (write+recheck if needed).

- [ ] **Step 5: Checkpoint (NO COMMIT).**

---

## Task 4: Nav link (`AppNav.tsx`)

**Files:** Modify `app/src/components/AppNav.tsx`

- [ ] **Step 1: Add the link** to the `NAV_LINKS` array (after Settings):

```tsx
const NAV_LINKS = [
  { path: '/feed', label: 'Feed' },
  { path: '/my-posts', label: 'My Posts' },
  { path: '/settings', label: 'Settings' },
  { path: '/privacy-data', label: 'Privacy' },
  { path: '/billing', label: 'Billing' }
]
```

- [ ] **Step 2: Verify** — `pnpm --filter app test` (no AppNav test exists; ensure nothing breaks),
      then `pnpm lint`, then `npx prettier --check "app/src/components/AppNav.tsx"`.

- [ ] **Step 3: Checkpoint (NO COMMIT).**

---

## Task 5: i18n keys (`privacy.*`)

**Files:** Modify `app/src/i18n/locales/en.json`, `pt.json`, `es.json`

- [ ] **Step 1: Add the `privacy` block** to `en.json` (as a new top-level key alongside `settings`):

```json
  "privacy": {
    "title": "Privacy & Data",
    "exportTitle": "Export your data",
    "exportNote": "Download a machine-readable copy of your account data. We'll prepare it and the download link will be available here (valid for 7 days).",
    "exportButton": "Request my data",
    "requesting": "Requesting…",
    "exportPending": "Preparing your export…",
    "download": "Download",
    "exportExpired": "Your previous export link has expired. Request a new one.",
    "deleteTitle": "Delete your account",
    "deleteNote": "Permanently delete your account and personal data after a 30-day grace period. You can cancel within those 30 days by signing in again. Required billing records are kept in anonymized form as the law requires.",
    "deleteButton": "Delete my account",
    "confirmTitle": "Delete your account?",
    "confirmBody": "This schedules permanent deletion of your account in 30 days. Type DELETE to confirm.",
    "confirmInputLabel": "Type DELETE to confirm",
    "cancel": "Cancel",
    "deleting": "Scheduling…",
    "confirmDeleteButton": "Schedule deletion",
    "deletionScheduledTitle": "Account scheduled for deletion",
    "deletionScheduledBody": "Your account will be permanently deleted on {{date}}. You've been signed out. Sign in again before then to cancel. We've emailed you a confirmation."
  },
```

- [ ] **Step 2: Add the same block to `pt.json`** (Portuguese):

```json
  "privacy": {
    "title": "Privacidade e Dados",
    "exportTitle": "Exportar seus dados",
    "exportNote": "Baixe uma cópia legível por máquina dos dados da sua conta. Vamos prepará-la e o link de download ficará disponível aqui (válido por 7 dias).",
    "exportButton": "Solicitar meus dados",
    "requesting": "Solicitando…",
    "exportPending": "Preparando sua exportação…",
    "download": "Baixar",
    "exportExpired": "Seu link de exportação anterior expirou. Solicite um novo.",
    "deleteTitle": "Excluir sua conta",
    "deleteNote": "Exclua permanentemente sua conta e seus dados pessoais após um período de carência de 30 dias. Você pode cancelar dentro desses 30 dias entrando novamente. Registros de cobrança exigidos por lei são mantidos de forma anonimizada.",
    "deleteButton": "Excluir minha conta",
    "confirmTitle": "Excluir sua conta?",
    "confirmBody": "Isso agenda a exclusão permanente da sua conta em 30 dias. Digite DELETE para confirmar.",
    "confirmInputLabel": "Digite DELETE para confirmar",
    "cancel": "Cancelar",
    "deleting": "Agendando…",
    "confirmDeleteButton": "Agendar exclusão",
    "deletionScheduledTitle": "Conta agendada para exclusão",
    "deletionScheduledBody": "Sua conta será excluída permanentemente em {{date}}. Você foi desconectado. Entre novamente antes dessa data para cancelar. Enviamos uma confirmação por e-mail."
  },
```

- [ ] **Step 3: Add the same block to `es.json`** (Spanish):

```json
  "privacy": {
    "title": "Privacidad y Datos",
    "exportTitle": "Exporta tus datos",
    "exportNote": "Descarga una copia legible por máquina de los datos de tu cuenta. La prepararemos y el enlace de descarga estará disponible aquí (válido por 7 días).",
    "exportButton": "Solicitar mis datos",
    "requesting": "Solicitando…",
    "exportPending": "Preparando tu exportación…",
    "download": "Descargar",
    "exportExpired": "Tu enlace de exportación anterior caducó. Solicita uno nuevo.",
    "deleteTitle": "Eliminar tu cuenta",
    "deleteNote": "Elimina permanentemente tu cuenta y tus datos personales tras un período de gracia de 30 días. Puedes cancelar dentro de esos 30 días volviendo a iniciar sesión. Los registros de facturación exigidos por ley se conservan de forma anonimizada.",
    "deleteButton": "Eliminar mi cuenta",
    "confirmTitle": "¿Eliminar tu cuenta?",
    "confirmBody": "Esto programa la eliminación permanente de tu cuenta en 30 días. Escribe DELETE para confirmar.",
    "confirmInputLabel": "Escribe DELETE para confirmar",
    "cancel": "Cancelar",
    "deleting": "Programando…",
    "confirmDeleteButton": "Programar eliminación",
    "deletionScheduledTitle": "Cuenta programada para eliminación",
    "deletionScheduledBody": "Tu cuenta se eliminará permanentemente el {{date}}. Se ha cerrado tu sesión. Vuelve a iniciar sesión antes de esa fecha para cancelar. Te enviamos una confirmación por correo."
  },
```

- [ ] **Step 4: Verify** — `pnpm --filter app test` (i18n test, if it validates key parity across
      locales, must still pass — that's why all three locales get the block), then `pnpm lint`, then
      `npx prettier --check "app/src/i18n/locales/*.json"`.

> Check `app/src/i18n/i18n.test.ts` — if it asserts the three locales have identical key sets, your
> three blocks must match exactly (same keys). Run it and fix any parity mismatch.

- [ ] **Step 5: Checkpoint (NO COMMIT).**

---

## Task 6: Documentation — `docs/PLATFORM.md` §14

**Files:** Modify `docs/PLATFORM.md`

- [ ] **Step 1: Document the new page + screen + interception** in §14 (Frontend — Authenticated App):
  - Add `/privacy-data` → `PrivacyDataPage` to the routes table (guarded).
  - Note `RequireAuth` interception order is now **banned → pending-deletion (`CancelDeletionScreen`) → app**.
  - Add `PrivacyDataPage` (export request/status/download + delete-with-confirm modal calling
    `api.privacy.*`) and `CancelDeletionScreen` (grace-window screen; "Keep my account" →
    `cancelAccountDeletion`) to the pages/components descriptions.
  - Note the new **"Privacy"** `AppNav` link and the new `privacy.*` i18n namespace (en/pt/es).

- [ ] **Step 2: Cross-reference** §13B (the backend these UIs call).

- [ ] **Step 3: Update the footer** "Last updated" note to mention Phase 2b (frontend DSR).

- [ ] **Step 4: Verify + Checkpoint (NO COMMIT)** — re-read §14; confirm Markdown renders.

---

## Phase 2b completion check

- [ ] `pnpm --filter app test` — all green (new: CancelDeletionScreen, PrivacyDataPage; existing app
      tests unaffected).
- [ ] `pnpm lint` — zero warnings.
- [ ] `npx prettier --check` on all created/modified app files + the JSON locales — clean.
- [ ] Deliverables: `CancelDeletionScreen.tsx`, `PrivacyDataPage.tsx` (+ tests), `App.tsx` route +
      interception, `AppNav.tsx` link, `privacy.*` in all three locales, `docs/PLATFORM.md` §14.
- [ ] **Nothing committed.** (Runtime requires `pnpm dev:convex` so `api.privacy.*` resolves.)

## Self-Review (performed during authoring)

- **Spec coverage:** export UI (request/status/download) + deletion UI (confirm → schedule) = spec
  §3.1/§3.2 (Tasks 2); grace-window cancel screen + `RequireAuth` interception = §3.2 (Tasks 1, 3);
  discoverability via nav (Task 4); i18n parity (Task 5); docs (Task 6).
- **Placeholder scan:** none — every component, test, and locale block is complete.
- **Type/name consistency:** the `api.privacy.*` paths and arg shapes (`{ sessionToken }`, return
  `{ deletionScheduledAt }` / `{ status, requestedAt }` / `string`) match Phase 2a's definitions; the
  test mocks key off the exact ref strings the components pass.
- **Decoupled tests:** component tests mock `../convex`, so they pass without regenerating
  `_generated` — only the running app needs `pnpm dev:convex`.
- **No-commit rule:** every task ends in a no-commit checkpoint.

```

```
