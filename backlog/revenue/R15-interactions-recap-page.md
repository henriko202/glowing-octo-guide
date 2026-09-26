# R15 — Interactions recap page (the proof we can show)

> **Status:** DONE 2026-09-07 · **Priority:** P1 · **Effort:** L · **Category:** Product / Backend / Frontend / Privacy
> **Depends on:** [[R08]] (the `UpgradeAtLimit` component and the next-tier rule; if R15 ships first, build the component here and R08 reuses it) · **Blocks:** [[R10]] (first-party proof), [[R14]] (recap email content), [[R06]] (shares the recap query), [[R16]] (shares the window toggle and the nav pattern)

## Principle

**Your promise is the size of your proof, and the proof has to live where the user can see it.**
The product sold "real growth in your own SSI, measured on LinkedIn itself". LinkedIn is closing
the free SSI page, so that proof disappears for everyone without Sales Navigator. The app already
records every reaction and comment a member makes, and every one their posts receive. Showing that
back, per week and per month, is first-party proof no paywall can remove. Never ship a blank
dashboard: the recap must start above zero and point at the next action, and a recap that ends a
period well is the peak-end moment worth celebrating. The same page is where usage meets the
plan's limit: a post filling its cap is the moment the next tier is an answer, never an
interruption.
Sources: [precise numbers convince](https://x.com/richardrx/status/2024141244717281514),
[never ship a blank dashboard](https://x.com/richardrx/status/2054283657934758021),
[celebrate the activation moment](https://x.com/richardrx/status/2040415841628651689),
[expansion is born of usage](https://x.com/richardrx/status/2051672248348479691),
[upgrade at the limit, framed as loss](https://x.com/richardrx/status/2046544442216054981).

## Summary

Since 2026-08-27 LinkedIn shows members without a paid plan a banner on the SSI dashboard: access
will be discontinued, SSI is a Sales Navigator feature. Three places in this product send the user
to that page as the proof of value: the sidebar link, the billing page link, and the landing's
Proof card. Henriko's direction (2026-09-05): replace "check your SSI" with an in-app recap page,
reachable from the sidebar and the ⌘K quick actions, showing the interactions the member made
and received, with a 7-day and a monthly view. A comment counts at the moment the member taps
Comment on a post, the same tap that records it today. Generating an AI draft counts nothing: the
app cannot observe the comment landing on LinkedIn, and a draft the member never posts is not an
interaction (Henriko, 2026-09-05).

Henriko's additions (2026-09-05, later): the page also shows how many of the member's posts were
featured in the window, a progress bar per live post toward the tier's interaction cap (25 on
Starter, 50 on Growth, 200 on Pro, a custom number on the contact tier) and, once a post reaches
80% of that cap, an upgrade section for the next tier. On Pro the next step is the Enterprise
contact line and on the contact tier the custom-limit line, never a checkout link to a plan the
member already has. In this product the cap is per post, so "progress toward the tier maximum" is
one bar per post, not a monthly allowance. A separate history page lists every interaction with
the post and the comment text ([[R16]]).

Deferrals from the R04–R08 batch (2026-09-06, this page not yet built): three loose ends this
batch created that R15 inherits. (1) [[R05]]'s empty-feed checklist and the [[R04]] card-gate
banner both currently send the member back to `/feed`, not a dedicated recap route — once this
page exists at `/recap`, point those at it instead. (2) LinkedIn paywalled the free SSI page behind
Sales Navigator during this batch; [[R04]] and [[R06]] no longer tell a member to check their own
SSI score, so the "Have Sales Navigator? Your SSI is still at linkedin.com/sales/ssi." line (item
11 above) is the only remaining SSI mention once this page ships — nothing to reconcile, just
confirms the retirement plan in item 11 still stands. (3) [[R08]]'s `UpgradeAtLimit` shipped in
this batch WITHOUT the `nearCap` boolean prop named in item 16 above — its only caller in the R04–
R08 batch is R08's own "reached the cap and left the feed" moment, which doesn't need it. Item 16's
"20 of 25" wording still needs that prop added when this page is built.

## Evidence

- LinkedIn's SSI page banner (2026-08-27): "Your access to the Social Selling Index (SSI) page will be discontinued soon. SSI is a Sales Navigator feature." Reported by [Ladybugz](https://www.ladybugz.co.za/linkedin-ssi-going-premium-2026/) and [LinkedScore](https://www.linkedscore.app/blog/linkedin-ssi-discontinued); LinkedIn's own page is now titled [From SSI to AI](https://business.linkedin.com/sales-solutions/social-selling/the-social-selling-index-ssi).
- `app/src/components/shell/Sidebar.tsx:61-67` — the link-out to `linkedin.com/sales/ssi` with `nav.viewSsi` (`app/src/i18n/locales/en.json:12`); `en.json:172` `billing.ssiLink` on the billing page.
- `landing/components/Proof.tsx` and `landing/i18n/dictionaries/en.json:104-106` — "See real growth in your SSI number from day one, measured on LinkedIn itself, not by us." plus "Check your current SSI on LinkedIn"; `:214` FAQ "You can check your real score on LinkedIn anytime."
- `convex/schema.ts:349-360` — `userInteractions`: one row per reaction or comment made (`userId`, `postId`, `kind`, `reaction`, `comment`, `createdAt`), indexes `by_user` and `by_post`. Convex appends `_creationTime` to every index, so `by_user` already supports a time-window range read. Built for the DSR export "and a future admin dashboard" (`docs/PLATFORM.md:632-636`).
- `convex/schema.ts:368-377` — `userPostState`: `reactedAt` (one reaction per user per post) and `commentDraft` (the last AI draft).
- `convex/interactions.ts:67` — `recordInteraction` appends the log row; called best-effort from `commentOnPost` (`:214`, call at `:243`) and, only when counted, from `reactToPost` (`:259`, call at `:289`).
- `convex/interactions.ts:109-147` and `:169-203` — the count mutations know `post.authorId`, load the author's limits and flip `interactionLimitReached` when `likeCount + commentCount` reaches `interactionsPerPost`; the pure decision lives in `convex/lib/interactionLimit.ts:4-19`.
- `convex/schema.ts:133-135` — `posts.interactionLimitReached`; a flagged post leaves the feed. The cap counts total engagement: the LinkedIn-seeded counts at import plus in-app taps (`docs/PLATFORM.md:1045-1046`). `convex/posts.ts:335-343` rejects a submission already at the cap.
- `convex/lib/planLimits.ts:27-32` — `DEFAULTS`: Starter 25 interactions per post, 1 post per week, 0 featured per month; Growth 50 / 2 / 1; Pro 200 / 5 / 3; contact 200 / 5 / 9999. The 9999 is the "unlimited" sentinel, `UNLIMITED_FEATURED_SENTINEL` from `convex/lib/postLimit.ts` (comment at `:19-21`). Contact-tier users get their per-user override row first (`:59`, `:78`). `tierToRank` (`:116-129`): contact 4, pro 3, growth 2, starter 1.
- `convex/schema.ts:124-125` — `posts.isFeatured`, `posts.featuredAt`; `convex/schema.ts:184-188` — `featuredPostUsage` (`userId`, `month`, `usedCount`).
- `convex/posts.ts:56-82` — `getMyPosts` (500 newest by `by_author`, soft-deleted dropped, hidden kept); `:117` `getWeeklyUsage` returns `usedCount` and `postsPerWeek`; `:150` `getFeaturedUsage`. `app/src/pages/MyPostsPage.tsx:54-57` already subscribes to all three and `:173-177` renders the 9999 sentinel as "unlimited".
- `app/src/pages/BillingPage.tsx:291-309` — the Enterprise card and the `billing.enterprise` line both link `mailto:${SUPPORT_EMAIL}` (`app/src/i18n/locales/en.json:154-155`, `:217-220`).
- `app/src/components/LinkedInEmbed.tsx:26-32` — the permalink builder (`/feed/update/<urn>/`) the post links reuse.
- `convex/interactions.ts:18-38` and `convex/schema.ts:52-53` — `trialInteractionsMade` and `trialInteractionsReceived` count only while trialing; they are not lifetime counters.
- `convex/ai/comments.ts:16-48` — `generateComment` gates, rate-limits (30 per hour), checks the post is engageable and saves the draft (`:45`). It records no interaction and bumps no counter, and per the 2026-09-05 decision it stays that way.
- `app/src/components/CommentBox.tsx:37-42` — the client calls `generateComment`, then `commentOnPost` when the user taps Comment; `app/src/pages/FeedPage.tsx:46` calls `reactToPost`.
- `app/src/components/shell/navItems.ts:6-13` — `NAV_GROUPS` (feed, my-posts; billing, settings, privacy); `app/src/components/shell/CommandPalette.tsx:55-62` renders those same items under "Quick actions" (`shell.groupActions`, `en.json:19`), so one nav entry covers the sidebar and ⌘K.
- `app/src/App.tsx:84-140` — the route table; `convex/schema.ts:161` — `posts.by_author`.
- `docs/PLATFORM.md:2073` — export and erasure already cover `userInteractions` and `userPostState`; new fields must follow.

## Root cause

The engagement log was built for the data-subject export, and the product's proof was delegated
to LinkedIn's free SSI page. LinkedIn is now closing that page. The plan limits exist and bind,
but no member-facing screen shows how close a post is to its cap, so the strongest upgrade moment
passes unseen.

## What we need to do

### A. Data model (widen and dual-write; pre-launch, no backfill)

1. **Received side.** Add `authorId: v.optional(v.id('users'))` to `userInteractions` and an index `by_author: ['authorId']`. Write it from the count mutations (`incrementCommentCount`, `incrementLikeCount`), which already load the post. Pre-launch rows without it are ignored (memory `prelaunch-no-prod-data`).
2. **Make the log atomic with the count.** Move the `userInteractions` insert into the two count mutations (pass `reaction` and `comment` through) and delete the best-effort `recordInteraction` call sites, so the recap can never disagree with `posts.likeCount` and `commentCount`.
3. **Only the Comment tap counts (decided 2026-09-05).** `generateComment` keeps recording nothing and bumping nothing. The comment row is written when the member taps Comment in `CommentBox.tsx` and `commentOnPost` runs, exactly as today; the reaction row when `reactToPost` counts one. No `ai_draft` kind, no draft dedupe, no counter in `convex/ai/comments.ts`. If the brainstorm wants an "AI-assisted" sub-line on the page, the client passes `aiAssisted: true` to `commentOnPost` when the submitted text equals the saved draft, stored as `aiAssisted: v.optional(v.boolean())` on the row; it changes no count. Skip it in the first cut.
4. **Privacy.** `authorId` on another member's row is the author's id; erasure of the author drains `by_author` (today the `by_post` drain does this per post; the new index makes it direct). The export keeps only the user's own rows (`by_user`); received data is other members' activity and is exported as counts only. Update the §13B data inventory, `convex/privacy/export.ts` and `convex/privacy/deletion.ts`.

### B. Query and pure helpers

5. **`interactions.getRecap({ sessionToken, window: '7d' | '30d' })`.** Two indexed range reads (`by_user` and `by_author`, `_creationTime >= since`), bounded with `.take(2000)` and a "2000+" ceiling (`ponytail:` upgrade path is a per-user daily rollup table). Returns `made` (reactions, comments, distinct posts engaged), `received` (reactions, comments, top posts with their permalinks) and `featured` (the member's posts with `featuredAt` inside the window), each with the same shape for the previous window so the page can show a delta. It also returns `plan` (`tier` and the three limits from `getPlanLimitsHelper`, so the contact tier gets its override), `posts` (the member's non-deleted, non-hidden posts added to the app in the window, from `posts.by_author` with `_creationTime >= since`, `.take(200)`: id, permalink, first 140 characters of `content`, `likeCount`, `commentCount`, `isFeatured`, `interactionLimitReached`), `nearCap` (the ids at 80% or more of the cap, step 7) and `nextTier` (step 8). The weekly and featured quotas come from the existing `getWeeklyUsage` and `getFeaturedUsage` on the client; no new query for them. Put the aggregation in a pure `summarizeInteractions(rows, since, until)` in `convex/lib/recap.ts` and unit-test it.
6. **Window semantics (brainstorm).** Rolling 7 and 30 days for the page (simple, always comparable). A calendar-month "Your August" belongs to an email digest, if one is ever built.
7. **`isNearInteractionLimit(likeCount, commentCount, cap)`** in `convex/lib/interactionLimit.ts`, next to `hasReachedInteractionLimit`: `likeCount + commentCount >= Math.ceil(cap * UPGRADE_NUDGE_RATIO)`, with `UPGRADE_NUDGE_RATIO = 0.8` exported from the same file as the only place the threshold lives. Starter fires at 20 of 25, Growth at 40 of 50, Pro at 160 of 200, contact at 80% of its override. Unit-test the boundaries (19, 20 and 25 on Starter).
8. **`nextTier(tier)`** beside `tierToRank` in `convex/lib/planLimits.ts`: starter to growth, growth to pro, pro to `contact`, contact to `null`. [[R08]]'s component calls the same function, so the ladder has one definition.

### C. Page and navigation

9. **`RecapPage.tsx` at `/recap`.** Blocks in this order: **Recap** (window toggle 7 days / 30 days; Made, Received and Featured posts in the window, each with the delta against the previous window; Received lists the top posts with their permalinks). **Plan usage** (not windowed): the weekly-posts pill ("1 of 1 this week") and the featured pill ("1 of 3 this month"; `isUnlimitedFeatured` (`convex/lib/postLimit.ts`) renders 9999 as "unlimited", the same rule as `MyPostsPage.tsx:173-177`), then one row per post in the window with a progress bar "18 of 25 interactions" toward `plan.interactionsPerPost`; a capped post shows a full bar and "left the feed". **Upgrade section** (conditional, part D). A footer that keeps the numbers honest: "Counts what you did in the app. Reactions and comments are completed by you on LinkedIn. The bar counts everything LinkedIn and this app recorded on the post." plus one link "See every interaction" to `/history` ([[R16]]). Never blank: the empty state names the feed as the next action ([[R05]]) and, while trialing, links the [[R06]] meter.
10. **Nav and ⌘K.** Add `{ path: '/recap', labelKey: 'nav.recap', icon: BarChart3 }` to the main group in `navItems.ts`; the palette picks it up. Add the route in `App.tsx` next to `/my-posts`.
11. **Retire the SSI link-out.** Remove the sidebar block (`Sidebar.tsx:61-67`) and `billing.ssiLink`; the recap page carries one line for Sales Navigator subscribers: "Have Sales Navigator? Your SSI is still at linkedin.com/sales/ssi."
12. **Landing copy** moves through [[R10]] (Proof card) and [[R14]] (FAQ): the proof is the recap, not the SSI page.
13. **Celebrate the period.** When the 7-day made count beats the previous week, one line of recognition at the top of the page; no confetti ([[R07]] tone).
14. **i18n and tests.** Keys `nav.recap`, `recap.*` in en, pt and es. Tests: `summarizeInteractions` (windows, previous-window delta, the 2000 ceiling); `isNearInteractionLimit` and `nextTier` boundaries; `RecapPage` with a mocked query (both windows, empty state, the sentinel, the section present at 20 of 25 on Starter and absent at 19 of 25, the Pro and contact variants); `navItems.test.ts` and `Sidebar.test.tsx` updates (entry present, SSI link gone); `generateComment` writes no `userInteractions` row.
15. **Docs.** See **Docs to update**.

### D. Upgrade section (80% of the cap)

16. **When and what.** Rendered only while `nearCap` is non-empty, inline, below the plan usage block. One sentence of loss with the live numbers for the fullest post, then one link: "Your post 'X' is at 20 of 25 interactions. On Growth it keeps collecting to 50." linking `/billing?plan=growth` (the [[R03]] deep-link; card holders, trialing or active, go to the switch path from [[R01]]). Reuse [[R08]]'s `UpgradeAtLimit` with the `interactionCap` limit and add a `nearCap` boolean prop for the "is at 20 of 25" wording; R08's own moment keeps "reached 25 and left the feed". A capped post (100%) is also in `nearCap`, so the section stays until the member upgrades or the window rolls past the post.
17. **The better tiers (Henriko, 2026-09-05).** Pro (`nextTier === 'contact'`): the sentence names the numbers ("at 160 of 200") and offers the Enterprise line, "Need more? Contact us for custom enterprise plans." (`billing.enterprise`), linking `mailto:${SUPPORT_EMAIL}` as `BillingPage.tsx:291-309` does. Contact tier (`nextTier === null`): "Your plan has custom limits. Email us to raise them." with the same mailto; the bar uses the per-user override cap. Neither tier ever sees a checkout link.
18. **No literals.** The threshold is the one constant; every cap and tier number in the copy comes from `plan` and `planLimits` at render time.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Count taps only.** A row exists when the member taps a reaction or taps Comment on a post. Nothing else moves a number (Henriko, 2026-09-05). Keep the honest footer on every state of the page.
- **Lead with what decays.** Top-left: this week's made count against last week's, with the delta; received below it. Rank by what the reader can still change and let the F-pattern do the rest ([@richardrx · 2026-07-27](https://x.com/richardrx/status/2081757132639097341), [@richardrx · 2025-12-16](https://x.com/richardrx/status/2000930776636940333)).
- **Attach meaning to each number.** "18 made, 6 more than last week" and "your post on X received 11" turn counts into information; a number without context is noise ([@richardrx · 2025-12-16](https://x.com/richardrx/status/2000930776636940333)). Round nothing; precise counts read as measured ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Answer "what do I do now?"** The empty and low states point at the feed, the trialing state at the [[R06]] meter; a dashboard that only reports is a mirror ([@richardrx · 2026-02-13](https://x.com/richardrx/status/2022255404743381289), [@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021)).
- **Show received next to the post that earned it**, with its permalink. That list is the member's return on effort, the "words helped" surface that keeps a subscription feeling worth it ([@richardrx · 2025-12-17](https://x.com/richardrx/status/2001408166404530231)).
- **Show the cap as a bar next to the post that is filling it**, with the precise numbers and the next tier's number in the same sentence: "20 of 25; on Growth it keeps collecting to 50." One value axis across tiers, and the loss at hand outconverts the gain promised ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981), [@richardrx · 2026-02-02](https://x.com/richardrx/status/2018357024543715480)).
- **Offer the next tier only when usage asks for it.** The section appears at 80% of the cap, inline, on a page the member chose to open; expansion is born of usage ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Send the top tiers to a human.** Pro gets the Enterprise contact line, the contact tier the custom-limit line; the ladder ends with a person, never with a link to the plan they already have ([[R08]]).
- **Let history accumulate.** The 30-day view is the vault the member would lose by leaving, the strongest of the five switching-cost levers this product can pull ([@richardrx · 2026-06-23](https://x.com/richardrx/status/2069382946214080985)). Keep it a personal archive, never a leaderboard.
- **Celebrate a better week with one line** at the top; the memory of the page is its peak ([@richardrx · 2026-04-04](https://x.com/richardrx/status/2040415841628651689)).
- **Keep the SSI mention to one factual line** for Sales Navigator subscribers (standing decision).

**Don't**

- **Don't count drafts.** No `ai_draft` kind, no counter on generation, no "drafts written" tile. A draft is a suggestion until the member taps Comment (decision, 2026-09-05).
- **Don't call the numbers "your LinkedIn engagement"** or show an SSI estimate. The app cannot observe LinkedIn, and a claim it cannot show becomes expectation debt at the first charge ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355)).
- **Don't show the upgrade section below 80% of the cap, and never as a modal, toast or email.** Below the threshold the page reports; at the threshold it answers. An upsell that interrupts breeds resistance ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Don't link Pro or contact users to a checkout.** A link to a plan the member already has reads as a bug; the mailto line is the whole upsell for them (decision, 2026-09-05).
- **Don't hardcode the 80% or any cap in copy.** The ratio is one constant, the caps come from `planLimits` and admins change them ([[R08]] rule).
- **Don't show the 9999 sentinel.** Render "unlimited" through `isUnlimitedFeatured` as My Posts does; never compare against a literal.
- **Don't let the cap bar and the received count look like the same number.** The bar counts LinkedIn-seeded plus in-app engagement toward the cap; received counts taps by members here. Label both, or the first support ticket is "your numbers disagree".
- **Don't build a gauge wall.** No charts for their own sake, no five KPIs above the one that matters; each extra indicator slows the scan and the decision ([@richardrx · 2025-11-04](https://x.com/richardrx/status/1985828780838097317), [@richardrx · 2026-07-10](https://x.com/richardrx/status/2075623473565647202)).
- **Don't ship a blank page for a new member.** The zero state names the feed as the next action, with one CTA ([@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021)).
- **Don't add streaks, leaderboards or variable-reward notifications** in this item. The slot-machine playbook has an honest counterpart, and choosing between them is a product decision for Henriko ([@richardrx · 2025-12-22](https://x.com/richardrx/status/2003106841199276221)).
- **Don't mix the trial counters and the recap** on one screen without labels; two counters with two meanings is the fastest route to a support ticket.
- **Don't feed the page from the Apify refresh** or any LinkedIn-side count for the made and received tiles; only the cap bar reads post totals, because that is what the cap counts.

## Acceptance criteria

- [ ] `/recap` shows made, received and featured counts for 7 and 30 days with a delta against the previous window. — made, received and the delta shipped; the **featured tile was dropped** (see Decisions).
- [x] Generating an AI draft changes no count; the Comment tap on the post records one comment made, once.
- [x] A post with reactions from two members shows two received reactions to its author.
- [x] The plan usage block shows the weekly and featured pills (9999 renders as "unlimited") and one bar per post in the window reading "n of cap".
- [x] A Starter post at 20 of 25 shows the upgrade section linking `/billing?plan=growth`; at 19 of 25 no section renders; a Growth post at 40 of 50 links `?plan=pro`.
- [x] A Pro post at 160 of 200 shows the Enterprise mailto line; a contact-tier post at 80% of its override shows the custom-limit line; neither shows a checkout link.
- [ ] A capped post shows a full bar, "left the feed" and the section. — the full bar and the `myPosts.interactionCapBadge` line ("Reached {{limit}} interactions and left the feed") ship; the upgrade section deliberately does **not** (see Decisions).
- [x] No UI string contains a literal 80, 25, 50 or 200; the numbers come from the query.
- [x] "Recap" appears in the sidebar and in the ⌘K quick actions; the SSI link-out is gone from the sidebar and the billing page; the footer links to `/history`.
- [x] Export includes the user's own rows; erasure removes the user's rows and the rows that point at the user as author.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Optimistic counts.** Every made or received number is an in-app tap, not a LinkedIn-confirmed action. The copy must never call it "your LinkedIn engagement"; the footer line is not optional.
- **Three counters, three meanings.** The trial counters count only while trialing; the recap counts taps made here; the cap bar counts the post's total engagement, LinkedIn-seeded plus in-app, because that is what `interactionLimitReached` reads. Label all three or show them apart.
- **Drafts stay out of every counter.** A draft that moved billing (the 50-interaction trial end) or another member's post cap would invite gaming on a 30-per-hour budget; the 2026-09-05 decision keeps `generateComment` free of counters. Do not reopen it in the brainstorm.
- **The 80% section is a nudge, not an interruption.** It lives on this page only. The moment it is pushed out as an email or a toast it becomes the interruption principle 8 warns against.
- **Seeded counts.** A post submitted with LinkedIn-seeded engagement already near the cap (submit rejects only at or above the cap, `posts.ts:335-343`) shows the section on its first visit. That is true and useful; keep it.
- **Contact overrides.** `getPlanLimitsHelper` returns the per-user row for contact users, and the admin modal edits only interactions and posts, so `featuredPerMonth` coalesces to 9999; the page must not assume the override is complete.
- **Ceiling.** The bounded reads are fine at launch volumes; the rollup table is the upgrade when a member passes 2000 log rows in a window.
- **Engagement refresh.** The Apify refresh (dev and local only) updates `posts.likeCount` from LinkedIn for all viewers; the cap bar moves with it by design, the made and received tiles never do.
- **Received rows on erasure.** When a member is erased, their rows on other people's posts disappear from those authors' received counts. Acceptable; document it.

## Docs to update

- `docs/PLATFORM.md` §5 (Data model, `userInteractions` and `userPostState`, `:632-651`) — `authorId`, `by_author`, atomic logging.
- `docs/PLATFORM.md` §9 (Plan Limits System) — `UPGRADE_NUDGE_RATIO`, `isNearInteractionLimit`, `nextTier`, and the member-facing usage block.
- `docs/PLATFORM.md` §11 (Feed & Engagement) — the log written inside the count mutations; the recap query and its `plan`, `posts`, `nearCap` fields.
- `docs/PLATFORM.md` §11A (AI Reaction & Comment Assistance) — generating a draft records nothing; only the Comment tap counts.
- `docs/PLATFORM.md` §11B (Search & Command Palette) — the new quick action.
- `docs/PLATFORM.md` §13B (Privacy & Compliance) — inventory, export scope (own rows only, received as counts), erasure drain by author.
- `docs/PLATFORM.md` §14 (RecapPage, Sidebar, navItems, BillingPage) — the page, the nav entry, the retired link-out, the Pro and contact upgrade paths.
- `docs/PLATFORM.md` §15 (Landing) — via [[R10]] and [[R14]].

## References

- Related: [[R01]], [[R03]], [[R05]], [[R06]], [[R07]], [[R08]], [[R10]], [[R14]], [[R16]], [[B26]].
- Prior art / plan: `docs/PLATFORM.md` §9 plan limits (`:1035-1108`) and §11 engagement actions table (`:1509-1510`); memory `linkedin-api-access-constraints` (no member API for comments or reactions; in-app record plus manual handoff).
- Principle sources: [@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514), [@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021), [@richardrx · 2026-04-04](https://x.com/richardrx/status/2040415841628651689), [@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691), [@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981).

## Decisions (2026-09-07)

- Cap bars show posts added in the window only. Featured tile and top-posts list dropped. `now` floored to the hour; current window open-ended. Only the Comment tap counts (no ai_draft kind). Recap CTA goes to /feed.
- **The recap keeps the newest 2000 rows per side and says so.** `RECAP_ROW_CEILING = 2000` (`convex/lib/recap.ts`) bounds each of the two indexed reads; when either side is truncated the query returns `truncated: true` and the page renders `recap.truncated` ("Showing your most recent {{count}} interactions.") rather than quietly under-reporting. The per-user daily rollup table stays the `ponytail:` upgrade path.
- **The recap footer holds the app's only SSI link** — the qualified Sales Navigator line (`recap.salesNav` + `linkedin.com/sales/ssi`). The sidebar link-out and `billing.ssiLink` are both gone, so item 11's retirement is complete and there is exactly one SSI mention left in the product.
- **`now` is client-supplied and floored to the hour** (`floorToHour`, shared by `RecapPage` and `CancelInterstitial`), so the window bounds are stable across re-renders and the query result caches; the current window is open-ended `[since, ∞)` rather than `[since, now)`.
- **Deferred in the implementation spec §10, so the two boxes above stay unticked:** the "Featured in window" tile and the "top received posts" list (both cut to keep the page to one scan — the Don't against a gauge wall), and backfilling `authorId` onto pre-2026-09-07 rows (pre-launch data is disposable).
- **A capped post is deliberately not "near" the cap.** `isNearInteractionLimit` is half-open — `ceil(cap × 0.8)` up to but not including the cap — and `pickNearCapPost` skips anything already flagged `interactionLimitReached`, so a spent post shows the full bar plus the "left the feed" badge while the single near-cap ask stays on the post that can still be saved. This diverges from item 16's "a capped post (100%) is also in `nearCap`": that state has its own copy on My Posts ([[R08]]), and one page carries one ask.
