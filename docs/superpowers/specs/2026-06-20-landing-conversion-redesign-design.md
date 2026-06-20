# Landing Page Conversion Redesign + Trial/Pricing Rework — Design

**Status:** Approved for planning (brainstorm complete) · **Date:** 2026-06-20
**Evidence base:** [richardrx landing insights](../research/2026-06-20-richardrx-landing-insights.md) (466 curated
tweets, mined via 5 agents)
**Author note:** Per project rules, **no commits** are made by the agent — Henriko commits. `docs/PLATFORM.md` is
updated *during implementation*, not in this design step.

---

## 1. Goal & success criteria

Redesign the `/landing` page to convert better, grounded in @richardrx's conversion/persuasion/pricing principles, and
make the connected pricing/trial business-rule changes the principles imply.

**Success criteria (qualitative — pre-launch, so no A/B baseline yet):**

- A cold visitor understands the **outcome** ("recruiters come to you") and the **action** (start free with LinkedIn)
  within ~5 seconds.
- The page contains **zero fabricated proof**; every claim is either externally citable (LinkedIn data) or honestly
  framed (founding promo, the user's own SSI).
- Pricing presents **3 self-serve tiers**, one clearly recommended, with annual billing defaulted.
- The trial **shows the core value** (the live, reciprocal feed at Growth level) instead of withholding it.
- Page meets **sub-3s, mobile-first** performance; the primary CTA is the highest-contrast element on every screen.

**Explicit non-goals (YAGNI):**

- No new visual language / rebrand (keep dark-navy/gold/serif).
- No new product features (no AI expansion, no Apify re-enablement — Apify stays dormant per the compliance gate).
- No fabricated testimonials "for now"; the testimonial component ships only when real, verifiable proof exists.
- No price-number A/B testing pre-launch (no traffic); Starter stays $5.

---

## 2. Decisions log (this brainstorm)

| #   | Decision                       | Choice                                                                                    |
|-----|--------------------------------|-------------------------------------------------------------------------------------------|
| D1  | Fabricated social proof        | **Remove all**; replace with honest pre-launch framing                                    |
| D2  | Redesign scope                 | **Conversion overhaul, keep the aesthetic**                                               |
| D3  | Pricing/business-rule appetite | **Open to all** (landing + Convex/Stripe backend)                                         |
| D4  | Tweet comments                 | **Skip** (X blocks fetching; 466-tweet base suffices)                                     |
| D5  | Hero positioning               | **A — Outcome-led** (pain + network woven in below)                                       |
| D6  | Hero headline                  | **"Stop chasing jobs. Let them find you."**                                               |
| D7  | Trial access level             | **Growth-level** experience                                                               |
| D8  | Card on file                   | **Required**; launch promo = **first 10 signups get a free month (coupon)**               |
| D9  | Trial gating                   | **Value-milestone, 50 interactions** (not calendar) + progress proxy + day-1 SSI baseline |
| D10 | Milestone definition           | **Made + received, combined** (both count toward 50)                                      |
| D11 | Starter price                  | **Keep $5 as a decoy**; revisit post-launch with WTP data                                 |
| D12 | Trial backstop                 | **Bill at 50 interactions OR 7 days, whichever comes first**                              |

---

## 3. Scope & surfaces

This change spans **three packages sharing one Convex backend**:

1. **`landing/`** (Next.js) — the marketing page redesign (most of the work; lowest risk).
2. **`convex/`** (Convex + Stripe) — pricing (annual price IDs), the trial lifecycle (card-required, value-milestone
   gating, Growth-level access, promo coupon), and removing the "posts-hidden-during-trial" rule.
3. **`app/`** (Vite/React) — the in-product trial experience: the **X/50 progress proxy**, the **day-1 SSI baseline**,
   and the checkout/upgrade UX (pre-select Growth, annual default).

Suggested sequencing (the implementation plan will finalize): **Phase 1 landing copy/proof/structure** (high-leverage,
isolated) → **Phase 2 pricing presentation + annual billing** → **Phase 3 trial & billing mechanics** (deepest backend
change).

---

## 4. Part 1 — Landing page redesign

### 4.1 Narrative spine

richardrx's **Hero → Pain → Solution → Proof → CTA**, density rising on scroll, one central transformation ("invisible
on LinkedIn → recruiters reaching out"), scannable in 5s.

### 4.2 Section-by-section

Each section below lists: **purpose · change vs current · persuasion mechanic**.

1. **Nav** — *unchanged structure.* Single highest-contrast CTA button preserved. Minor copy tune only.

2. **Hero (outcome-led).**
    - **Headline:** "Stop chasing jobs. Let them find you." (benefit-first, <10 words, names the ICP's desire).
    - **Sub-headline (tangible/credible/viable):** a private circle of professionals who boost each other's LinkedIn
      reach; your SSI climbs, recruiters notice; everything under your own identity, nothing automated.
    - **Replace the rotating slot-machine words** with a **single signature animation: an SSI gauge climbing** (the
      product's literal value; the "rising graph" peak-end moment). Rationale: rotating words delay 5-second
      comprehension and cost load; the gauge reinforces the message instead of competing with it.
    - **Primary CTA** with action + cost microcopy (answers what-happens / how-long / cost). New trial frame (see §6.4):
      e.g. *"Start free with LinkedIn →"* + click-trigger line beneath.
    - **Above-fold trust line:** "Sign in with LinkedIn — we never post without your approval." (Account-safety is the
      key objection for an OAuth product acting under the user's real identity.)
    - **Removed:** the fabricated "Join 500+ professionals…" line.

3. **Pain beat (NEW).** Short, high-contrast: *"You post. You apply. Silence."* Names the enemy (invisible to recruiters
   and the algorithm). One visual; hands off to the solution. Mechanic: clear enemy + loss framing.

4. **How it works = the circle.** Reframe the 3 steps to lead with the **network-effect mechanism as the reason it works
   **: real professionals engaging with each other's posts → all four SSI pillars move → recruiters notice. Fold in the
   moat line ("the more of us, the more reach for each of us"). Mechanic: differentiator + moat + "value before ask."

5. **SSIExplainer (condensed).** SSI in **plain language first** ("how findable you are to recruiters, 0–100"), the 4
   pillars as the mechanism beneath. **Keep the real LinkedIn-data stats** (45% / 5× / +51%, attributed to LinkedIn) —
   externally citable, legitimate proof. Mechanic: borrowed authority (LinkedIn's own metric), anti-jargon.

6. **Honest proof block** (replaces fabricated StatsBar + Testimonials) — see §5.

7. **Features — 3 cards** (down from 4). Each must ladder to "recruiters come to you." The **AI assist is sold by
   outcome** ("engage faster, more confidently"), **never "Powered by AI."** The unbacked **"Recruiter radar — coming
   soon"** card is cut from the grid (a future promise next to no proof erodes trust); if kept at all, it moves to a
   low-key one-line roadmap strip. Mechanic: every feature pulls toward the one claim; show the one feature you'd pitch
   in 30s.

8. **Pricing — 3 tiers + Enterprise line** — see §5/Part 2.

9. **FAQ — objection-led.** Reorder to lead with the real objections: **account safety / "is this within LinkedIn's ToS"
   ** first, then "how fast will I see results," then **honest trial scope** (card required, value-milestone, what's
   free). Keep concise. Mechanic: risk reducers as scannable trust.

10. **FinalCTA.** One dominant CTA + **honest scarcity**: the first-10 free-month promo with a **real** remaining-count,
    calm amber (not red).

11. **Footer** — unchanged.

### 4.3 Global guardrails

- **CTA = single highest-contrast element** on every screen; never two equal-weight buttons (avoids "narcissistic
  design").
- **Sub-3s, mobile-first.** Audit the Cormorant Garamond web-font load strategy and any hero animation for CLS/load
  cost; degrade gracefully on mobile. (Speed alone moved his conversion ~30%.)
- **Real human faces** where proof appears (founder / early members), not stock or pure abstraction.
- **Keep** the dark-navy/gold/serif identity — productive anti-generic contrast; do not introduce
  purple-gradient/bento/AI-orb tropes.

---

## 5. Honest proof system (replaces fabricated proof)

Pre-launch, **honesty is the proof**, with slots built for real proof to land later:

- **Founder's note** — a real short message + real photo (Henriko). Build-in-public authenticity.
- **Founding-cohort promo** — *"First 10 founding members get their first month free."* A **real** remaining-spots
  counter (amber). Honest scarcity — the one richardrx endorses. (Also the card-required launch incentive, D8.)
- **"Watch your own SSI move"** — "Risk-free: see your real LinkedIn SSI on day one, then watch it climb." The proof is
  the user's own real metric.
- **LinkedIn external stats** kept (45% / 5× / +51%, attributed).
- **Mechanism demo** — the animated feed + SSI gauge (show, don't claim).
- **Verifiable-testimonial component** — built to embed **clickable LinkedIn posts** (his top proof tier); shown only
  once real testimonials exist, never as an empty shell.

**Removed:** "10,000+ engagements," "+8 pts avg SSI in 30 days," "3 min/day," the three invented testimonials, and "Most
popular" as a *popularity* claim (the highlight stays as a *recommendation*).

---

## 6. Part 2 & 3 — Pricing, trial & billing rework

### 6.1 Pricing presentation (landing + app checkout)

- **Three cards:** Starter / **Growth (centre-stage, elevated, "Recommended", pre-selected)** / Pro. **Enterprise** → a
  single *"Teams & agencies — talk to us, from $X"* line below (keeps a high anchor visible).
- **Annual/monthly toggle, defaulted to annual** (≈2 months free; display "$X/mo billed annually" + monthly equivalent).
  Biggest untapped LTV lever; defaults capture 60–80% of choices.
- **Label "Recommended," not "Most popular"** (honest pre-launch).
- **Per-card serial-position order:** lead with the **reach/control benefit** (qualitative spine), quantified caps (
  25→50→200 interactions, 1→2→5 posts/wk) in the middle, the differentiator/loss-aversion line at the bottom by the CTA.
- **Tier behavioral roles:** Starter = deliberate **decoy** for Growth (sharpen its limits in copy); Growth = **target
  **; Pro + Enterprise = **anchor**.

### 6.2 Annual billing (backend)

- Add **annual Stripe price IDs** for Starter/Growth/Pro alongside the existing monthly ones; extend
  `getTierFromPriceId` and `ALLOWED_PRICE_IDS` (see PLATFORM.md §8). Tier→limits mapping is **period-agnostic** (plan
  limits unchanged). Checkout/Portal unaffected structurally; UI adds the toggle + annual default.

### 6.3 "Posts hidden during trial" removal (backend)

- **Current mechanism:** `isAuthorFeedEligible()` ([convex/feed.ts:77](../../convex/feed.ts)) excludes authors with
  `subscriptionStatus === 'trialing'` → their posts never reach others' feeds.
- **Change:** trial users get the **full reciprocal Growth-level experience** — their posts ARE feed-eligible, and their
  feed is filtered at Growth level. Concretely: (a) make trialing authors eligible in `isAuthorFeedEligible` (keep the
  pending-deletion exclusion), and (b) map trial users to **Growth-level** `buildFeedFilter` (industry+country from
  profile) rather than Starter/no-filter. Implementation plan to pin the exact mapping (likely an effective-tier helper
  that treats `trialing` as `growth`).

### 6.4 Trial lifecycle (the core rework)

New model, replacing "3-day calendar trial on Starter, posts hidden":

- **Card required** at signup (Stripe). High-intent filter.
- **Growth-level access** during trial (per §6.3).
- **Value-milestone gating: 50 interactions (made + received, combined)** — not a calendar. A persistent **progress
  proxy "X / 50"** and the user's **day-1 real SSI baseline** make progress felt before LinkedIn's SSI refresh. This
  number doubles as the **activation magic-number**.
- **Launch promo:** first 10 signups get a **free-month coupon** (Stripe coupon/promotion code). Surfaced as the page's
  honest scarcity.
- **When billing starts (decided):** the paid subscription begins at **50 combined interactions OR 7 days, whichever
  comes first.** Active users convert at peak engagement — right after they've felt the value (hit 50, SSI moved);
  inactive users hit the **7-day backstop** so card-on-file users never sit free indefinitely. The **first-10 coupon**
  then makes that first paid month free (the coupon governs *price*; the gate governs *timing*). Must be clearly
  disclosed at signup and surfaced via the progress proxy.
- **Copy retirement:** remove **"3-day free trial · no credit card required"** everywhere (Hero, Pricing, FinalCTA,
  FAQ) — it's wrong on all three counts now. New frame: *"Start free — no charge until you've made 50 interactions or
  for 7 days, whichever comes first. Card required, cancel anytime,"* plus the first-10 promo.

### 6.5 Compliance guardrail

The current webhook schedules an **Apify sync on activation** (PLATFORM.md §8). **Apify is dormant** per the compliance
gate — the trial/billing rework must **not** re-enable or newly trigger Apify scraping. Preserve the dormant state.

---

## 7. Docs to update during implementation (`docs/PLATFORM.md`)

- **§1** Product Overview & **Subscription tiers** table (trial = milestone-gated + card-required + Growth-level;
  promo).
- **§8** Subscriptions & Billing (annual price IDs, coupon, card-on-file, charge trigger).
- **§9** Plan Limits (note trial maps to Growth-level access; numbers unchanged).
- **§11** Feed & Engagement (`isAuthorFeedEligible` change; trial reciprocity).
- **§15** Landing site (new sections, copy, proof system).

---

## 8. Testing approach

Per project convention (no `convex-test`; mock `convex/server` + unit-test pure logic):

- **Pure-logic units** to test directly: `buildFeedFilter` (trial→Growth mapping), the new `isAuthorFeedEligible` (
  trialing now eligible; pending-deletion still excluded), the milestone counter (made + received → 50),
  `getTierFromPriceId` (annual IDs).
- **Landing:** `npm run build` (0 TS errors / 0 warnings); manual scroll-order + mobile (375px) + FAQ accordion checks;
  Lighthouse/perf pass (<3s, good CLS).
- **Edge cases to cover:** card declined at signup; promo-coupon exhaustion (11th signup); milestone backstop boundary;
  annual/monthly switch; a trialing user's posts now appearing in feeds.

---

## 9. Open questions for the implementation plan

1. ~~Charge backstop~~ — **DECIDED:** billing at 50 interactions **or 7 days**, whichever comes first.
2. Exact **effective-tier** representation for trial (treat `trialing` as `growth` via helper vs. a real status change).
3. **Annual price points** (e.g., Growth $150/yr?) and whether Starter gets an annual option at all.
4. Whether the **first-10 promo** is a Stripe coupon auto-applied to the first 10 customers vs. a shared promo code (
   abuse/limit handling).
5. Final **microcopy** for the new trial frame + CTAs (candidates above; A/B once there's traffic).

---

## 10. References

- Evidence base: [2026-06-20-richardrx-landing-insights.md](../research/2026-06-20-richardrx-landing-insights.md)
- Current landing components: `landing/components/*`, `landing/app/page.tsx`
- Backend touchpoints: `convex/feed.ts`, `convex/stripe.ts`, `convex/billing.ts`, `convex/lib/planLimits.ts`,
  `convex/schema.ts`
- Platform doc: `docs/PLATFORM.md` §1, §8, §9, §11, §15
