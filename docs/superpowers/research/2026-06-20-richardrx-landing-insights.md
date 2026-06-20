# Landing Page Conversion Redesign — Insights from @richardrx

> **Research artifact** (not a spec). Evidence base for the landing-page redesign.
> Mined from `H:\tweets_richardrx_3.md` (466 curated tweets from @richardrx, a senior
> product/UX designer), via 5 parallel agents across 17 topic sections. All quotes are
> Portuguese originals translated to English; each links to the source tweet.
>
> **Note on tweet comments:** the user asked to fetch replies/comments from "the twitter
> link." X.com returns **HTTP 402 / login wall** to programmatic fetching, and the doc
> contains 466 distinct tweet links (no single canonical one). Replies are therefore not
> retrievable automatically — see "Open decisions."

---

## Part A — The 13 converging principles (deduped, prioritized)

### 1. Promise = proof. The market believes what you *demonstrate*, not what you *claim*.

Fabricated proof, once discovered, **reverses into repulsion** ("ressignifica… gera repulsa").
Proof hierarchy: testimonial card < WhatsApp screenshot < **embedded clickable LinkedIn post** < UGC video.
When real, use **specific** numbers ("526" reads true; "500+" reads as marketing) and avoid a suspicious perfect 5.0 (
purchase intent peaks at 4.2–4.5★).

- https://x.com/richardrx/status/2051672248348479691 (RCD
  #4) · https://x.com/richardrx/status/1988605235775082902 · https://x.com/richardrx/status/1975181466368634940 · https://x.com/richardrx/status/2024141244717281514 · https://x.com/richardrx/status/2054910531132183030

### 2. Headline = the ICP's pain/benefit, not your metric or jargon. <10 words. Benefit first, feature second.

"Nobody cares about your features" — sell *3,000 songs in your pocket*, not *6GB*. The sub-headline makes the promise *
*tangible, credible, viable**.

- https://x.com/richardrx/status/1964708012624597055 · https://x.com/richardrx/status/1987842649261261240 · https://x.com/richardrx/status/1993665126793117751 · https://x.com/richardrx/status/2061569425635934683 (
  if you can't state your differentiator, something's wrong)

### 3. One primary CTA. Microcopy beats button color/shape, and must answer: what happens / how long / what it costs.

Two buttons of equal visual weight is "the most common error." Name the exact action the product delivers — never "Learn
more."

- https://x.com/richardrx/status/2058875777739866490 · https://x.com/richardrx/status/1987842649261261240 · https://x.com/richardrx/status/1997279485217976562

### 4. Structure: Hero → Pain → Solution → Proof → CTA. Increase density as the user scrolls. ≤3 feature sections. One transformation, many proof points, scannable in 5 seconds.

"Attract → Qualify → Sell. Start from a single point and expand."

- https://x.com/richardrx/status/2007216871607771303 · https://x.com/richardrx/status/1998737605677007146

### 5. Attention hierarchy: "light the exit, dim every other light." If everything grabs attention, nothing does.

Beautiful-but-non-converting = **"narcissistic design"** (made to win awards, not to convert; CTA hidden, no hierarchy).
The brain processes **contrast → placement → trust** *before* it reads words.

- https://x.com/richardrx/status/2014317885494059106 · https://x.com/richardrx/status/1978219314038628832 · https://x.com/richardrx/status/1988701627830665689 · https://x.com/richardrx/status/2049215050997784774

### 6. Risk reducers near every CTA, as scannable signals (a seal + a number beats a paragraph).

For an OAuth product touching the user's real professional identity, **account-safety reassurance** is the key
objection: "Sign in with LinkedIn" (familiarity = safety), "We never post without your approval," "Cancel anytime," "No
credit card."

- https://x.com/richardrx/status/2009227121441341734 · https://x.com/richardrx/status/2007216871607771303 · https://x.com/richardrx/status/2002076748112875558 (
  click trigger under the CTA)

### 7. Pricing: 3 tiers, not 4 (Hick's Law / choice paralysis). Highlight exactly one. Anchor high. Give each tier a behavioral job.

The middle plan owns attention (**Centre-Stage Effect**) → put the target plan there. The most expensive tier exists to
**anchor** even if few buy it. A deliberately-limited tier is a **decoy** (Economist case: +30–43% revenue). Show the
high price first so the cheap one reads cheap.

- https://x.com/richardrx/status/2059951433827426437 · https://x.com/richardrx/status/2006022937770414515 · https://x.com/richardrx/status/1980402468673483181 · https://x.com/richardrx/status/2046544442216054981 · https://x.com/richardrx/status/2044014136770580743

### 8. Defaults capture 60–80% of choices. Pre-select the target plan; add annual billing and default to annual.

Removing monthly and showing annual + a 3-day trial lifted annual subs ~15–20% (Mojo case — same 3-day trial we use).

- https://x.com/richardrx/status/2057872036718899256 · https://x.com/richardrx/status/1986454460281836026 · https://x.com/richardrx/status/2013339752934629537 (
  default effect)

### 9. Trial: gate on **value delivered

**, not the calendar. Don't withhold the core value during the trial. Card-on-file converts ~3× (31.4% vs 8.9%) but
reduces signups.

The cancellation is decided **day 1**, merely *formalized* when Stripe's reminder hits. Trial→paid is an
onboarding/journey problem, not a pricing problem. Low ticket ($5) signals "low value" and predicts higher churn.

- https://x.com/richardrx/status/2052096365128273956 · https://x.com/richardrx/status/2033502548301091057 · https://x.com/richardrx/status/2028471666297217460 · https://x.com/richardrx/status/2057436163841941980 · https://x.com/richardrx/status/2015049186635309184 · https://x.com/richardrx/status/2032485654811083005

### 10. AI is never the hero. Never sell "Powered by AI." Sell the outcome (engage faster, more confidently).

"Powered by AI" today is like bragging your 1.0 engine is turbo. AI also ships the *average* (purple gradient +
bento + "next-gen AI" headline = looks like 10,000 other SaaS sites).

- https://x.com/richardrx/status/1988214637322514843 · https://x.com/richardrx/status/2017003938575196189

### 11. Keep a distinctive, high-craft look (anti-generic is an asset) — but aesthetics *sell*, usability + contrast

*convert*. And: sub-3s, mobile-first; speed alone moved conversion ~30%. Use real human faces.

Generic/AI-template visuals trigger the scam-detector ("isso parece template"). One tasteful signature moment (an SSI
gauge climbing) signals care. But audit the serif web-font + slot-machine animation for load cost; real users/faces
out-convert stock.

- https://x.com/richardrx/status/1968302796341645511 · https://x.com/richardrx/status/1990455553882009723 · https://x.com/richardrx/status/1985681720104903142 · https://x.com/richardrx/status/2011387621264572720

### 12. The network effect is the moat

*and* the differentiator — foreground it. Every feature must pull toward the one claim.

Software is commoditizable; community / internal network effects aren't. A feature that disperses the claim dilutes
value. Show only the one feature you'd pitch in 30 seconds; demote the rest.

- https://x.com/richardrx/status/2028777831233114152 · https://x.com/richardrx/status/2059236567533650119 · https://x.com/richardrx/status/2057124008445796659

### 13. Legitimate scarcity only. The one honest lever pre-launch: a capped founding/early-access cohort (calm amber, not alarmist red).

"Never create scarcity that isn't real — never underestimate the user's intelligence." Limiting a pre-launch to a fixed
number of users is explicitly endorsed.

- https://x.com/richardrx/status/1993428362455589107 · https://x.com/richardrx/status/2007100585464439150

**Adjacent (post-click coherence — the LP promise must survive into the product):** learn-by-doing first run (drop into
feed, "react now") · endowed progress ("✓ LinkedIn connected, 2 steps left") · render the SSI lift as a **rising,
celebratory graph**, not a static number (Peak-End) · one declarative "what's your goal?" step (good friction) · keep
signup at one-click OAuth (no form).

- https://x.com/richardrx/status/2046959126245249288 · https://x.com/richardrx/status/2044785090832543998 · https://x.com/richardrx/status/2040415841628651689 · https://x.com/richardrx/status/2052350703541039324

**Distribution (beyond this page):** better page > more traffic (2%→7% conversion = 3× leads, same spend) · referral as
an in-product *gift to your friend* at peak value, no cash · long-tail SEO via many pages.

- https://x.com/richardrx/status/2033918695206944872 · https://x.com/richardrx/status/2061766945582559509 · https://x.com/richardrx/status/2015749184175890494

---

## Part B — Current landing page audit (what contradicts the principles)

| #  | Current state                                                                                                                                                             | Violates           | Fix direction                                                                                       |
|----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------|-----------------------------------------------------------------------------------------------------|
| B1 | "Join 500+ professionals", "10,000+ engagements", "+8 pts avg SSI in 30 days", 3 named testimonials, "Most popular" badge — all **fabricated** (pre-launch, no prod data) | #1 (proof=promise) | Remove or replace with honest pre-launch proof; biggest credibility + legal risk on the page        |
| B2 | Hero headline "Because your SSI matters to you / recruiters / everyone else" — sells the **metric (SSI)**, abstract, animated cycle delays comprehension                  | #2, #4, #5         | Lead with the ICP outcome ("recruiters come to you"), <10 words, instantly scannable                |
| B3 | Primary CTA "Join the circle — it's free" — brand metaphor, vague about the action                                                                                        | #3                 | Action-specific microcopy answering what/how-long/cost                                              |
| B4 | No explicit **Pain** section; jumps Hero → SSIExplainer (technical)                                                                                                       | #4                 | Insert a short pain beat; sequence Hero → Pain → Solution → Proof → CTA                             |
| B5 | Pricing shows **4 tiers across** (Starter/Growth/Pro/Enterprise), each card similar weight; Enterprise has no visible price                                               | #7 (Hick), #5      | 3 self-serve tiers + Enterprise as a "contact" line; one highlighted; anchor high                   |
| B6 | **Monthly-only** billing; no plan pre-selected                                                                                                                            | #8                 | Add annual (default annual); pre-select Growth                                                      |
| B7 | **"Posts hidden during trial"** + trial only on the $5 Starter                                                                                                            | #9                 | Stop withholding the core value in trial; reconsider trialing higher value; gate on value milestone |
| B8 | 4-card Features incl. "Recruiter radar — coming soon" (unbacked future promise next to fake proof)                                                                        | #1, #12            | Cut to ≤3, each laddering to the SSI/recruiter claim; demote/relabel roadmap items                  |
| B9 | Multiple equal-weight 4-item grids (4 pillars, 4 stats, 4 features, 4 tiers) — diffuse attention                                                                          | #5                 | Establish one focal action per section                                                              |

## Part C — Pricing & business-rule findings (these touch the backend, not just the LP)

- **4 → 3 tiers** on the page; Enterprise becomes "Need more? Talk to us." (presentation; backend tiers unchanged.)
- **Annual billing**, defaulted to annual — the single biggest untapped LTV lever. (Stripe price IDs + checkout +
  plan-limits unaffected by period, but needs new annual price IDs + UI.)
- **Trial redesign:** stop hiding the feed/posts during trial (the core value); consider value-milestone gating and/or
  card-on-file; reconsider trial-only-on-Starter (low ticket → churn).
- **Tier roles:** Starter = deliberate decoy for Growth; Growth = centre-stage target (pre-selected, "most popular");
  Pro/Enterprise = high anchor (show a number).
- **Single progression axis:** lead with the qualitative reach/control story; keep the quantified caps (25→50→200
  interactions, 1→2→5 posts/wk) as supporting detail.

## Part D — What the current design gets RIGHT (keep)

- **Paid-only, no free tier** ($5 floor) — correct; a "$0" anchor poisons paid tiers. (But $5 may be *too* low — see
  #9.)
- **One-click LinkedIn OAuth signup, no form** — the ideal low-friction signup; protect it.
- **Quantified tier specs** — exactly the scannable, quantified differentiation recommended.
- **Distinctive dark-navy + gold + Cormorant-serif identity** — productive contrast vs. templated/AI-generic SaaS; an
  asset, not a liability (keep, but verify CTA contrast + performance).
- **SSI = LinkedIn's own metric** — borrowed authority; lean into it.

## Part E — Open decisions for the user (gating)

1. **Honesty of proof** — remove fabricated proof / provide real data / accept the risk?
2. **Scope** — conversion overhaul keeping the aesthetic / full visual redesign / copy+proof only?
3. **Pricing & business-rule appetite** — include backend changes (3-tier, annual, trial) or landing-only?
4. **Tweet comments** — X blocks fetching; skip / user pastes / point to a specific tweet?
