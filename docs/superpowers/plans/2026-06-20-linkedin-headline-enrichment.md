# LinkedIn Headline Enrichment — Implementation Plan (DEFERRED)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans. Steps use checkbox (`- [ ]`) syntax.

> **⚠️ DEFERRED + COMPLIANCE-GATED.** The *code* in Tasks 1–3 is inert while the Apify profile scrape stays disabled (
`appSettings.apifyProfileScrapeEnabled` absent/false) and is therefore safe to build. **Do NOT enable the profile scrape
** (Task 4's gate) until the compliance preconditions are signed off. The Apify scrape is disabled at launch and
> undisclosed; re-enabling has mandatory compliance steps. See the privacy compliance program + the Apify
> dormant-compliance gate.

**Goal:** Populate and surface each member's **LinkedIn headline** (e.g. "Senior Product Designer") — captured by the
Apify profile scrape — in the sidebar user chip and post-author rows, falling back to the member's **industry** when no
headline exists.

**Architecture:** The display path already exists — `getMe` returns `headline` (not stripped by `toSafeMe`) and
`toFeedAuthor` projects it to feed posts. The only missing piece is the **write**: thread `headline` through the
existing scrape pipeline (`parseProfileScrapeResult` → `applyScrapedProfileHandler` → `applyScrapedProfile`), then show
it in the UI with an `industry` fallback. No schema change — `users.headline` already exists.

**Tech Stack:** Convex (internal action/mutation), React 19, vitest. Apify profile-scraper actor.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` §12 (Deferred plan A). **Builds on:**
`docs/superpowers/specs/2026-06-14-profile-enrichment-design.md` and the existing scrape pipeline in
`convex/jobs/scrapeProfileApify.ts`.

## Global Constraints

- **Commits:** agent never runs `git commit`/`git push` (per `CLAUDE.md`); each task ends with a **Checkpoint (Henriko
  commits)**.
- **Convex tooling:** use **pnpm**; run any `convex` CLI from the **repo root** (running it inside `convex/` wipes the
  deployment). Convex tests run via `pnpm --filter convex test` (vitest; mocks `convex/server`, unit-tests pure logic —
  no `convex-test`).
- **Compliance gate (HARD precondition for Task 4 only):** the scrape must not be enabled until Apify is disclosed as a
  profile-data sub-processor, the lawful basis + data-minimization for headline are documented, and the privacy policy
  reflects it. Tasks 1–3 ship inert behind the disabled flag.
- **Fallback rule:** UI shows `headline ?? industry` — never a fabricated value.

---

### Task 1: Capture `headline` in `parseProfileScrapeResult`

**Files:**

- Modify: `convex/jobs/scrapeProfileApify.ts` (the `ApifyProfileResult` interface, `ParsedProfile`, and
  `parseProfileScrapeResult`)
- Test: `convex/jobs/scrapeProfileApify.test.ts` (extend)

**Interfaces:**

- Produces: `ParsedProfile.headline?: string`.

- [ ] **Step 1: Write the failing test**

Add to `convex/jobs/scrapeProfileApify.test.ts`:

```ts
it('extracts a non-empty headline from the dataset item', () => {
  const parsed = parseProfileScrapeResult([{ headline: 'Senior Product Designer · Fintech' }])
  expect(parsed.headline).toBe('Senior Product Designer · Fintech')
})

it('omits headline when absent or blank', () => {
  expect(parseProfileScrapeResult([{ headline: '' }]).headline).toBeUndefined()
  expect(parseProfileScrapeResult([{}]).headline).toBeUndefined()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter convex test scrapeProfileApify`
Expected: FAIL (headline not extracted).

- [ ] **Step 3: Implement the extraction**

In `convex/jobs/scrapeProfileApify.ts`:

- Add `headline?: string` to `interface ApifyProfileResult`.
- Add `headline?: string` to `interface ParsedProfile`.
- In `parseProfileScrapeResult`, after the locale block, add:

```ts
  const headline = first.headline
  if (typeof headline === 'string' && headline.length > 0) out.headline = headline
```

> **Field-name note (not a placeholder — an integration fact to confirm):** the "Profile details no email" actor returns
> the member headline on the dataset item; the common key is `headline`. Confirm against the live Apify dataset (the
> file
> already advises "check Apify console"). If the actor names it differently (e.g. `occupation`), read that key instead —
> keep the defensive `typeof … === 'string' && length > 0` guard.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter convex test scrapeProfileApify`
Expected: PASS.

- [ ] **Step 5: Update the no-fields early-return + the action's `applyScrapedProfile` call**

In `scrapeUserProfile`, include `headline` in the "nothing parsed" guard so a headline-only result still writes:

```ts
    if (
      parsed.country === undefined &&
      parsed.location === undefined &&
      parsed.primaryLocale === undefined &&
      parsed.headline === undefined
    ) {
```

(The existing `await actionCtx.runMutation(internal.users.applyScrapedProfile, { userId, ...parsed })` already spreads
`parsed`, so `headline` flows once Task 2 adds the arg.)

- [ ] **Step 6: Update the header comment** at the top of the file to mention `users.headline (refresh)` alongside
  country/location/primaryLocale.

- [ ] **Step 7: Checkpoint (Henriko commits)**

---

### Task 2: Thread `headline` through `applyScrapedProfile`

**Files:**

- Modify: `convex/users.ts` (`ScrapedProfileDb` is fine as-is; `ApplyScrapedProfileArgs`, `applyScrapedProfileHandler`,
  and the `applyScrapedProfile` internalMutation args)
- Test: `convex/users.applyScrapedProfile.test.ts` (extend)

**Interfaces:**

- Consumes: `ParsedProfile.headline` (Task 1).
- Produces: `applyScrapedProfile` writes `users.headline` when provided (refresh semantics, like `location`).

- [ ] **Step 1: Write the failing test**

Add to `convex/users.applyScrapedProfile.test.ts` (match the existing fake-db style in that file):

```ts
it('refreshes headline when provided', async () => {
  const db = makeDb({ headline: 'Old title' }) // use the file's existing fake-db helper
  await applyScrapedProfileHandler(db, { userId: 'u1', headline: 'New title' })
  expect(db.patched).toMatchObject({ headline: 'New title' })
})

it('does not write headline when omitted', async () => {
  const db = makeDb({ headline: 'Keep me' })
  await applyScrapedProfileHandler(db, { userId: 'u1', location: 'Lisbon' })
  expect(db.patched).not.toHaveProperty('headline')
})
```

> Reuse the existing test's db-fake constructor; the names above (`makeDb`, `db.patched`) are illustrative — match what
> the file already defines.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter convex test applyScrapedProfile`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `convex/users.ts`:

- Add `headline?: string` to `interface ApplyScrapedProfileArgs`.
- In `applyScrapedProfileHandler`, add (refresh-when-provided, like `location`):

```ts
  if (args.headline !== undefined) patch.headline = args.headline
```

- Add `headline: v.optional(v.string())` to the `applyScrapedProfile` internalMutation `args`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter convex test applyScrapedProfile`
Expected: PASS.

- [ ] **Step 5: Confirm the read path needs no change**

Verify (by reading): `toSafeMe` (`convex/users.ts`) does not strip `headline`, and `toFeedAuthor` (`convex/feed.ts`)
already returns it. No edits expected. Note the confirmation in the checkpoint.

- [ ] **Step 6: Checkpoint (Henriko commits)**

---

### Task 3: Surface the headline in the UI (with industry fallback)

**Files:**

- Modify: `app/src/components/shell/UserMenu.tsx` (show name + `headline ?? industry` subtitle; use the real `getMe`)
- Modify: `app/src/components/PostCard.tsx` (author subtitle → `headline ?? industry`)
- Test: `app/src/components/PostCard.test.tsx` (extend)

**Interfaces:**

- Consumes: `getMe` (`headline`, `industry`, `name`, `profilePictureUrl`); `PostWithAuthor.author.headline` /
  `.industry`.

- [ ] **Step 1: PostCard fallback — write the failing test**

Add to `app/src/components/PostCard.test.tsx` (using its existing render helper / fixture):

```tsx
it('falls back to industry when the author has no headline', () => {
  renderCard({ author: { name: 'Léo', headline: undefined, industry: 'Fintech' } })
  expect(screen.getByText('Fintech')).toBeInTheDocument()
})
```

> Use the file's existing post fixture/helper; only `author.headline`/`author.industry` matter here. (Add
`industry?: string` to the `PostWithAuthor['author']` type if not already present — `toFeedAuthor` already returns it.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/PostCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the fallback in `PostCard.tsx`**

- Add `industry?: string` to the `author` shape in `PostWithAuthor`.
- Replace the headline line with:

```tsx
{(post.author.headline ?? post.author.industry) && (
  <p className="m-0 text-xs text-muted-foreground">{post.author.headline ?? post.author.industry}</p>
)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/PostCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the real user + subtitle into `UserMenu`**

In `app/src/components/shell/UserMenu.tsx`, fetch the signed-in user and render the subtitle:

```tsx
const me = useQuery(api.users.getMe, { sessionToken: sessionStorage.getItem('sessionToken') ?? undefined })
const name = me?.name ?? t('nav.openMenu')
const subtitle = me?.headline ?? me?.industry
// …in the trigger, under the name:
{subtitle ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
// …and pass the avatar picture:
<Avatar name={name} src={me?.profilePictureUrl} size="sm" />
```

(Adjust the trigger layout to stack name + subtitle.)

- [ ] **Step 6: Typecheck + suites**

Run:
`pnpm --filter app exec tsc --noEmit && pnpm --filter app exec vitest run src/components/PostCard.test.tsx src/components/shell/UserMenu.test.tsx`
Expected: PASS.

- [ ] **Step 7: Checkpoint (Henriko commits)**

---

### Task 4: Compliance gate + documentation (DO NOT skip; DO NOT auto-enable)

**Files:**

- Modify: `docs/compliance/SUBPROCESSORS.md`, `docs/compliance/DATA-INVENTORY.md`
- Modify: `docs/PLATFORM.md` (profile-enrichment section: add `headline`)
- (Legal) the published privacy policy / policy version

**Interfaces:** none (compliance + docs).

- [ ] **Step 1: Document the headline data flow**

In `DATA-INVENTORY.md`, add `headline` to the LinkedIn-profile-scrape-sourced fields (alongside location/locale), with
purpose ("display of professional context in the feed and account UI") and lawful basis (to be confirmed with the
privacy program — legitimate interest vs. consent). In `SUBPROCESSORS.md`, confirm Apify is listed for **profile**
data (not only post sync).

- [ ] **Step 2: Update `PLATFORM.md`**

Add `headline` to the profile-enrichment fields the scrape populates and note the `headline ?? industry` UI fallback.

- [ ] **Step 3: Record the ENABLE GATE (do not flip the flag here)**

Write, in this plan's tracking note and the compliance gap log, that turning on
`appSettings.apifyProfileScrapeEnabled` (the switch that makes Tasks 1–3 actually populate data) is **blocked** until: (
a) Apify disclosed as a profile sub-processor, (b) lawful basis + data-minimization for headline signed off, (c) privacy
policy updated + version bumped (triggering re-consent), per the Apify dormant-compliance gate. **This plan's code is
safe to merge while the flag stays off; enabling is a separate, gated decision Henriko/legal makes.**

- [ ] **Step 4: Checkpoint (Henriko commits)** — and explicitly flag to Henriko that enabling the scrape is out of scope
  for the agent.

---

## Done Criteria

- [ ] `parseProfileScrapeResult` + `applyScrapedProfile` capture/write `headline` (tests green).
- [ ] UI shows `headline ?? industry` in the user chip and post-author rows; never a fabricated value.
- [ ] Read path confirmed unchanged (`toSafeMe`/`toFeedAuthor` already expose `headline`).
- [ ] Compliance docs updated; the enable-gate is recorded and **the scrape flag is NOT flipped by this work**.
- [ ] `pnpm verify` passes.

## Self-Review (completed by plan author)

- **Spec coverage:** §12 Deferred plan A → Tasks 1–3 (capture/write/surface) + Task 4 (compliance gate + fallback rule).
- **Placeholder scan:** the Apify headline key (Task 1) and the test fake-db names (Task 2) are flagged as "confirm
  against the existing file," not invented APIs — both reference real, already-tested functions.
- **Type consistency:** `ParsedProfile.headline` (Task 1) → `ApplyScrapedProfileArgs.headline` (Task 2) →
  `applyScrapedProfile` arg; `PostWithAuthor.author.industry` added where `toFeedAuthor` already supplies it.
