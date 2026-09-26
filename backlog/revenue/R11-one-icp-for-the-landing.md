# R11 — ⚖️ One ICP for the landing

> **Status:** DONE · **Priority:** P1 · **Effort:** M · **Category:** Positioning / Landing copy
> **Depends on:** none · **Blocks:** [[R10]] (which proof to gather), [[R12]] (CTA verbs), [[R14]] (expectation copy)

## Principle

**Who talks to everyone convinces no one.** A clear ideal customer profile is a deliberately
chosen, under-served niche, not everyone who could use the product. Conversion is context
engineering: debug the Who (ICP) and the When (awareness level) before touching copy or design,
then pick the channels with the Bullseye framework instead of scattershot testing.
Sources: [pick a deliberately under-served niche](https://x.com/richardrx/status/2086788998924570865),
[a sharp niche beats no niche](https://x.com/richardrx/status/2056789797646029232),
[the cascade: ICP, awareness level, message, visuals](https://x.com/richardrx/status/2069469303464730988).
Bullseye: "Concentrate channels with the Bullseye framework" in the skill's positioning reference.

## Summary

The landing speaks to three audiences. The hero and the pain beat address job seekers ("Stop
chasing jobs. Let them find you.", "You post. You apply. Silence."). The stats and the SSI itself
address social sellers (opportunities, quota; LinkedIn built the SSI for sales). The Enterprise
line addresses teams and agencies. The features section speaks to creators who want reach control.
Each section is fine alone; together they tell a visitor the product is for someone else.

## Evidence

- `landing/i18n/dictionaries/en.json:16-17` — hero "Stop chasing jobs." / "Let them find you."; `:24-29` pain beat about applying and recruiters.
- `landing/i18n/dictionaries/en.json:79-93` — stats about opportunities and quota (social selling).
- `landing/i18n/dictionaries/en.json:109-131` — features: industry-first feed (Growth and up), AI comment drafts (all tiers), reach control by industry and country (Pro). Creator and seller framing.
- `landing/i18n/dictionaries/en.json:153-155` — "Teams & agencies: Enterprise from $100/mo".
- `landing/i18n/dictionaries/en.json:98-107` — the Proof section talks about good people staying invisible (job seekers) while pointing at the SSI (sales).
- `landing/i18n/dictionaries/en.json:213-214` — the FAQ defines the SSI as "how findable you are" (job-seeker frame); LinkedIn defines it as a social selling measure.
- Landing routes: `landing/app/[lang]/` with 12 SSG pages (memory `landing-theming-i18n`); no segment pages exist.
- Memory `landing-conversion-redesign`: the hero headline was locked on 2026-06-20. This item may reopen it; that is Henriko's call.

## Root cause

The SSI is a sales metric and the founder's story is a job-seeker story. The landing rework
grounded every section in a principle but never chose the reader, so each section picked its own.

## What we need to do

This is a decision document. The brainstorm picks one option; the copy sweep follows.

1. **⚖️ Choose the ICP.**
   - **Option 1: professionals who want inbound (job seekers).** Keep the hero and the pain beat. Drop the quota and opportunity stats ([[R10]]). Reframe the SSI through LinkedIn's pillar names ("establish your professional brand", "find the right people"). Reword features as "be seen by the people who hire in your field". Replace the Enterprise line with something that fits (career coaches, bootcamps) or remove it.
   - **Option 2: social sellers, founders and consultants (the SSI's native audience).** Rewrite the hero ("Raise your SSI. Fill your pipeline.") and the pain beat (cold outreach ignored). Keep the stats with sources. Enterprise for sales teams and agencies fits. Features fit as they are.
   - **Option 3: two segment pages.** `/[lang]/for-job-seekers` and `/[lang]/for-sales` with shared sections; the home page keeps one hero and links to the other segment. Cost: two copies of the hero, pain and FAQ in three languages, and 12 to 18 SSG pages.
   - **Recommendation: Option 2**, unless Henriko's first twenty customers are reachable job seekers. The SSI's native audience is sellers, Pro and Enterprise (reach control, targeting, teams) monetize sellers better, and job seekers churn on hire because their job-to-be-done ends.
2. **Set the awareness level.** Job seekers are mostly unaware of the SSI, so the current problem-first order is right for Option 1. Sellers who track their SSI are solution-aware, so Option 2 can name the SSI and the mechanism in the hero.
3. **Bullseye inputs.** Henriko lists the three channels he can work this quarter (his own LinkedIn presence, communities, direct outreach) and checks that the chosen ICP is reachable there. An ICP nobody can reach is a wish.
4. **Copy sweep after the decision.** Hero, pain beat, features, stats, proof, FAQ, plan feature lists (`en.json:161-166`, `:173-178`, `:185-191`), in en, pt and es. Deslop the result. The Terms are unaffected.
5. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Define the ICP by buying criteria**: trigger, pain, prior attempt, proof needed. Demographics say nothing about why they buy ([@richardrx · 2026-01-14](https://x.com/richardrx/status/2011427153133351046)).
- **Run the cascade in order**: ICP, then awareness level, then copy, then visuals. Nobody touches the hero before the first two are written down ([@richardrx · 2026-06-23](https://x.com/richardrx/status/2069469303464730988)).
- **Let omission filter.** The pain you name and the ones you leave out tell the wrong visitor they are in the wrong store, which is cheaper than serving them ([@richardrx · 2025-12-10](https://x.com/richardrx/status/1998737605677007146), [@richardrx · 2026-05-18](https://x.com/richardrx/status/2056385204785213446)).
- **Test the hero on a stranger from the ICP for five seconds**: what is it, for whom, why now ([@richardrx · 2026-05-29](https://x.com/richardrx/status/2060409264683044995), [@richardrx · 2026-05-01](https://x.com/richardrx/status/2050280273682510230)).
- **Read CTR and cold-traffic conversion as the positioning signal.** Niching moved CTR from 0.3% to 1.5% with no product change ([@richardrx · 2026-08-14](https://x.com/richardrx/status/2088270847324594453)).
- **Segment churn by how the user arrived** once there are users; an ICP mismatch at the door looks like a product problem later ([@richardrx · 2026-09-01](https://x.com/richardrx/status/2094880682627784875)).
- **If two ICPs survive, give each its own page and offer.** One page cannot sell aligners and implants ([@richardrx · 2025-10-20](https://x.com/richardrx/status/1980296541966422253)).
- **Answer the eleven audit questions before any copy or layout**: where the visitor came from, what they expected when they clicked, who the ICP is, what pain brought them, what exactly is sold, whether that reads in five seconds, whether the promise matches the source, and the rest in the post. Design is the last layer of the audit ([@richardrx · 2026-08-17](https://x.com/richardrx/status/2089358047487344848)).
- **Name the mechanism a generic tool cannot claim.** The feed matches by industry and country and the app keeps the member's own record; a niche the big tools ignore beats a broad promise ([@richardrx · 2026-01-19](https://x.com/richardrx/status/2013264068518289753)).

**Don't**

- **Don't write the hero "for professionals who want to grow".** Who talks to everyone convinces no one ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)); 2,000 generic visitors converted nobody ([@richardrx · 2026-08-10](https://x.com/richardrx/status/2086788998924570865)).
- **Don't pick the ICP by market size alone.** The filters are pain weight, ability to pay, founder fit ([@richardrx · 2026-05-19](https://x.com/richardrx/status/2056789797646029232)).
- **Don't validate with compliments.** Sell to twenty people inside the ICP and count who pays ([@richardrx · 2026-07-07](https://x.com/richardrx/status/2074539418266812580)).
- **Don't use insider jargon on a reach surface** unless the term is doing the qualifying on purpose ([@richardrx · 2025-11-26](https://x.com/richardrx/status/1993665126793117751)).
- **Don't sell the solution to the unaware.** Write the headline for the visitor's current awareness stage and the proof for the next ([@richardrx · 2026-01-14](https://x.com/richardrx/status/2011427153133351046)).
- **Don't decide from synthetic personas.** The answer that matters is the one you could not have generated ([@richardrx · 2026-06-22](https://x.com/richardrx/status/2069082668646404187)).
- **Don't re-add "boost each other" wording** (standing decision).
- **Don't headline the AI.** "Powered by AI" names a component; every tool calls the same models, and the difference is the assembly: the match, the record, the handoff. Say what the draft saves the member and let the model stay a part ([@richardrx · 2025-11-11](https://x.com/richardrx/status/1988214637322514843), [@richardrx · 2026-03-03](https://x.com/richardrx/status/2028837448717926518)).
- **Don't treat conversion from Henriko's own network as the baseline.** Warm visitors forgive the page; only cold traffic shows the page's real ceiling ([@richardrx · 2026-06-08](https://x.com/richardrx/status/2063972594223661127)).

## Acceptance criteria

- [x] `docs/PLATFORM.md` §15 names one audience and its awareness level.
- [x] Every landing section addresses that audience; stats and features agree with it. (Stat *sources* are still R10's job.)
- [x] pt and es match en.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **The locked hero.** Option 2 reopens the 2026-06-20 headline decision; state it plainly in the brainstorm.
- **Option 3 doubles copy maintenance** and adds routes; only worth it with evidence that both segments convert.
- **The product does not change.** The industry filter, reach control and AI drafts are audience-neutral; only the story changes. Do not let the ICP choice leak into feature scope.
- **No invented proof for either audience** ([[R10]]).

## Docs to update

- `docs/PLATFORM.md` §15 (Landing) — the audience, the awareness level, and a section-by-section copy map.
- `docs/PLATFORM.md` §1 (Overview) — the one-line product description, if it changes.

## References

- Related: [[R10]], [[R12]], [[R14]].
- Prior art / plan: memory `landing-conversion-redesign` (locked decisions); skill reference `positioning-icp-and-gtm.md` (niche, Bullseye).
- Principle sources: [@richardrx · 2026-08-10](https://x.com/richardrx/status/2086788998924570865), [@richardrx · 2026-05-19](https://x.com/richardrx/status/2056789797646029232), [@richardrx · 2026-06-23](https://x.com/richardrx/status/2069469303464730988).
