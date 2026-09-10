# Landing ICP + CTA microcopy — design (R11 → R12)

> Date: 2026-09-06 ·
>
Items: [R11](../../../backlog/revenue/R11-one-icp-for-the-landing.md), [R12](../../../backlog/revenue/R12-cta-microcopy-and-fear-beside-the-button.md)
> Order: R11 decides the audience, R12 writes the buttons in that audience's words. One pass over the dictionaries, not
> two.

## 1. The decision (R11)

**One ICP, defined by buying criteria** — approved by Henriko 2026-09-06.

|                                       |                                                                                                                                                                   |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Who**                               | Someone whose next piece of work depends on the right people finding them on LinkedIn. Employed specialist or independent consultant/freelancer — the same buyer. |
| **Trigger**                           | Income or next role depends on being found, and nothing is arriving.                                                                                              |
| **Pain**                              | Good at the work, invisible to the algorithm.                                                                                                                     |
| **Prior attempt**                     | Posted more. Applied, or pitched. Cold DMs. Silence.                                                                                                              |
| **Proof needed**                      | That engagement is the lever, visible on their own account.                                                                                                       |
| **Difference between the two halves** | Only *what arrives* — an offer or a client. **Never named separately in copy.**                                                                                   |

R11's Do section forbids defining an ICP demographically ("Demographics say nothing about why they
buy"). Employed vs. independent is a demographic split; the buying criteria above are identical, so
this is one ICP, not two merged. The unifying word is the outcome: **the right people come to you.**

**Omission filter.** The page keeps excluding automation seekers and quota-carrying sales teams.
`hero.subLine2` ("Every action is yours. Nothing automated.") already does that work — it is unchanged.

**Accepted cost.** The employed half churns on hire. Mitigation: copy leans on the durable outcome (inbound work) rather
than the terminal one (a job). R18 segments churn by arrival channel later.

**Forbidden phrasing.** Never "for professionals and freelancers", never a list of job titles. That
list is the "who talks to everyone convinces no one" failure this item exists to fix.

## 2. Awareness level (R11 step 2)

**Problem-aware, SSI-unaware.** They feel invisible; they have never heard of the SSI.

Two consequences, both binding on the copy:

1. **Section order does not change** — Hero → PainBeat → HowItWorks → SSIExplainer. The SSI is the
   mechanism reveal, not the promise.
2. **The hero must not lead with the SSI.** "Raise your SSI" is solution-aware copy for an audience
   that isn't. This is why R11's Option 2 hero was rejected.

R11 is therefore a wording pass, not a restructure.

## 3. Bullseye (R11 step 3)

Channels Henriko can work this quarter: his own LinkedIn presence, communities, direct outreach,
paid ads. All four reach this ICP directly — the ICP is reachable, not a wish.

Standing caution: paid ads is the only cold channel and therefore the only one that shows the page's
real ceiling. Warm traffic from Henriko's network forgives the page
([R11](../../../backlog/revenue/R11-one-icp-for-the-landing.md) Don't).

## 4. Scope boundary (approved 2026-09-06)

Left alone, owned by later items in the backlog order:

- **`ssiExplainer.stats`** (45% / 5× / +51%) — untouched. All three are inbound-framed and already
  on-audience; only their verifiability is in question, and that is **R10**.
- **`proof.proofCardHeadline` / `proofCardBody` / `proofCardLink`** — untouched. The
  "check your SSI on LinkedIn" link is the Sales Navigator paywall problem, owned by **R10 / R15**.
- **`faq.items[3]`** ("You can check your real score on LinkedIn anytime") — same paywall problem,
  same owners. Known-stale, deliberately not fixed here.
- **App-side CTAs** — already correct. R03 landed `startTrialCta` and `switchPlan` in
  `app/src/i18n/locales/en.json:182-183`. R12 item 5 needs no work.
- **Feature scope** — R11's risk note: the industry filter, reach control and AI drafts are
  audience-neutral. Only outcome words change; no capability is added, removed or re-tiered.

## 5. Exact `en.json` copy

Everything not listed here is unchanged. `landing/i18n/dictionaries/en.json`.

### `meta`

| key             | new value                                                                                                                                |
|-----------------|------------------------------------------------------------------------------------------------------------------------------------------|
| `title`         | `Link Into The SSI · Get Found on LinkedIn`                                                                                              |
| `description`   | `A focused feed of the professionals and conversations in your field. Show up where it matters, and the right people start finding you.` |
| `ogTitle`       | *(unchanged)*                                                                                                                            |
| `ogDescription` | `Stop chasing work. Show up where it matters and let the right people find you.`                                                         |

### `nav`

| key   | new value           |
|-------|---------------------|
| `cta` | `Start 7-day trial` |

Lowest-commitment wording for the cold visitor (R12 §2, funnel-stage match).

### `hero`

| key             | new value                                                                                                                           |
|-----------------|-------------------------------------------------------------------------------------------------------------------------------------|
| `headlineLine1` | `Stop chasing work.`                                                                                                                |
| `headlineLine2` | *(unchanged — `Let them find you.`)*                                                                                                |
| `subLine1`      | `A focused feed of the professionals and conversations in your field. Show up where it matters, and LinkedIn starts surfacing you.` |
| `subLine2`      | *(unchanged — the omission filter)*                                                                                                 |
| `cta`           | `Start my 7-day trial with LinkedIn`                                                                                                |
| `ctaDisclaimer` | *(unchanged — the cost trigger)*                                                                                                    |
| `ctaTrust`      | **NEW** — `Official LinkedIn sign-in · Name, photo and email only · Nothing posted for you`                                         |

`headlineLine1`: "jobs" was the only word on the page narrowing the ICP to one half. pt and es were
already neutral, so this is the en outlier being brought in line, not a headline reopen.

`subLine1`: "your SSI climbs" removed. At problem-aware/SSI-unaware the acronym's first appearance
cannot be unexplained ([R11](../../../backlog/revenue/R11-one-icp-for-the-landing.md) Don't: insider jargon on a reach
surface). `SSIExplainer` teaches the term
two sections down and keeps it.

`ctaTrust`: every clause is verifiable. OIDC-only scopes are asserted in
`convex/linkedin/oauth.test.ts`; there are no API writes on the member's behalf (memory
`linkedin-api-access-constraints`). R12's suggested "Within LinkedIn's terms" is **dropped** — a legal
claim R12 itself routes through B29, and the three facts carry the reassurance without it.

### `painBeat`

| key             | new value                                                                                                                                                                                        |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `headlineLine1` | `You post. You reach out.`                                                                                                                                                                       |
| `headlineLine2` | *(unchanged — `Silence.`)*                                                                                                                                                                       |
| `body`          | `The best work never reaches you, because LinkedIn never surfaces you. Recruiters and clients search, and the algorithm ranks. An inactive profile stays invisible, no matter how good you are.` |

"You apply" was the job-seeker verb. "You reach out" covers applying and pitching in one beat and
keeps the two-beat rhythm against "Silence."

### `howItWorks.steps[2]`

| key     | new value                                                                                                         |
|---------|-------------------------------------------------------------------------------------------------------------------|
| `title` | `The right people start finding you`                                                                              |
| `body`  | `As your SSI climbs, you surface in more searches and feeds. The people looking for what you do reach you first.` |

### `ssiExplainer`

| key     | new value                                                                                                                                                                                  |
|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `intro` | `Your Social Selling Index is LinkedIn's own 0–100 measure of how findable you are to recruiters, clients and peers. Four pillars, 25 points each. Engagement is the fastest one to move.` |

`pillars` and `stats` unchanged (§4).

### `pricing`

| key            | new value                                                                                          |
|----------------|----------------------------------------------------------------------------------------------------|
| `trialNote`    | `No charge until 50 interactions or 7 days, whichever comes first. Card required, cancel anytime.` |
| `plans[0].cta` | `Start 7-day Starter trial`                                                                        |
| `plans[1].cta` | `Start 7-day Growth trial`                                                                         |
| `plans[2].cta` | `Start 7-day Pro trial`                                                                            |

`enterpriseCta` stays `Talk to us` (R12 §3). The plan names are written as literals — this dictionary
has no interpolation in the plan array.

### `finalCta`

| key             | new value                                                 |
|-----------------|-----------------------------------------------------------|
| `headlineLine1` | *(unchanged)*                                             |
| `headlineLine2` | *(unchanged)*                                             |
| `subheadline`   | `Seven days to see it work. Build real SSI from day one.` |
| `cta`           | `Start my 7-day trial with LinkedIn`                      |
| `ctaTrust`      | **NEW** — same string as `hero.ctaTrust`                  |

Only `ctaTrust` is added, not `ctaDisclaimer`: the block already carries `subheadline` + `cta` +
`earlyAccess`, and R12's Don't forbids stacking triggers into a paragraph. The cost rule is stated at
the hero and in `pricing.trialNote`.

## 6. Component changes

Two one-line insertions. Both blocks are already `flex flex-col items-center gap-3`.

- `landing/components/Hero.tsx` — after the `ctaDisclaimer` `<p>`, add
  `<p className="text-xs tracking-wide text-cream/40">{dict.ctaTrust}</p>`.
- `landing/components/FinalCTA.tsx` — after the CTA `<a>`, before the `earlyAccess` `<p>`, add
  `<p className="text-xs tracking-wide text-cream/40">{dict.ctaTrust}</p>`.

No prop or type changes: `Dictionary` is derived from `en.json`, so the new keys type-check once en,
pt and es all carry them. **All three locales must gain the key or `tsc` fails.**

## 7. Locale rules (pt, es)

- `pt` is **Brazilian Portuguese**, `es` is **neutral Latin-American** (memory `i18n-locale-standards`).
- Sentence case for labels; no Title Case, no "Cancela El"-style slop.
- pt and es hero/final headlines are already audience-neutral — **do not rewrite them**. Only the
  keys listed in §5 change, plus the new `ctaTrust`.
- Translate for meaning, not word order. `ctaTrust` must stay one line at 375px; shorten the wording
  before letting it wrap to three lines.

## 8. Acceptance

- [ ] No CTA on the landing says "Start free" in any locale.
- [ ] Every trial CTA names the trial length; the three plan cards name the plan.
- [ ] `ctaTrust` renders under the hero and final CTAs in all three locales and states only
  verifiable facts.
- [ ] No copy names two audiences or lists job titles.
- [ ] en, pt and es have identical key sets.
- [ ] `pnpm verify` green (`format:check`, `lint`, `typecheck`, `-r test`).
- [ ] Hero and FinalCTA checked at 375px in pt and es — no three-line trigger, no horizontal scroll.
- [ ] `docs/PLATFORM.md` §15 and §1 updated.
- [ ] **Not committed** (`CLAUDE.md`).

## 9. Docs

- `docs/PLATFORM.md` §15 (Landing) — the audience and awareness level as a short subsection, plus a
  CTA table (location, label, trigger line, href). Update the "Notable section content" paragraph
  where it describes `PainBeat`/`Hero`.
- `docs/PLATFORM.md` §1 (Overview) — the one-line product description, aligned to the ICP.
- `backlog/revenue/README.md` — flip R11 and R12 to DONE.
