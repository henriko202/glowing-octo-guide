# Privacy & Compliance — Phase 4: Legal & Transparency Artifacts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

> ⚠️ **DO NOT COMMIT TO GIT.** The owner commits. Every task ends in a **Checkpoint (no commit)**. (Per `CLAUDE.md`.)

> ⚠️ **This phase produces DRAFT legal/compliance documents — NOT legal advice.** Every user-facing
> legal text and every `docs/compliance/` artifact must be headed **"DRAFT — requires legal review"**
> and use the `[BRACKETED]` business inputs below. A lawyer must review before publishing.
> **Business inputs (bracketed placeholders throughout):** `[LEGAL_ENTITY_NAME]`, `[BUSINESS_ADDRESS]`,
> `[GOVERNING_LAW_JURISDICTION]`, `[PRIVACY_CONTACT_EMAIL]`, `[DPO_OR_REP_CONTACT]` (if appointed).

> **Plan 4 of the program — the final phase.** Mostly documentation. The privacy policy describes the
> machinery built in Phases 1–3 and must promise only what exists. `/cookies` already shipped (Phase 3b).

**Goal:** Produce the compliance documentation (`docs/compliance/`) and rewrite the user-facing legal
pages so the platform's privacy posture is **documented and transparent** — closing sub-projects A
(inventory/ROPA + gap assessment) and F (legal artifacts) of the spec.

**Architecture:** Markdown deliverables under `docs/compliance/`, plus rewritten Next.js pages
`landing/app/privacy/page.tsx` and `landing/app/terms/page.tsx` (hardcoded content, Tailwind
`ink/cream/gold`, like the existing pages). No unit tests (prose); verify by completeness review +
`pnpm lint` + `pnpm --filter landing build` for the `.tsx` pages.

**Spec:** `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md` §5.1 (docs/compliance), §5.2
(legal pages), §0/§10 (caveats + human to-dos). **Describe the ACTUAL system** (Phases 1–3): consent
toggles, 30-day deletion + dormancy, export, retention crons, audit log, email via Resend, Stripe
billing; **Apify is dormant/disabled** (do NOT disclose it as active — spec §4.4 hard gate).

## Conventions

- Each `docs/compliance/*.md` opens with `> **DRAFT — requires legal review.**` and the date.
- Legal pages mirror `landing/app/privacy/page.tsx` structure/styling; mark DRAFT in a comment + a visible "Last updated" line.
- Use the `[BRACKETED]` inputs verbatim so a human can find/replace them.
- Verify: `pnpm lint` + `pnpm --filter landing build`; `npx prettier --check` on the `.tsx` pages.
  (Markdown under `docs/` has pre-existing prettier noise — keep added lines clean, don't reformat the world.)

---

## File Structure

| File                                           | Responsibility                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `docs/compliance/DATA-INVENTORY.md` (create)   | ROPA (GDPR Art. 30) — every processing activity                  |
| `docs/compliance/SUBPROCESSORS.md` (create)    | Sub-processor list + transfer mechanisms                         |
| `docs/compliance/RETENTION-POLICY.md` (create) | Retention schedule (mirrors the implemented crons)               |
| `docs/compliance/GAP-ASSESSMENT.md` (create)   | Framework requirements vs current state + residual gaps          |
| `docs/compliance/BREACH-RUNBOOK.md` (create)   | Incident response + notification templates                       |
| `docs/compliance/DPA-TEMPLATE.md` (create)     | Data Processing Agreement template                               |
| `docs/compliance/README.md` (create)           | Index of the compliance docs + the human/legal to-do list        |
| `landing/app/privacy/page.tsx` (rewrite)       | Full GDPR/LGPD/US privacy notice (DRAFT)                         |
| `landing/app/terms/page.tsx` (rewrite)         | Terms of Service (DRAFT) + age (16+) affirmation                 |
| `docs/PLATFORM.md` (modify)                    | Reference §17/§ new "Compliance Documentation" + §15 legal pages |

---

## Task 1: ROPA — `docs/compliance/DATA-INVENTORY.md`

**Files:** Create `docs/compliance/DATA-INVENTORY.md`

- [ ] **Step 1: Write the ROPA.** A Record of Processing Activities (GDPR Art. 30). For **each**
      processing activity below, document: **data categories · data subjects · purpose · legal basis ·
      recipients/sub-processors · retention · international transfers · security measures.** Use a table or
      per-activity subsections. Activities (derived from the actual code — be accurate):
  1. **Authentication & account** — `linkedinId`, `name`, `headline`, `profilePictureUrl`, `email`,
     `emailVerified` (from LinkedIn OIDC). Subjects: users. Purpose: provide + secure the service.
     Basis: **contract**. Recipients: Convex (hosting). Retention: life of account. Transfer: US (SCCs).
  2. **Profile attributes** — `industry`, `country`, `location`, `primaryLocale`. Purpose: feed
     targeting + UI locale. Basis: **legitimate interest / contract**. _Note: `location`/`primaryLocale`
     enrichment is via the Apify profile scrape, which is **DISABLED at launch** (see §"Dormant" below)._
  3. **Posts** — `content`, `mediaUrls`, `linkedinPostUrn`, `publishedAt` (via **manual user
     submission**). Purpose: shared engagement feed. Basis: **legitimate interest + the user's own
     action**. _Note: post content may contain third parties' personal data the user published on
     LinkedIn; documented LIA below._
  4. **Engagement** — comments/reactions performed via the user's LinkedIn token. Basis: **contract /
     user action**.
  5. **LinkedIn OAuth tokens** — `linkedinAccessToken`, `linkedinRefreshToken`, `tokenExpiresAt`
     (secret, server-only). Purpose: act on the user's behalf. Basis: **contract**. Retention: nulled
     at expiry by `enforceDataRetention`.
  6. **Billing** — `stripeCustomerId`, `subscriptions`. Subjects: paying users. Purpose: payments.
     Basis: **contract + legal obligation** (tax/accounting retention). Recipient: **Stripe**.
     Retention: invoices retained in Stripe per tax law even after account deletion.
  7. **Consent records** — `consentRecords`. Purpose: prove consent. Basis: **legal obligation**
     (Art. 7(1)). Retention: life of account.
  8. **Audit log** — `auditLogs`. Purpose: accountability (Art. 5(2)). Basis: **legal obligation /
     legitimate interest**. Retention: 24 months (pseudonymized on deletion).
  9. **Data-export jobs** — `dataExportRequests` + stored files. Purpose: fulfil access/portability.
     Basis: **legal obligation**. Retention: file 7 days.
  10. **Contact/notification email** — via **Resend**. Purpose: DSR confirmations + breach notice.
      Basis: **legitimate interest / legal obligation**.
  11. **Security/operational** — `sessions`, `oauthStates`, `rateLimits`. Basis: **legitimate
      interest** (security). Retention: cron cleanup.

  Then add these sections:
  - **Controller identity:** `[LEGAL_ENTITY_NAME]`, `[BUSINESS_ADDRESS]`, contact `[PRIVACY_CONTACT_EMAIL]`,
    `[DPO_OR_REP_CONTACT]`.
  - **Legitimate-interest assessment (LIA)** for the feed + post content (purpose, necessity,
    balancing test, opt-out = account deletion).
  - **International transfers:** US-based processors (Convex, Stripe, Vercel, Railway, Cloudflare,
    Resend) → **Standard Contractual Clauses** (link the sub-processor list).
  - **Dormant integrations:** **Apify** (LinkedIn post sync + profile scrape) is **disabled in
    production** (kill-switches off; `APIFY_*` env unset). **HARD GATE:** if ever enabled, this ROPA,
    the privacy policy, the sub-processor list, and a DPA must be updated in the same change.
  - **Known gap:** automated scraping (if enabled) likely conflicts with LinkedIn's User Agreement —
    a platform/contract risk, separate from data-protection law.

- [ ] **Step 2: Self-check** — every `users`/`posts`/etc. field in `convex/schema.ts` maps to an
      activity above (no personal-data field undocumented). Open with `> **DRAFT — requires legal review.**`

- [ ] **Step 3: Checkpoint (NO COMMIT).**

---

## Task 2: Sub-processors + Retention policy + Gap assessment

**Files:** Create `docs/compliance/SUBPROCESSORS.md`, `RETENTION-POLICY.md`, `GAP-ASSESSMENT.md`

- [ ] **Step 1: `SUBPROCESSORS.md`** — a table: **Sub-processor · Purpose · Data shared · Location ·
      Transfer mechanism · DPA**. Rows: **LinkedIn** (OAuth + posting — note it's the source platform/the
      user's own actions, not a classic processor), **Stripe** (payments; US; SCCs; Stripe DPA), **Convex**
      (backend/DB hosting; US; SCCs; Convex DPA), **Vercel** (landing hosting; US; SCCs), **Railway** (app
      hosting), **Cloudflare** (DNS/CDN; US; SCCs), **Resend** (transactional email; US; SCCs). Add a note:
      **Apify is NOT a current sub-processor** (dormant/disabled); add it here only if it is enabled (per
      the §4.4 hard gate). Leave `[links to each provider's DPA]` as bracketed inputs.

- [ ] **Step 2: `RETENTION-POLICY.md`** — a table mirroring the implemented crons + schema:
      | Data | Retention | Enforcement |
  - LinkedIn tokens → nulled once past `tokenExpiresAt` → `enforceDataRetention`.
  - `dataExportRequests` files → 7 days → `enforceDataRetention`.
  - `auditLogs` → 24 months → `enforceDataRetention`.
  - `consentRecords` → life of account (legal proof).
  - `posts` → life of account; deleted with the account.
  - **Inactive accounts** → 24 months (non-subscribers) → dormancy in `enforceDataRetention` →
    `processAccountDeletions`.
  - Account deletion (user-requested) → 30-day grace → `processAccountDeletions` cascade.
  - **Billing records** → retained in Stripe per tax/accounting law even after deletion.
  - `sessions`/`oauthStates` → cron cleanup (6h/1h).
  - Server/host logs (Convex/Vercel/Railway/Cloudflare) → per-platform; document the provider defaults
    as `[bracketed]` where unknown.

- [ ] **Step 3: `GAP-ASSESSMENT.md`** — a matrix of **requirement → frameworks (GDPR / UK GDPR / LGPD /
      CCPA-CPRA + comparable US state acts) → current state → gap**. Rows: lawful basis & transparency,
      right of access/portability (✓ export), erasure (✓ 30-day + cascade), rectification (✓ Settings +
      LinkedIn refresh), restriction/objection (✓ consent withdrawal), consent + records (✓), breach
      notification (✓ runbook + email channel), retention/minimization (✓ crons), security of processing
      (✓ strong posture), records of processing (✓ ROPA), cookies/ePrivacy (✓ essential-only + notice),
      CCPA "do not sell/share" (✓ — we don't sell; statement only), age (✓ 16+ affirmation).
      **Residual gaps / human to-dos:** lawyer review of all DRAFTs; appoint privacy contact/DPO if
      required; sign each sub-processor's DPA; assess EU/UK representative + ANPD (Brazil) obligations;
      the LinkedIn-ToS scraping risk (Apify dormant); fill the `[BRACKETED]` business inputs.

- [ ] **Step 4:** Each file opens with `> **DRAFT — requires legal review.**` + date. **Checkpoint (NO COMMIT).**

---

## Task 3: Breach runbook + DPA template

**Files:** Create `docs/compliance/BREACH-RUNBOOK.md`, `docs/compliance/DPA-TEMPLATE.md`

- [ ] **Step 1: `BREACH-RUNBOOK.md`** — sections:
  1. **Detection** — sources (monitoring, reports, sub-processor notice).
  2. **Triage & risk assessment** — assess risk to data subjects' rights/freedoms; severity levels.
  3. **Containment & remediation** — revoke tokens (`forceLogoutAll`/token nulling), rotate secrets,
     patch.
  4. **Authority notification** — **GDPR Art. 33: within 72 hours** of awareness (what to include:
     nature, categories/approx numbers, consequences, measures). LGPD Art. 48 (ANPD) likewise.
  5. **Data-subject notification** — **Art. 34 / LGPD Art. 48** when high risk; sent via the stored
     `email` (Resend) — include the **breach-notice email template** (subject + body, `[BRACKETED]`
     specifics).
  6. **Record-keeping** — log every incident (date, scope, actions, notifications).
  7. **Roles & contacts** — `[INCIDENT_OWNER]`, `[PRIVACY_CONTACT_EMAIL]`, supervisory authority
     `[SUPERVISORY_AUTHORITY]`.

- [ ] **Step 2: `DPA-TEMPLATE.md`** — a Data Processing Agreement template (for B2B customers / records):
      parties, subject-matter & duration, nature/purpose, data types & subjects, controller vs processor
      obligations, sub-processor terms, security measures, breach-assistance, DSR-assistance,
      deletion/return on termination, audit rights, international-transfer clauses (SCCs). Mark clearly as a
      **template** requiring legal completion; use `[BRACKETED]` party fields.

- [ ] **Step 3:** Both open with `> **DRAFT — requires legal review.**`. **Checkpoint (NO COMMIT).**

---

## Task 4: Privacy Policy rewrite — `landing/app/privacy/page.tsx`

**Files:** Rewrite `landing/app/privacy/page.tsx` (mirror the existing page's component shape + Tailwind classes)

- [ ] **Step 1: Rewrite the page** as a comprehensive privacy notice. Keep the existing visual structure
      (`<main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">`, `<h1 className="... text-cream">`,
      `space-y-6 text-sm`), add section subheadings. Required sections (each must contain the specifics noted):
  1. **Who we are** — controller `[LEGAL_ENTITY_NAME]`, `[BUSINESS_ADDRESS]`, contact
     `[PRIVACY_CONTACT_EMAIL]`, `[DPO_OR_REP_CONTACT]`. "Last updated" + policy version (`2026-06-15`).
  2. **Data we collect & sources** — from LinkedIn OIDC (member id, name, headline, picture, email);
     profile attributes you set (industry/country); **posts you submit**; engagement actions; billing
     (via Stripe — we don't store card data); technical/session data. **No third-party scraping.**
  3. **Why we use it + legal bases** — the **hybrid** model: contract (core service), legitimate
     interest (feed, security), **consent** (marketing, analytics — off by default), legal obligation
     (billing, consent records, audit).
  4. **Who we share with** — sub-processors (link to the sub-processor list / name them); **"we do NOT
     sell or share your personal information"** for cross-context advertising.
  5. **International transfers** — US processors under **SCCs**.
  6. **How long we keep it** — summarize the retention policy (deletion on request: 30-day grace;
     dormancy 24 months; billing retained for tax).
  7. **Your rights** — access, rectification, **erasure**, restriction, objection, **portability**,
     **withdraw consent**, and the right to **lodge a complaint** with a supervisory authority. **How to
     exercise:** self-service in **Settings → Privacy & Data** (export, delete, consent toggles), or
     contact `[PRIVACY_CONTACT_EMAIL]`.
  8. **California (CCPA/CPRA)** — categories collected/disclosed; **"we do not sell or share"**; rights
     to know/delete/correct/opt-out; non-discrimination; authorized agents.
  9. **Brazil (LGPD)** — Art. 18 rights; the ANPD; `[DPO_OR_REP_CONTACT]` (encarregado).
  10. **Cookies & storage** — essential storage only; link to **`/cookies`**.
  11. **Children / age** — service is for users **16+**.
  12. **Changes** — we notify + re-prompt for acknowledgment when the policy materially changes.

- [ ] **Step 2:** Add a code comment `{/* DRAFT — requires legal review. */}` at the top of the
      component, and a visible "Last updated: June 2026 — draft pending legal review" line.

- [ ] **Step 3: Verify** — `pnpm lint`, `pnpm --filter landing build`, `npx prettier --check "landing/app/privacy/page.tsx"`.

- [ ] **Step 4: Checkpoint (NO COMMIT).**

---

## Task 5: Terms rewrite + age affirmation — `landing/app/terms/page.tsx`

**Files:** Rewrite `landing/app/terms/page.tsx`

- [ ] **Step 1: Rewrite** keeping the page's visual shape. Required sections:
  1. **Acceptance** — by using the service you agree to these terms; you confirm you are **16+**.
  2. **The service** — what Link Into The SSI does.
  3. **Your LinkedIn account** — you grant permission (via OAuth) to read your posts and publish
     comments/reactions on your behalf; you remain responsible for that activity.
  4. **Acceptable use** — no spam, no abuse, no automated/bot activity beyond the provided features.
  5. **Subscriptions & billing** — monthly billing via Stripe; cancellation effective end of period;
     deletion cancels billing.
  6. **Suspension, ban & deletion** — we may suspend for misuse; you may delete your account (30-day
     grace); required billing records are retained.
  7. **LinkedIn User Agreement** — you must also comply with LinkedIn's terms.
  8. **Disclaimers & liability** — `[standard clauses — legal to complete]`.
  9. **Governing law** — `[GOVERNING_LAW_JURISDICTION]`.
  10. **Changes & contact** — `[PRIVACY_CONTACT_EMAIL]`. "Last updated" line.

- [ ] **Step 2:** `{/* DRAFT — requires legal review. */}` comment + visible draft notice.
- [ ] **Step 3: Verify** — `pnpm lint`, `pnpm --filter landing build`, `npx prettier --check "landing/app/terms/page.tsx"`.
- [ ] **Step 4: Checkpoint (NO COMMIT).**

---

## Task 6: Compliance index + PLATFORM.md

**Files:** Create `docs/compliance/README.md`; modify `docs/PLATFORM.md`

- [ ] **Step 1: `docs/compliance/README.md`** — index the six compliance docs with one-line summaries +
      the consolidated **human/legal to-do list** (lawyer review; fill `[BRACKETED]` inputs; sign
      sub-processor DPAs; appoint DPO/representative if required; ANPD/EU-rep assessment; keep the ROPA +
      sub-processor list in sync; the Apify §4.4 hard gate).

- [ ] **Step 2: `docs/PLATFORM.md`** — add a short **"Compliance Documentation"** note (in §17 Security/
      Privacy or a new subsection) pointing to `docs/compliance/`; update §15 to note the `/privacy` and
      `/terms` pages are the full GDPR/LGPD/US drafts (pending legal review) and link `/cookies`. Extend the
      footer "Last updated" with Phase 4.

- [ ] **Step 3: Verify + Checkpoint (NO COMMIT).**

---

## Phase 4 completion check

- [ ] `docs/compliance/` has all 7 files, each headed **DRAFT — requires legal review**, with
      `[BRACKETED]` inputs intact (not invented).
- [ ] `landing/app/privacy/page.tsx` + `terms/page.tsx` rewritten (DRAFT); `pnpm --filter landing build`
      succeeds; `pnpm lint` clean; prettier clean on the two pages.
- [ ] ROPA covers every personal-data field in `convex/schema.ts`; nothing describes Apify as active.
- [ ] `docs/PLATFORM.md` references the compliance docs.
- [ ] **Nothing committed.**

## Human / legal follow-ups (carried from spec §10 — restate in README)

Fill business inputs; legal review of all DRAFTs; sign each sub-processor DPA; confirm lawful-basis
posture; assess DPO + EU/UK representative + ANPD; keep ROPA/sub-processors current; honor the Apify
hard gate.

## Self-Review (performed during authoring)

- **Spec coverage:** A = ROPA (Task 1) + sub-processors/retention/gap (Task 2); F = breach runbook +
  DPA (Task 3) + privacy/terms rewrite + age affirmation (Tasks 4–5); index + PLATFORM (Task 6).
  `/cookies` was delivered in Phase 3b.
- **Placeholder discipline:** `[BRACKETED]` business inputs are intentional and must be preserved; "DRAFT
  — requires legal review" headers are mandatory. These are not TODO-style placeholders — they're the
  legally-required human inputs the spec (§0/§10) calls out.
- **Accuracy:** docs describe the **implemented** system (Phases 1–3); Apify is documented as
  **dormant/disabled**, never as active processing.
- **No-commit rule:** every task ends in a no-commit checkpoint.

```

```
