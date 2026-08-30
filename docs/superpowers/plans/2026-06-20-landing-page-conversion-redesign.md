# Landing Page Conversion Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/landing` marketing page to convert better — outcome-led hero, a pain beat, network-effect
framing, honest (non-fabricated) proof, a 3-tier pricing presentation with an annual-default toggle, and trial copy that
matches the new card-required, value-milestone model.

**Architecture:** All changes live in the `landing/` Next.js package. Components stay server components except where
local state is required (`Pricing` toggle, `FAQ` accordion → `'use client'`). The page is reordered to richardrx's *
*Hero → Pain → Solution → Proof → CTA** spine. Fabricated proof components (`StatsBar`, `Testimonials`) are removed. No
backend calls — pricing/trial copy is presentational; the live promo counter and annual checkout wiring are **Plan 2 (
backend)**.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.9, Tailwind 3.4 with custom tokens (
`landing/tailwind.config.ts`). Package manager: **pnpm** (monorepo).

**Design source:
** [2026-06-20-landing-conversion-redesign-design.md](../specs/2026-06-20-landing-conversion-redesign-design.md) · *
*Evidence:** [richardrx insights](../research/2026-06-20-richardrx-landing-insights.md)

## Global Constraints

Every task implicitly includes these:

- **NEVER commit.** The agent edits files only. Henriko commits at each checkpoint. Each task ends at a verified,
  ready-to-commit state — no `git commit`/`git push` by the agent. (Project rule, verbatim: "NEVER commit to git… the
  user (Henriko) makes all commits themselves.")
- **No fabricated proof.** Every claim must be externally citable (LinkedIn data, attributed) or honestly framed
  (founding promo, the user's own SSI). No invented user counts, engagement totals, SSI-gain averages, or testimonials.
- **Keep the aesthetic.** Dark-navy/gold/serif. Tokens only: `ink`(`-800/-600/-400`), `cream`(`/muted`/`/dim`), `gold`(
  `/-light`), `lnblue`(`/-light`). Fonts: `font-display` = Cormorant Garamond (headings), `font-body` = DM Sans. Do not
  introduce new color families, purple gradients, bento grids, or AI-orb motifs.
- **CTA dominance.** On every screen the primary CTA (gold button) must be the single highest-contrast element. Never
  two equal-weight buttons.
- **Performance.** Sub-3s, mobile-first. Prefer server components; avoid unnecessary client JS. Verify mobile at 375px.
- **Trial copy (verbatim frame).** "Start free — no charge until 50 interactions or 7 days, whichever comes first. Card
  required, cancel anytime." Retire every instance of "3-day free trial" and "No credit card required."
- **Annual pricing math.** Annual = monthly × 10 (i.e., 2 months free). Starter $5→$50/yr, Growth $15→$150/yr, Pro $50→$
  500/yr. Annual toggle **defaults to annual**.
- **Honest features only.** Market only shipped capabilities. AI assist (shipped) is sold by **outcome**, never "Powered
  by AI." Omit unshipped features (featured posts, recruiter radar).
- **Formatting.** After edits, format ONLY your changed files: `pnpm exec prettier --write <changed paths>`
  (prettier-plugin-tailwindcss canonicalizes Tailwind class order). Do NOT run repo-wide `pnpm format` — it reformats
  unrelated docs across the repo.

### Per-task verification commands (no unit-test harness in `landing/`)

```bash
pnpm --filter landing exec tsc --noEmit   # typecheck (fast)
pnpm build:landing                        # next build — 0 errors, 0 warnings
pnpm lint                                 # eslint . --max-warnings 0
pnpm exec prettier --write <changed files>  # scope to YOUR files, never repo-wide
pnpm dev:landing                          # visual check at http://localhost:3000
```

---

## File Structure

| Action | Path                                  | Responsibility                                                                                                                                  |
|--------|---------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| Modify | `landing/components/Hero.tsx`         | Outcome-led headline, sub-headline, trust line, new CTA + click-trigger; replace slot-machine with `SSIGauge`; remove fabricated "500+" line    |
| Create | `landing/components/SSIGauge.tsx`     | Pure-CSS/SVG signature animation: an SSI ring filling 40→70                                                                                     |
| Create | `landing/components/PainBeat.tsx`     | Short high-contrast pain/enemy section                                                                                                          |
| Modify | `landing/components/HowItWorks.tsx`   | Reframe 3 steps around the network-effect mechanism + moat line                                                                                 |
| Modify | `landing/components/SSIExplainer.tsx` | Plain-language SSI, lead with outcome, keep 4 pillars + real LinkedIn stats                                                                     |
| Create | `landing/components/Proof.tsx`        | Honest proof: founder note, "watch your own SSI", founding promo (no fake counter)                                                              |
| Delete | `landing/components/StatsBar.tsx`     | Fabricated platform stats — removed                                                                                                             |
| Delete | `landing/components/Testimonials.tsx` | Fabricated testimonials — removed (real embed component is a later, data-gated build)                                                           |
| Modify | `landing/components/Features.tsx`     | 4→3 cards, outcome-framed AI, drop "coming soon"                                                                                                |
| Modify | `landing/components/Pricing.tsx`      | 3 tiers + Enterprise line, annual/monthly toggle (default annual), "Recommended" Growth, new trial copy, serial-position order (`'use client'`) |
| Modify | `landing/components/FAQ.tsx`          | Objection-led order (safety first), honest trial-scope answer, remove no-card claims                                                            |
| Modify | `landing/components/FinalCTA.tsx`     | Refined copy, single dominant CTA, honest founding-cohort scarcity                                                                              |
| Modify | `landing/components/Nav.tsx`          | CTA copy "Join free"→"Start free"                                                                                                               |
| Modify | `landing/app/page.tsx`                | New section order; drop StatsBar/Testimonials; add PainBeat/Proof                                                                               |
| Modify | `landing/app/globals.css`             | Add `gaugeFill` keyframe; remove unused `slot-*` CSS                                                                                            |
| Modify | `landing/tailwind.config.ts`          | Add `gaugeFill` keyframe/animation; remove unused `slotRoll`                                                                                    |
| Modify | `docs/PLATFORM.md`                    | §15 landing section reflects new structure/copy                                                                                                 |

---

## Task 1: Hero — outcome-led, with the SSI gauge

**Files:**

- Create: `landing/components/SSIGauge.tsx`
- Modify: `landing/components/Hero.tsx` (full rewrite)
- Modify: `landing/app/globals.css` (add `gaugeFill` keyframe)
- Modify: `landing/tailwind.config.ts` (register `gaugeFill`)

**Interfaces:**

- Produces: `SSIGauge` (default export, no props) — a self-contained server component rendering an animated SVG ring + "
  70 / SSI".
- Consumes: `SIGN_IN_URL` from `../lib/links` (unchanged).

- [ ] **Step 1: Add the gauge keyframe to `globals.css`**

Append to `landing/app/globals.css` (after the existing `@keyframes slotRoll` block — that block is removed in Task 10):

```css
/* SSI gauge fill: ring grows from 40% (offset 60) to 70% (offset 30) on a pathLength=100 circle */
@keyframes gaugeFill {
    from {
        stroke-dashoffset: 60;
    }
    to {
        stroke-dashoffset: 30;
    }
}
```

- [ ] **Step 2: Register the animation in `tailwind.config.ts`**

In `landing/tailwind.config.ts`, add to `theme.extend.keyframes` and `theme.extend.animation` (keep existing entries;
`slotRoll` is removed in Task 10):

```ts
// inside keyframes: { ... }
gaugeFill: {
    from: {
        strokeDashoffset: '60'
    }
,
    to: {
        strokeDashoffset: '30'
    }
}
// inside animation: { ... }
gaugeFill: 'gaugeFill 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards'
```

- [ ] **Step 3: Create `SSIGauge.tsx`**

```tsx
// A pure-CSS/SVG signature animation: an SSI ring filling from 40 to 70 (out of 100).
// pathLength={100} normalizes the dash units so the keyframe (offset 60→30) is radius-independent.
// Server component — no client JS.
export default function SSIGauge() {
    return (
        <div
            className="relative mx-auto flex h-44 w-44 items-center justify-center"
            role="img"
            aria-label="Your LinkedIn SSI climbing from 40 to 70"
        >
            <svg
                viewBox="0 0 180 180"
                className="h-full w-full -rotate-90"
            >
                {/* Track */}
                <circle
                    cx="90"
                    cy="90"
                    r="78"
                    fill="none"
                    stroke="rgba(245,240,232,0.08)"
                    strokeWidth="6"
                />
                {/* Animated value */}
                <circle
                    cx="90"
                    cy="90"
                    r="78"
                    fill="none"
                    stroke="#C9963E"
                    strokeWidth="6"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="100"
                    className="animate-gaugeFill"
                    style={{filter: 'drop-shadow(0 0 6px rgba(201,150,62,0.45))'}}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="font-display text-5xl font-semibold text-cream">70</span>
                <span className="text-xs uppercase tracking-widest text-cream/40">Your SSI</span>
            </div>
        </div>
    )
}
```

- [ ] **Step 4: Rewrite `Hero.tsx`**

Replace the entire contents of `landing/components/Hero.tsx` with:

```tsx
import {SIGN_IN_URL} from '../lib/links'
import SSIGauge from './SSIGauge'

export default function Hero() {
    return (
        <section
            className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center">
            {/* Radial glow */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,119,181,0.10) 0%, transparent 70%)'}}
            />
            {/* Decorative rings */}
            <div className="circle-ring" style={{
                width: 560,
                height: 560,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) translateY(-40px)'
            }}/>
            <div className="circle-ring" style={{
                width: 860,
                height: 860,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) translateY(-40px)',
                opacity: 0.5
            }}/>

            <div className="relative z-10 mx-auto max-w-3xl space-y-8">
                {/* Eyebrow */}
                <div
                    className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-gold">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold"/>
                    LinkedIn growth, done with intent
                </div>

                {/* Signature animation */}
                <SSIGauge/>

                {/* Outcome-led headline */}
                <h1 className="font-display text-5xl font-semibold leading-tight text-cream md:text-7xl">
                    Stop chasing jobs.
                    <br/>
                    <span className="italic text-gold">Let them find you.</span>
                </h1>

                {/* Sub-headline: tangible, credible, viable */}
                <div className="mx-auto max-w-xl space-y-3">
                    <p className="text-lg leading-relaxed text-cream/70">
                        A private circle of professionals who boost each other&apos;s LinkedIn reach. Your SSI climbs,
                        recruiters
                        notice.
                    </p>
                    <p className="text-base leading-relaxed text-cream/50">
                        Every action is yours, under your own identity — nothing automated.
                    </p>
                </div>

                {/* CTA */}
                <div className="flex flex-col items-center justify-center gap-3 pt-2">
                    <a
                        href={SIGN_IN_URL}
                        className="group relative rounded-full bg-gold px-8 py-3.5 font-medium text-ink shadow-[0_0_32px_rgba(201,150,62,0.35)] transition-all duration-300 hover:bg-gold-light hover:shadow-[0_0_48px_rgba(201,150,62,0.5)]"
                    >
                        Start free with LinkedIn
                        <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
                    </a>
                    {/* Click trigger */}
                    <p className="text-xs tracking-wide text-cream/40">
                        Card required · No charge until 50 interactions or 7 days · Cancel anytime
                    </p>
                    {/* Above-fold trust line */}
                    <p className="text-sm text-cream-muted">We never post without your approval.</p>
                </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 opacity-30">
                <span className="text-xs uppercase tracking-widest text-cream/50">Scroll</span>
                <div className="h-10 w-px bg-gradient-to-b from-cream/40 to-transparent"/>
            </div>
        </section>
    )
}
```

- [ ] **Step 5: Verify**

```bash
pnpm format
pnpm --filter landing exec tsc --noEmit
pnpm build:landing
pnpm dev:landing
```

Expected: typecheck + build pass with 0 errors/warnings. At `localhost:3000`, the hero shows the gold SSI ring animating
to 70, the headline "Stop chasing jobs. / Let them find you.", the new sub-headline, the gold CTA "Start free with
LinkedIn", the click-trigger line, and the trust line. No "500+" line remains. Check 375px width.

- [ ] **Step 6: Checkpoint** — verification passed; ready for Henriko to commit (suggested message:
  `feat(landing): outcome-led hero with SSI gauge`).

---

## Task 2: Pain beat (new section)

**Files:**

- Create: `landing/components/PainBeat.tsx`
- Modify: `landing/app/page.tsx` (insert after `Hero`)

**Interfaces:**

- Produces: `PainBeat` (default export, no props), server component, `id="the-problem"`, `bg-ink-800`.

- [ ] **Step 1: Create `PainBeat.tsx`**

```tsx
export default function PainBeat() {
    return (
        <section
            id="the-problem"
            className="bg-ink-800 px-6 py-28"
        >
            <div className="mx-auto max-w-3xl text-center">
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">The problem</p>
                <h2 className="font-display text-4xl font-semibold leading-tight text-cream md:text-5xl">
                    You post. You apply.
                    <br/>
                    <span className="italic text-cream/50">Silence.</span>
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-cream/60">
                    The best opportunities never reach you, because LinkedIn never surfaces you. Recruiters search, the
                    algorithm
                    ranks — and an inactive profile stays invisible, no matter how good you are.
                </p>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Wire into `page.tsx`**

In `landing/app/page.tsx`, add the import and place `<PainBeat />` directly after `<Hero />`:

```tsx
import PainBeat from '../components/PainBeat'
// ...
<
Hero / >
< PainBeat / >
```

- [ ] **Step 3: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
```

Visual: the pain section appears right after the hero, `bg-ink-800`, centered. Check 375px.

- [ ] **Step 4: Checkpoint** — ready for Henriko to commit (`feat(landing): add pain-beat section`).

---

## Task 3: How it works — the circle (network effect)

**Files:**

- Modify: `landing/components/HowItWorks.tsx` (full rewrite)
- Modify: `landing/app/page.tsx` (ensure order: after `PainBeat`)

**Interfaces:**

- Produces: `HowItWorks` (default export), server component, `id="how-it-works"`, `bg-ink`.

- [ ] **Step 1: Rewrite `HowItWorks.tsx`**

```tsx
const STEPS = [
    {
        n: '01',
        title: 'Join the circle',
        body: 'Sign in with LinkedIn. You land in a private feed of professionals who actually engage with each other’s posts — all under your own identity, nothing automated.'
    },
    {
        n: '02',
        title: 'Engage, and get engaged with',
        body: 'React and comment on posts in your field. Members do the same for yours. Every genuine interaction feeds all four SSI pillars — brand, network, insight, relationships.'
    },
    {
        n: '03',
        title: 'Recruiters start finding you',
        body: 'As your SSI climbs you surface in more searches and feeds. The more of us in the circle, the more reach each of us gets.'
    }
]

export default function HowItWorks() {
    return (
        <section
            id="how-it-works"
            className="bg-ink px-6 py-28"
        >
            <div className="mx-auto max-w-5xl">
                <div className="mb-16 text-center">
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">How it works</p>
                    <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">How the circle works</h2>
                </div>
                <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
                    {STEPS.map(step => (
                        <div
                            key={step.n}
                            className="group relative"
                        >
                            <div
                                className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-cream/15 transition-colors group-hover:border-gold/40">
                <span
                    className="font-display text-xl font-semibold text-cream/40 transition-colors group-hover:text-gold">
                  {step.n}
                </span>
                            </div>
                            <h3 className="mb-3 font-display text-2xl font-semibold text-cream">{step.title}</h3>
                            <p className="text-sm leading-relaxed text-cream/50">{step.body}</p>
                        </div>
                    ))}
                </div>
                {/* Moat line */}
                <p className="mt-14 text-center font-display text-xl italic text-gold/80">
                    The more of us, the more reach for each of us.
                </p>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Order in `page.tsx`**

Ensure `<HowItWorks />` comes immediately after `<PainBeat />` (before `<SSIExplainer />`).

- [ ] **Step 3: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
```

Visual: 3 reframed steps + the gold moat line; `bg-ink`.

- [ ] **Step 4: Checkpoint** — ready to commit (`feat(landing): reframe how-it-works around the circle/network effect`).

---

## Task 4: SSIExplainer — plain language, outcome-led, real stats kept

**Files:**

- Modify: `landing/components/SSIExplainer.tsx` (rewrite copy; keep structure; change bg to `ink-800`; remove the
  in-section "#how-it-works" CTA since it now precedes this section)
- Modify: `landing/app/page.tsx` (order: after `HowItWorks`)

**Interfaces:**

- Produces: `SSIExplainer` (default export), server component, `id="what-is-ssi"`, `bg-ink-800`.

- [ ] **Step 1: Rewrite `SSIExplainer.tsx`**

```tsx
const PILLARS = [
    {
        icon: '🏆',
        title: 'Establish your brand',
        body: 'A complete profile and consistent, credible content make you discoverable to the right people.',
        pts: 25
    },
    {
        icon: '🔍',
        title: 'Find the right people',
        body: 'Connect with decision-makers and peers in your field — not random reach.',
        pts: 25
    },
    {
        icon: '💡',
        title: 'Engage with insight',
        body: 'Comment on and react to what matters in your industry. Every interaction counts.',
        pts: 25
    },
    {
        icon: '🤝',
        title: 'Build relationships',
        body: 'Turn connections into genuine professional relationships through steady engagement.',
        pts: 25
    }
]

const IMPACT = [
    {value: '45%', label: 'more opportunities for SSI leaders vs. low-scorers', source: 'LinkedIn data'},
    {value: '5×', label: 'more profile views in the top SSI quartile', source: 'LinkedIn data'},
    {value: '+51%', label: 'more likely to be contacted by a recruiter with SSI above 70', source: 'LinkedIn data'}
]

export default function SSIExplainer() {
    return (
        <section
            id="what-is-ssi"
            className="bg-ink-800 px-6 py-28"
        >
            <div className="mx-auto max-w-5xl">
                <div className="mb-16 text-center">
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Why SSI</p>
                    <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
                        The score that decides
                        <br/>
                        <span className="italic text-gold">who finds you</span>
                    </h2>
                    <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream/60">
                        Your Social Selling Index is LinkedIn&apos;s own 0–100 measure of how findable you are to
                        recruiters and
                        peers. Four pillars, 25 points each. Engagement is the fastest one to move.
                    </p>
                </div>

                <div className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-2">
                    {PILLARS.map(pillar => (
                        <div
                            key={pillar.title}
                            className="group rounded-2xl border border-t-2 border-cream/[0.08] border-t-gold/40 bg-ink-600 p-7 transition-all duration-300 hover:border-cream/15"
                        >
                            <div className="mb-5 flex items-start justify-between">
                                <span className="text-2xl">{pillar.icon}</span>
                                <span
                                    className="rounded-full border border-cream/10 px-2.5 py-1 text-xs font-medium text-cream/30">
                  {pillar.pts} pts
                </span>
                            </div>
                            <h3 className="mb-2 font-display text-xl font-semibold text-cream">{pillar.title}</h3>
                            <p className="text-sm leading-relaxed text-cream/50">{pillar.body}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl bg-ink-600 px-8 py-12">
                    <div
                        className="grid grid-cols-1 gap-10 text-center md:grid-cols-3 md:gap-0 md:divide-x md:divide-gold/20">
                        {IMPACT.map(stat => (
                            <div
                                key={stat.value}
                                className="px-6"
                            >
                                <p className="font-display text-6xl font-semibold text-gold">{stat.value}</p>
                                <p className="mx-auto mt-3 max-w-[180px] text-sm leading-relaxed text-cream/60">{stat.label}</p>
                                <p className="mt-2 text-xs text-cream/25">{stat.source}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Order in `page.tsx`**

Ensure `<SSIExplainer />` comes after `<HowItWorks />`.

- [ ] **Step 3: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
```

Visual: plain-language SSI intro, 4 pillars, the 3 LinkedIn-attributed stats; `bg-ink-800`; the old "Most professionals
score below 50" CTA link is gone.

- [ ] **Step 4: Checkpoint** — ready to commit (`feat(landing): plain-language outcome-led SSI explainer`).

---

## Task 5: Honest proof block + remove fabricated proof

**Files:**

- Create: `landing/components/Proof.tsx`
- Delete: `landing/components/StatsBar.tsx`
- Delete: `landing/components/Testimonials.tsx`
- Modify: `landing/app/page.tsx` (remove StatsBar + Testimonials imports/usages; add `<Proof />` after `SSIExplainer`)

**Interfaces:**

- Produces: `Proof` (default export), server component, `id="proof"`, `bg-ink`.
- Founder content lives in a `FOUNDER` constant at the top of the file — **Henriko replaces the photo path, name, and
  message with the real ones.** A real photo file goes in `landing/public/` (e.g. `landing/public/founder.jpg`).

- [ ] **Step 1: Create `Proof.tsx`**

```tsx
// Honest, pre-launch proof. No fabricated counts/testimonials.
// FOUNDER: Henriko replaces these placeholder values with the real photo/name/message.
const FOUNDER = {
    name: 'Henriko',
    role: 'Founder · Frontend Specialist (7+ years)',
    photo: '/founder.jpg', // add landing/public/founder.jpg
    message:
        'I’m Henriko — a frontend specialist with 7+ years in the industry. I built Link Into The SSI because good people stay invisible on LinkedIn while the algorithm rewards activity. We launched recently, so you won’t find inflated numbers here — just the mechanism, real growth in your own SSI, and an honest invitation to be early.'
}

export default function Proof() {
    return (
        <section
            id="proof"
            className="bg-ink px-6 py-28"
        >
            <div className="mx-auto max-w-5xl">
                <div className="mb-16 text-center">
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">No hype</p>
                    <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
                        We&apos;re just getting started —
                        <br/>
                        <span className="italic text-gold">and we won&apos;t fake it</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {/* Founder note */}
                    <div className="flex flex-col rounded-2xl border border-cream/[0.08] bg-ink-800 p-8 md:col-span-2">
                        <div className="mb-5 flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={FOUNDER.photo}
                                alt={FOUNDER.name}
                                className="h-12 w-12 rounded-full object-cover"
                            />
                            <div>
                                <p className="text-sm font-medium text-cream">{FOUNDER.name}</p>
                                <p className="text-xs text-cream/40">{FOUNDER.role}</p>
                            </div>
                        </div>
                        <p className="text-base leading-relaxed text-cream/70">{FOUNDER.message}</p>
                    </div>

                    {/* Watch your own SSI — links out to LinkedIn's own SSI page in a NEW TAB (keeps our tab open;
              mid-page, so it never competes with the primary CTA). We do NOT claim to display the user's SSI —
              LinkedIn doesn't expose it via API — we point them to the source of truth. */}
                    <div className="flex flex-col justify-center rounded-2xl border border-gold/20 bg-gold/[0.04] p-8">
                        <p className="font-display text-2xl font-semibold text-cream">The only proof that matters is
                            your own.</p>
                        <p className="mt-3 text-sm leading-relaxed text-cream/60">
                            See real growth in your SSI number from day one — measured on LinkedIn itself, not by us.
                        </p>
                        <a
                            href="https://www.linkedin.com/sales/ssi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 text-sm text-gold underline underline-offset-4 hover:text-gold-light"
                        >
                            Check your current SSI on LinkedIn →
                        </a>
                    </div>
                </div>

                {/* Founding promo (honest scarcity; live counter wired in backend Plan 2) */}
                <div className="mt-10 flex items-center justify-center">
                    <p className="rounded-full border border-gold/30 bg-gold/5 px-5 py-2 text-sm text-gold">
                        🔥 First 10 founding members get their first month free
                    </p>
                </div>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Delete fabricated components**

```bash
rm landing/components/StatsBar.tsx landing/components/Testimonials.tsx
```

- [ ] **Step 3: Update `page.tsx`**

Remove `import StatsBar` and `import Testimonials` and their `<StatsBar />` / `<Testimonials />` usages. Add
`import Proof from '../components/Proof'` and place `<Proof />` after `<SSIExplainer />`.

- [ ] **Step 4: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
```

Expected: build passes; no remaining references to StatsBar/Testimonials (build would fail otherwise). Visual: founder
note + "watch your own SSI" + founding-promo pill. (If `founder.jpg` is absent, the image is broken until Henriko adds
it — acceptable; structure is correct.)

- [ ] **Step 5: Checkpoint** — ready to commit (
  `feat(landing): replace fabricated proof with honest founder/SSI proof`).

---

## Task 6: Features — 3 outcome-led cards

**Files:**

- Modify: `landing/components/Features.tsx` (full rewrite)
- Modify: `landing/app/page.tsx` (order: after `Proof`)

**Interfaces:**

- Produces: `Features` (default export), server component, `id="features"`, `bg-ink-800`.

- [ ] **Step 1: Rewrite `Features.tsx`**

```tsx
const FEATURES = [
    {
        icon: '⊙',
        title: 'Your industry, front and center',
        body: 'Growth and Pro members see posts from their own field first — engage where it actually moves your SSI.',
        tier: 'Growth+'
    },
    {
        icon: '✎',
        title: 'Comment with confidence',
        body: 'Get a suggested reaction and a draft comment in your own voice, so you engage in seconds instead of overthinking it.',
        tier: 'All tiers'
    },
    {
        icon: '◈',
        title: 'Control your reach',
        body: 'Choose exactly who sees your posts with industry and country targeting. Maximum visibility when it counts.',
        tier: 'Pro'
    }
]

export default function Features() {
    return (
        <section
            id="features"
            className="bg-ink-800 px-6 py-28"
        >
            <div className="mx-auto max-w-5xl">
                <div className="mb-16 text-center">
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Platform</p>
                    <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">Built for deliberate
                        growth</h2>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {FEATURES.map(f => (
                        <div
                            key={f.title}
                            className="group rounded-2xl border border-cream/[0.08] bg-ink-600 p-7 transition-all duration-300 hover:border-cream/15"
                        >
                            <div className="mb-5 flex items-start justify-between">
                <span
                    className="text-2xl text-gold opacity-70 transition-opacity group-hover:opacity-100">{f.icon}</span>
                                <span
                                    className="rounded-full border border-cream/10 px-2.5 py-1 text-xs font-medium text-cream/30">
                  {f.tier}
                </span>
                            </div>
                            <h3 className="mb-2 font-display text-xl font-semibold text-cream">{f.title}</h3>
                            <p className="text-sm leading-relaxed text-cream/50">{f.body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Order in `page.tsx`** — `<Features />` after `<Proof />`.

- [ ] **Step 3: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
```

Visual: exactly 3 cards; no "coming soon"; AI card sold by outcome (no "AI-powered"). 375px → single column.

- [ ] **Step 4: Checkpoint** — ready to commit (`feat(landing): 3 outcome-led feature cards`).

---

## Task 7: Pricing — 3 tiers, annual default, Recommended Growth

**Files:**

- Modify: `landing/components/Pricing.tsx` (full rewrite, becomes `'use client'`)
- Modify: `landing/app/page.tsx` (order: after `Features`)

**Interfaces:**

- Produces: `Pricing` (default export), **client** component (`useState` for the annual toggle), `id="pricing"`,
  `bg-ink`.
- Consumes: `SIGN_IN_URL` from `../lib/links`.

- [ ] **Step 1: Rewrite `Pricing.tsx`**

```tsx
'use client'
import {useState} from 'react'
import {SIGN_IN_URL} from '../lib/links'

type Plan = {
    id: string
    name: string
    monthly: number
    description: string
    features: string[]
    cta: string
    highlight: boolean
}

const PLANS: Plan[] = [
    {
        id: 'starter',
        name: 'Starter',
        monthly: 5,
        description: 'Get in the circle and start engaging',
        features: ['See the full live feed', 'Comment & react manually', 'Mutual connections sorted first', '25 interactions counted per post', '1 post into the feed / week'],
        cta: 'Start free',
        highlight: false
    },
    {
        id: 'growth',
        name: 'Growth',
        monthly: 15,
        description: 'A targeted feed for faster results',
        features: ['Feed filtered to your industry + country', 'Auto-tuned from your LinkedIn profile', 'Everything in Starter', '50 interactions counted per post', '2 posts into the feed / week'],
        cta: 'Start free',
        highlight: true
    },
    {
        id: 'pro',
        name: 'Pro',
        monthly: 50,
        description: 'Maximum reach and control',
        features: ['Custom industry + country filters', 'Control who sees your posts', 'Everything in Growth', '200 interactions counted per post', '5 posts into the feed / week'],
        cta: 'Start free',
        highlight: false
    }
]

function priceLabel(plan: Plan, annual: boolean) {
    if (annual) {
        const perMonth = (plan.monthly * 10) / 12
        return {big: `$${plan.monthly * 10}`, period: '/yr', sub: `$${perMonth.toFixed(2)}/mo billed annually`}
    }
    return {big: `$${plan.monthly}`, period: '/mo', sub: '2 months free if you pay annually'}
}

export default function Pricing() {
    const [annual, setAnnual] = useState(true) // default annual

    return (
        <section
            id="pricing"
            className="bg-ink px-6 py-28"
        >
            <div className="mx-auto max-w-6xl">
                <div className="mb-12 text-center">
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Pricing</p>
                    <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">Invest in your
                        professional
                        brand</h2>
                    <p className="mx-auto mt-4 max-w-lg text-base text-cream/50">
                        Every tier unlocks the feed and the circle. Higher tiers unlock precision.
                    </p>

                    {/* Annual / monthly toggle (annual default) */}
                    <div
                        className="mt-8 inline-flex items-center gap-3 rounded-full border border-cream/10 bg-ink-800 p-1 text-sm">
                        <button
                            onClick={() => setAnnual(true)}
                            className={`rounded-full px-4 py-1.5 transition-colors ${annual ? 'bg-gold text-ink' : 'text-cream/60 hover:text-cream'}`}
                        >
                            Annual <span className="text-xs opacity-80">· 2 months free</span>
                        </button>
                        <button
                            onClick={() => setAnnual(false)}
                            className={`rounded-full px-4 py-1.5 transition-colors ${!annual ? 'bg-gold text-ink' : 'text-cream/60 hover:text-cream'}`}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
                    {PLANS.map(plan => {
                        const p = priceLabel(plan, annual)
                        return (
                            <div
                                key={plan.id}
                                className={`relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
                                    plan.highlight
                                        ? 'border border-lnblue bg-lnblue/[0.08] shadow-[0_0_48px_rgba(0,119,181,0.2)] md:-translate-y-3'
                                        : 'border border-cream/[0.08] bg-ink-600 hover:border-cream/15'
                                }`}
                            >
                                {plan.highlight && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-lnblue px-3 py-1 text-xs font-semibold tracking-wide text-cream">
                      Recommended
                    </span>
                                    </div>
                                )}
                                <div className="mb-6">
                                    <h3 className="font-display text-xl font-semibold text-cream">{plan.name}</h3>
                                    <p className="mt-1 text-sm text-cream/40">{plan.description}</p>
                                </div>
                                <div className="mb-6">
                                    <span className="font-display text-4xl font-semibold text-cream">{p.big}</span>
                                    <span className="ml-1 text-sm text-cream/40">{p.period}</span>
                                    <p className="mt-2 text-xs text-gold">{p.sub}</p>
                                </div>
                                <ul className="mb-8 flex-1 space-y-2.5">
                                    {plan.features.map(f => (
                                        <li
                                            key={f}
                                            className="flex items-start gap-2.5 text-sm text-cream/60"
                                        >
                                            <span className="mt-0.5 flex-shrink-0 text-gold">✓</span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={SIGN_IN_URL}
                                    className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all duration-300 ${
                                        plan.highlight
                                            ? 'bg-lnblue text-cream shadow-[0_0_20px_rgba(0,119,181,0.4)] hover:bg-lnblue-light'
                                            : 'border border-cream/15 text-cream hover:border-cream/30 hover:bg-cream/5'
                                    }`}
                                >
                                    {plan.cta}
                                </a>
                            </div>
                        )
                    })}
                </div>

                {/* Trial framing + Enterprise line */}
                <div className="mt-8 space-y-3 text-center">
                    <p className="text-sm text-cream/50">
                        Start free — no charge until 50 interactions or 7 days, whichever comes first. Card required,
                        cancel
                        anytime.
                    </p>
                    <p className="text-sm text-cream/40">
                        Teams &amp; agencies — Enterprise from <span className="text-cream/70">$100/mo</span>.{' '}
                        <a
                            href="mailto:contact@linkintothessi.com"
                            className="text-gold underline underline-offset-4 hover:text-gold-light"
                        >
                            Talk to us
                        </a>
                    </p>
                </div>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Order in `page.tsx`** — `<Pricing />` after `<Features />`.

- [ ] **Step 3: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
pnpm dev:landing
```

Visual: 3 tiers, Growth centered/elevated with "Recommended"; toggle defaults to **Annual** and shows "$150/yr · $
12.50/mo billed annually" for Growth; switching to Monthly shows "$15/mo"; Enterprise is a single line; the new trial
sentence appears; no "3-day"/"no credit card"/"Most popular" text. Check 375px (cards stack; toggle usable).

- [ ] **Step 4: Checkpoint** — ready to commit (
  `feat(landing): 3-tier pricing with annual-default toggle and Recommended Growth`).

---

## Task 8: FAQ — objection-led, honest trial scope

**Files:**

- Modify: `landing/components/FAQ.tsx` (rewrite the `FAQS` array + keep accordion logic)

**Interfaces:**

- Produces: `FAQ` (default export), client component (unchanged accordion), `id="faq"`, `bg-ink-800`.

- [ ] **Step 1: Update `FAQ.tsx`**

Change the section background to `bg-ink-800` and replace the `FAQS` array with the following (keep the rest of the
component — the `useState` accordion, markup, and aria wiring — exactly as-is):

```tsx
const FAQS = [
    {
        q: 'Is this safe? Will LinkedIn penalize me?',
        a: 'Yes. You sign in through LinkedIn’s official OAuth, you choose what to engage with, and you write your own comments. Nothing acts on your behalf, so you stay within LinkedIn’s Terms of Service.'
    },
    {
        q: 'How is this different from automation or spam?',
        a: 'You stay in control at all times. We surface relevant posts and make engaging fast — but every action needs your intent. No bots, no bulk actions, no auto-posting.'
    },
    {
        q: 'What does the free trial include, and when am I charged?',
        a: 'You get the full Growth-level experience. A card is required to start, but you are not charged until you’ve had 50 interactions (made or received) or 7 days pass — whichever comes first. Cancel anytime before then and you pay nothing. The first 10 founding members get their first month free.'
    },
    {
        q: 'What is SSI, and how fast will it move?',
        a: 'Your Social Selling Index is LinkedIn’s 0–100 measure of how findable you are. We show your real score on day one. Most members see movement within 1–2 weeks of consistent engagement — results vary with how active you are and where you start.'
    },
    {
        q: 'Do I need to be active every day?',
        a: 'No. A few minutes a few times a week beats occasional marathons — small, regular interactions are what move your SSI.'
    },
    {
        q: 'Can I cancel anytime?',
        a: 'Yes. No contracts, no lock-in, no cancellation fees. Cancel from your account settings in one click; access lasts until the end of the current period.'
    }
]
```

- [ ] **Step 2: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
```

Visual: safety question is first; the trial answer states card-required + 50-interactions-or-7-days + first-10 promo; no
"+8 points" or "no credit card" claims; accordion still opens/closes one at a time; `bg-ink-800`.

- [ ] **Step 3: Checkpoint** — ready to commit (`feat(landing): objection-led FAQ with honest trial scope`).

---

## Task 9: FinalCTA + Nav

**Files:**

- Modify: `landing/components/FinalCTA.tsx` (copy + scarcity)
- Modify: `landing/components/Nav.tsx` (CTA copy)

**Interfaces:**

- Produces: `FinalCTA` (default export), server component, `bg-ink`. `Nav` unchanged shape.

- [ ] **Step 1: Rewrite `FinalCTA.tsx`**

```tsx
import {SIGN_IN_URL} from '../lib/links'

export default function FinalCTA() {
    return (
        <section className="relative overflow-hidden bg-ink px-6 py-32 text-center">
            <div
                className="pointer-events-none absolute inset-0"
                style={{background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,150,62,0.07) 0%, transparent 70%)'}}
            />
            <div
                className="circle-ring"
                style={{
                    width: 500,
                    height: 500,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    borderColor: 'rgba(201,150,62,0.08)'
                }}
            />
            <div className="relative z-10 mx-auto max-w-xl space-y-6">
                <h2 className="font-display text-5xl font-semibold text-cream md:text-6xl">
                    Ready to stop chasing?
                    <br/>
                    <span className="italic text-gold">Let them find you.</span>
                </h2>
                <p className="text-base text-cream/50">Start free with LinkedIn. See your real SSI on day one.</p>
                <div className="flex flex-col items-center gap-3">
                    <a
                        href={SIGN_IN_URL}
                        className="inline-block rounded-full bg-gold px-10 py-4 font-semibold text-ink shadow-[0_0_40px_rgba(201,150,62,0.4)] transition-all duration-300 hover:bg-gold-light hover:shadow-[0_0_60px_rgba(201,150,62,0.55)]"
                    >
                        Start free with LinkedIn →
                    </a>
                    <p className="text-sm text-gold">🔥 First 10 founding members get their first month free</p>
                </div>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Update `Nav.tsx` CTA**

In `landing/components/Nav.tsx`, change the bottom CTA button text from `Join free` to `Start free` (the
`<a href={SIGN_IN_URL} …>Join free</a>` near the end of the nav). Leave everything else unchanged.

- [ ] **Step 3: Verify**

```bash
pnpm format && pnpm --filter landing exec tsc --noEmit && pnpm build:landing
```

Visual: FinalCTA headline "Ready to stop chasing? / Let them find you.", single gold CTA, gold founding-promo line; Nav
button reads "Start free".

- [ ] **Step 4: Checkpoint** — ready to commit (`feat(landing): final CTA + nav copy with honest scarcity`).

---

## Task 10: Page order, cleanup, docs, full verify

**Files:**

- Modify: `landing/app/page.tsx` (final canonical order)
- Modify: `landing/app/globals.css` (remove unused `.slot-container`, `.slot-words`, `@keyframes slotRoll` and the
  `--slot-h` var)
- Modify: `landing/tailwind.config.ts` (remove unused `slotRoll` keyframe + animation)
- Modify: `docs/PLATFORM.md` (§15 landing section)

- [ ] **Step 1: Set the final `page.tsx`**

Replace the entire contents of `landing/app/page.tsx` with:

```tsx
import Nav from '../components/Nav'
import Hero from '../components/Hero'
import PainBeat from '../components/PainBeat'
import HowItWorks from '../components/HowItWorks'
import SSIExplainer from '../components/SSIExplainer'
import Proof from '../components/Proof'
import Features from '../components/Features'
import Pricing from '../components/Pricing'
import FAQ from '../components/FAQ'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

export default function HomePage() {
    return (
        <div className="min-h-screen bg-ink">
            <Nav/>
            <Hero/>
            <PainBeat/>
            <HowItWorks/>
            <SSIExplainer/>
            <Proof/>
            <Features/>
            <Pricing/>
            <FAQ/>
            <FinalCTA/>
            <Footer/>
        </div>
    )
}
```

- [ ] **Step 2: Remove the dead slot-machine CSS**

In `landing/app/globals.css`, delete the `:root { --slot-h … }` rule, `.slot-container`, `.slot-words`,
`.slot-words span`, and the `@keyframes slotRoll` block (the hero no longer uses them). Keep `.circle-ring`, the font
import, base styles, and the `gaugeFill` keyframe from Task 1.

- [ ] **Step 3: Remove the dead `slotRoll` from `tailwind.config.ts`**

Delete the `slotRoll` entries from both `keyframes` and `animation` (keep `gaugeFill`, `fadeUp`, `shimmer`).

- [ ] **Step 4: Update `docs/PLATFORM.md` §15 (Landing site)**

Update the §15 "Routes"/"Styling" notes to reflect the new section order (Hero → PainBeat → HowItWorks → SSIExplainer →
Proof → Features → Pricing → FAQ → FinalCTA), the removal of StatsBar/Testimonials, the honest-proof approach, the
3-tier annual-default pricing presentation, and the new trial copy. (Billing/trial *mechanics* are documented when Plan
2 lands — note here that the landing copy describes a card-required, 50-interactions-or-7-days trial implemented in Plan
2.)

- [ ] **Step 5: Full verify**

```bash
pnpm format
pnpm --filter landing exec tsc --noEmit
pnpm build:landing
pnpm lint
pnpm dev:landing
```

Expected: all pass, 0 errors/warnings. Manual pass at `localhost:3000`:

- Scroll order matches Step 1 exactly.
- No fabricated numbers/testimonials anywhere; no "3-day"/"no credit card"/"Most popular"/"coming soon".
- Pricing toggle defaults to Annual; Growth is "Recommended"/elevated.
- FAQ accordion works; safety question first.
- **Mobile 375px:** every section single-column and legible; pricing toggle + cards usable; gauge scales.
- **Perf:** run Lighthouse (mobile) — target Performance ≥ 90, no major CLS from the gauge/fonts. If the Cormorant font
  causes layout shift, confirm `display=swap` is in the font import (it is) and the gauge has fixed dimensions (it
  does).

- [ ] **Step 6: Checkpoint** — ready for Henriko to commit (
  `refactor(landing): finalize section order, remove dead slot-machine CSS, update PLATFORM.md`).

---

## Self-Review (completed by plan author)

**1. Spec coverage** (§4 + §5 of the design):

- Outcome-led hero + headline + gauge + trust line → Task 1 ✓
- Pain beat → Task 2 ✓
- Network-effect "how it works" + moat → Task 3 ✓
- Plain-language SSI, real LinkedIn stats kept → Task 4 ✓
- Honest proof, fabricated proof removed → Task 5 ✓
- Features 3, outcome-framed AI, no "coming soon" → Task 6 ✓
- 3 tiers + Enterprise line + annual default + Recommended → Task 7 ✓
- Objection-led FAQ + honest trial copy → Task 8 ✓
- FinalCTA + scarcity + Nav → Task 9 ✓
- Section reorder, dead-CSS cleanup, PLATFORM.md §15 → Task 10 ✓
- Global guardrails (CTA contrast, sub-3s, keep aesthetic, no fabrication) → Global Constraints + Task 10 perf/visual
  gate ✓
- **Out of scope (correctly deferred to Plan 2):** live promo counter, annual Stripe price IDs/checkout, the trial
  *mechanics* (card capture, milestone gating, feed reciprocity), the in-app progress proxy + SSI baseline, the
  embedded-LinkedIn-post testimonial component (data-gated). Noted in Task 5 and Task 10.

**2. Placeholder scan:** No "TBD/TODO". The one content placeholder — the `FOUNDER` constant + `/founder.jpg` — is *
*user-supplied content**, explicitly flagged for Henriko, not a logic gap. Enterprise shows "Talk to us" rather than a
fabricated "from $X" (anchor number is a Plan 2 decision).

**3. Type consistency:** `SSIGauge` (no props), `Proof`/`PainBeat` (no props) match their `page.tsx` usages.
`priceLabel(plan, annual)` returns `{ big, period, sub }` consumed in the same file. `Plan` type matches the `PLANS`
array and `SIGN_IN_URL` import is unchanged.

---

## Next: Plan 2 (backend) — to be written separately

Plan 2 will cover `convex/` + `app/`: annual Stripe price IDs + checkout/toggle wiring; the trial lifecycle
(card-required signup, `isAuthorFeedEligible` change so trialing authors are feed-eligible, effective-tier = Growth
during trial, the 50-interactions-or-7-days gate, first-10 coupon); the in-app progress proxy (`X/50`) + day-1 SSI
baseline; and the live founding-spots counter the landing promo reads. It also carries the open items from spec §9
(annual price points, effective-tier representation, promo mechanics) and keeps Apify dormant.
