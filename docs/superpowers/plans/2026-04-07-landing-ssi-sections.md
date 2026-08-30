# Landing Page — SSI Sections & CTA Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new landing page sections (SSIExplainer, StatsBar, Testimonials, FAQ) and improve CTA copy in three
existing components to build a complete newcomer-to-conversion funnel.

**Architecture:** Four new pure server components (no client JS cost) plus one client component (FAQ accordion) are
inserted into the existing Next.js App Router page. All components follow the established ink/cream/gold Tailwind token
system and bg-ink / bg-ink-800 alternation pattern. No new dependencies.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3.4 with custom tokens in `landing/tailwind.config.ts`

---

## File Map

| Action | Path                                  | Responsibility                                                     |
|--------|---------------------------------------|--------------------------------------------------------------------|
| Create | `landing/components/SSIExplainer.tsx` | SSI education: definition, 4 pillars, impact stats, in-section CTA |
| Create | `landing/components/StatsBar.tsx`     | Compact platform stats belt with shimmer animation on numbers      |
| Create | `landing/components/Testimonials.tsx` | 3 social proof quote cards                                         |
| Create | `landing/components/FAQ.tsx`          | 6-item accordion (client component, single-open)                   |
| Modify | `landing/app/page.tsx`                | Wire new sections into page in correct order                       |
| Modify | `landing/components/Nav.tsx`          | CTA copy: "Join the circle" → "Join free"                          |
| Modify | `landing/components/Hero.tsx`         | Add social proof line below primary CTA button                     |
| Modify | `landing/components/FinalCTA.tsx`     | Update headline and subheading copy                                |

---

## Task 1: Create `SSIExplainer.tsx`

**File:** Create `landing/components/SSIExplainer.tsx`

This is the most important new section. It sits between Hero and StatsBar and teaches newcomers what SSI is, shows the 4
LinkedIn pillars, then hits them with 3 real-data impact stats. Background is `bg-ink` (matching Features section,
alternating with HowItWorks which is `bg-ink-800`).

- [ ] **Step 1: Create the file**

```tsx
const PILLARS = [
  {
    icon: '🏆',
    title: 'Establish Your Brand',
    body: 'A complete profile and consistent thought leadership content make you discoverable to the right people.',
    pts: 25
  },
  {
    icon: '🔍',
    title: 'Find the Right People',
    body: "Connecting with decision-makers and peers in your field using LinkedIn's search and recommendations.",
    pts: 25
  },
  {
    icon: '💡',
    title: 'Engage with Insights',
    body: 'Sharing, commenting on, and reacting to content that matters in your industry. Every interaction counts.',
    pts: 25
  },
  {
    icon: '🤝',
    title: 'Build Relationships',
    body: 'Turning connections into genuine professional relationships through consistent, meaningful engagement.',
    pts: 25
  }
]

const IMPACT = [
  {
    value: '45%',
    label: 'more opportunities unlocked by SSI leaders vs. low-scorers',
    source: 'LinkedIn data'
  },
  {
    value: '5×',
    label: 'more profile views for professionals in the top SSI quartile',
    source: 'LinkedIn data'
  },
  {
    value: '+51%',
    label: 'more likely to be contacted by a recruiter with SSI above 70',
    source: 'LinkedIn data'
  }
]

export default function SSIExplainer() {
  return (
    <section
      id="what-is-ssi"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Understanding SSI</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            Your LinkedIn SSI —
            <br />
            <span className="italic text-gold">the score that determines who finds you</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream/60">
            LinkedIn gives every profile a Social Selling Index score from 0–100. It measures how actively you build
            your brand, find the right people, engage with insights, and develop relationships.
          </p>
        </div>

        {/* 4 Pillar cards */}
        <div className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PILLARS.map(pillar => (
            <div
              key={pillar.title}
              className="group rounded-2xl border border-t-2 border-cream/[0.08] border-t-gold/40 bg-ink-800 p-7 transition-all duration-300 hover:border-cream/15 hover:bg-ink-600"
            >
              <div className="mb-5 flex items-start justify-between">
                <span className="text-2xl">{pillar.icon}</span>
                <span className="rounded-full border border-cream/10 px-2.5 py-1 text-xs font-medium text-cream/30">
                  {pillar.pts} pts
                </span>
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-cream">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-cream/50">{pillar.body}</p>
            </div>
          ))}
        </div>

        {/* Impact stats row */}
        <div className="rounded-2xl bg-ink-800 px-8 py-12">
          <div className="grid grid-cols-1 gap-10 text-center md:grid-cols-3 md:gap-0 md:divide-x md:divide-gold/20">
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

        {/* In-section CTA hook */}
        <div className="mt-12 text-center">
          <a
            href="#how-it-works"
            className="group text-sm text-cream/50 transition-colors hover:text-cream"
          >
            Most professionals score below 50. See how to change that.
            <span className="ml-1.5 inline-block text-gold transition-transform group-hover:translate-x-1">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls landing/components/SSIExplainer.tsx
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add landing/components/SSIExplainer.tsx
git commit -m "feat(landing): add SSIExplainer section with 4 pillars and impact stats"
```

---

## Task 2: Create `StatsBar.tsx`

**File:** Create `landing/components/StatsBar.tsx`

Compact belt section between SSIExplainer and HowItWorks. Uses the `animate-shimmer` animation (already defined in
`tailwind.config.ts` but unused) on the stat numbers via a gold-cream gradient + `background-clip: text`.

- [ ] **Step 1: Create the file**

```tsx
const STATS = [
  { value: '10,000+', label: 'Engagements facilitated' },
  { value: '+8 pts', label: 'Avg. SSI gain in 30 days' },
  { value: '3 min/day', label: 'Average session time' },
  { value: '3 languages', label: 'English · Portuguese · Spanish' }
]

export default function StatsBar() {
  return (
    <section
      id="our-numbers"
      className="bg-ink-800 px-6 py-16"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-0 md:divide-x md:divide-gold/20">
          {STATS.map(stat => (
            <div
              key={stat.value}
              className="text-center"
            >
              <p
                className="animate-shimmer font-display text-4xl font-semibold"
                style={{
                  background: 'linear-gradient(90deg, #F5F0E8 0%, #C9963E 50%, #F5F0E8 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                {stat.value}
              </p>
              <p className="mt-2 text-xs uppercase tracking-widest text-cream/40">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/StatsBar.tsx
git commit -m "feat(landing): add StatsBar section with shimmer animation on platform stats"
```

---

## Task 3: Create `Testimonials.tsx`

**File:** Create `landing/components/Testimonials.tsx`

3 social proof quote cards. Background `bg-ink-800` to alternate with Features (`bg-ink`). Avatar initials are derived
from the name at render time — no hardcoded strings to maintain.

- [ ] **Step 1: Create the file**

```tsx
const TESTIMONIALS = [
  {
    quote:
      'Since my SSI crossed 70, I have 2 recruiters reaching out to me every single day. I stopped applying for jobs — they come to me now.',
    name: 'Ana R.',
    role: 'Senior Product Manager',
    location: 'Lisbon'
  },
  {
    quote:
      "I'm a back-end developer — I never thought LinkedIn could change my career. Now multiple recruiters connect with me every week offering new opportunities. I finally feel like I'm being noticed.",
    name: 'Mateus Y.',
    role: 'Senior Back-End Developer',
    location: 'São Paulo'
  },
  {
    quote: "Finally a tool that doesn't feel like gaming the system — it's smart, deliberate networking.",
    name: 'Sophie L.',
    role: 'Marketing Lead',
    location: 'London'
  }
]

export default function Testimonials() {
  return (
    <section className="bg-ink-800 px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">From the circle</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            What growth looks like in practice
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map(t => {
            const initials = t.name
              .split(' ')
              .map(n => n[0])
              .join('')
            return (
              <div
                key={t.name}
                className="group flex flex-col rounded-2xl border border-cream/[0.08] bg-ink-600 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-cream/15 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
              >
                {/* Quotation mark accent */}
                <span className="font-display text-6xl leading-none text-gold/50 transition-colors group-hover:text-gold/80">
                  &ldquo;
                </span>

                {/* Quote text */}
                <p className="mt-1 flex-1 text-sm leading-relaxed text-cream/70">{t.quote}</p>

                {/* Author */}
                <div className="mt-7 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink-400 text-xs font-semibold text-cream/70">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{t.name}</p>
                    <p className="text-xs text-cream/40">
                      {t.role} · {t.location}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/Testimonials.tsx
git commit -m "feat(landing): add Testimonials section with 3 social proof cards"
```

---

## Task 4: Create `FAQ.tsx`

**File:** Create `landing/components/FAQ.tsx`

Single-open accordion. **Requires `'use client'`** because it uses `useState`. One `openIndex: number | null` state
integer controls which item is expanded — opening a new item closes the previous one. Background `bg-ink` to alternate
with Pricing (`bg-ink-800`).

- [ ] **Step 1: Create the file**

```tsx
'use client'
import { useState } from 'react'

const FAQS = [
  {
    q: 'What is LinkedIn SSI and how is it calculated?',
    a: "Your Social Selling Index (SSI) is a score from 0–100 that LinkedIn updates daily. It's calculated across four equal pillars: establishing your professional brand, finding the right people, engaging with insights, and building relationships. Each pillar contributes 25 points to your total."
  },
  {
    q: 'Is Link Into The SSI safe? Will LinkedIn penalize me?',
    a: "Yes — completely. We connect via LinkedIn's official OAuth, and every interaction is genuine: you choose what to engage with, and you write your own comments. There is no automation acting on your behalf, so you stay fully within LinkedIn's Terms of Service."
  },
  {
    q: 'How is this different from automation or spamming?',
    a: 'You stay in control at all times. The platform surfaces relevant content and makes engagement fast and easy — but every action requires your intent. No bots, no auto-generated text, no bulk actions. Think of it as a well-organised feed of opportunities to engage authentically.'
  },
  {
    q: 'How quickly will I see my SSI improve?',
    a: 'Most members see their first SSI movement within 1–2 weeks of consistent engagement. Our members average +8 SSI points in their first 30 days. Results vary based on how active you are and your starting score.'
  },
  {
    q: 'Do I need to be active every day?',
    a: 'No. Our most consistent members spend around 3 minutes a few times a week. Small, regular interactions are more valuable to your SSI than occasional bursts — so a light habit beats marathon sessions.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no lock-in, no cancellation fees. Cancel from your account settings in one click. Your subscription stays active until the end of the current billing period.'
  }
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section
      id="faq"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Questions</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">Everything you need to know</h2>
        </div>

        <div className="divide-y divide-ink-600">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                className="flex w-full items-center justify-between gap-6 py-6 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <span className="text-base font-medium text-cream">{faq.q}</span>
                <span
                  className="flex-shrink-0 font-display text-2xl text-gold transition-transform duration-300"
                  style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)' }}
                >
                  +
                </span>
              </button>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: openIndex === i ? '400px' : '0px' }}
              >
                <p className="pb-6 text-sm leading-relaxed text-cream/50">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/FAQ.tsx
git commit -m "feat(landing): add FAQ accordion section with 6 items"
```

---

## Task 5: Wire new sections into `page.tsx`

**File:** Modify `landing/app/page.tsx`

Replace the current import/render list with the new full order.

- [ ] **Step 1: Update `page.tsx`**

Replace the entire file content with:

```tsx
import Nav from '../components/Nav'
import Hero from '../components/Hero'
import SSIExplainer from '../components/SSIExplainer'
import StatsBar from '../components/StatsBar'
import HowItWorks from '../components/HowItWorks'
import Features from '../components/Features'
import Testimonials from '../components/Testimonials'
import Pricing from '../components/Pricing'
import FAQ from '../components/FAQ'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink">
      <Nav />
      <Hero />
      <SSIExplainer />
      <StatsBar />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/app/page.tsx
git commit -m "feat(landing): wire SSIExplainer, StatsBar, Testimonials, FAQ into page"
```

---

## Task 6: Update Nav CTA copy

**File:** Modify `landing/components/Nav.tsx` — line 53–58

Change the CTA button text from `"Join the circle"` to `"Join free"`.

- [ ] **Step 1: Edit `Nav.tsx`**

Find this line (currently line 57):

```tsx
Join
the
circle
```

Replace with:

```tsx
Join
free
```

The full button element after the change:

```tsx
<a
  href={`${APP_URL}`}
  className="rounded-full border border-gold/60 px-5 py-2 text-sm font-medium text-gold transition-all duration-300 hover:bg-gold hover:text-ink"
>
  Join free
</a>
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/Nav.tsx
git commit -m "feat(landing): update nav CTA to 'Join free'"
```

---

## Task 7: Add social proof line to Hero

**File:** Modify `landing/components/Hero.tsx`

Add one line of social proof text directly after the `<p className="text-xs tracking-wide text-cream/30">` trial line
(currently line 102). Insert it between the CTAs block and the existing trial copy line, or directly below it.

- [ ] **Step 1: Edit `Hero.tsx`**

Find the existing trial copy line (around line 102):

```tsx
<p className="text-xs tracking-wide text-cream/30">3-day free trial · No credit card required</p>
```

Replace with:

```tsx
        <p className="text-xs tracking-wide text-cream/30">3-day free trial · No credit card required</p>
<p className="text-sm text-cream-muted">Join 500+ professionals already growing their SSI</p>
```

Note: `text-cream-muted` maps to `#A89F8C` — this is a defined token in `tailwind.config.ts`, not an opacity variant.
Use it (not `text-cream/50`) to match the spec's intent of a distinct muted tone.

- [ ] **Step 2: Commit**

```bash
git add landing/components/Hero.tsx
git commit -m "feat(landing): add social proof line below hero CTA"
```

---

## Task 8: Update FinalCTA copy

**File:** Modify `landing/components/FinalCTA.tsx`

Two copy changes: headline and subheading.

- [ ] **Step 1: Edit `FinalCTA.tsx`**

**Headline** — find (lines 22–25):

```tsx
<h2 className="font-display text-5xl font-semibold text-cream md:text-6xl">
  Ready to join
  <br />
  <span className="italic text-gold">the circle?</span>
</h2>
```

Replace with:

```tsx
<h2 className="font-display text-5xl font-semibold text-cream md:text-6xl">
  Ready to start
  <br />
  <span className="italic text-gold">climbing?</span>
</h2>
```

**Subheading** — find (line 26):

```tsx
<p className="text-base text-cream/50">Start your 3-day free trial. No credit card required.</p>
```

Replace with:

```tsx
<p className="text-base text-cream/50">Start your 3-day free trial. See your first SSI gains within a week.</p>
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/FinalCTA.tsx
git commit -m "feat(landing): update FinalCTA headline and subheading copy"
```

---

## Task 9: Verification

- [ ] **Step 1: Start dev server**

```bash
cd landing && npm run dev
```

Open `http://localhost:3000`

- [ ] **Step 2: Scroll-check page order**

Confirm this exact section order when scrolling top to bottom:

1. Nav (sticky header, "Join free" button)
2. Hero (slot machine, "+social proof" line at bottom)
3. SSIExplainer (4 pillar cards + 3 impact stats + CTA hook)
4. StatsBar (4 numbers with shimmer, compact belt)
5. HowItWorks (3 steps — unchanged)
6. Features (4 feature cards — unchanged)
7. Testimonials (3 quote cards: Ana R., Mateus Y., Sophie L.)
8. Pricing (4 tiers — unchanged)
9. FAQ (6 accordion items)
10. FinalCTA ("Ready to start climbing?")
11. Footer

- [ ] **Step 3: Test FAQ accordion**

Click each FAQ item. Verify:

- Clicking an item opens it (smooth height transition)
- Clicking the same item again closes it
- Opening item 3 while item 1 is open → item 1 closes, item 3 opens
- The `+` rotates to `×` (45°) when open

- [ ] **Step 4: Mobile check (375px)**

Resize browser to 375px width. Verify:

- SSIExplainer pillar cards stack to 1 column
- StatsBar stats stack to 2×2 grid
- Testimonial cards stack to 1 column
- FAQ accordion still works and text doesn't overflow

- [ ] **Step 5: Check all CTAs link correctly**

Verify that clicking "Join free" (Nav), "Join the circle — it's free" (Hero), and "Sign in with LinkedIn — it's free"
(FinalCTA) all navigate to `NEXT_PUBLIC_APP_URL`.

- [ ] **Step 6: Production build check**

```bash
npm run build
```

Expected: Build succeeds with 0 TypeScript errors and 0 Next.js warnings.
