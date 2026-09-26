# R05 — Never ship a blank feed

> **Status:** DONE · **Priority:** P2 · **Effort:** S · **Category:** Onboarding / Frontend / Launch ops
> **Depends on:** [[R04]] (feed-first routing and the hidden-post banner) · **Blocks:** none

## Principle

**Never ship a blank dashboard.** An empty first screen is the moment the user decides the product
has nothing for them. Richard's fixes: give the empty state one action, start the progress bar
above zero (the Zeigarnik effect needs an open loop, not an empty one), and cut time to value by
making the first visit look alive.
Sources: [never ship a blank dashboard](https://x.com/richardrx/status/2054283657934758021),
[the empty state is the first impression](https://x.com/richardrx/status/1991470970587042014),
[cut time to value](https://x.com/richardrx/status/2037583944283996418).

## Summary

A new member who signs up before the feed has posts sees one sentence: "No posts yet. Invite
colleagues to join Link Into The SSI!" There is no invite feature, no CTA, and the composer that
would fill the feed sits right above the sentence without being named. Their own first post is
hidden until a card exists, so even a user who posted sees nothing of their own. Trial progress
starts at 0 of 50 and nothing they did so far counts.

## Evidence

- `app/src/pages/FeedPage.tsx:129-133` — the empty state is a single paragraph, `feed.emptyFiltered` or `feed.empty`, with no action.
- `app/src/i18n/locales/en.json:39` — "No posts yet. Invite colleagues to join Link Into The SSI!". No file under `app/src` or `convex` implements an invite or referral (grep for `invite` and `referral`, 2026-09-05).
- `app/src/pages/FeedPage.tsx:119` — the `PostComposer` renders above the empty state; the copy does not point at it.
- `convex/lib/access.ts:28-31` — a `none` user's first post is created hidden, so their feed shows nothing of theirs.
- `convex/users.ts:188-196` — trial progress counts interactions only; the first post moves nothing.
- `convex/seed.ts` — a DEV-ONLY seed with real embeddable posts; production starts empty. Apify enrichment is dev and local only (memory `apify-dormant-compliance-gate`), so a live feed depends on real submissions.
- `app/src/i18n/locales/en.json:46` — the Pro-filter empty state already offers a recovery ("Adjust it or clear it"); keep it.

## Root cause

The feed was built and tested against seeded data. Nobody designed the state where a real first
cohort arrives before the feed exists, and the "invite colleagues" line was placeholder copy that
outlived the idea.

## What we need to do

1. **Give the empty state one action.** Replace the paragraph in `FeedPage.tsx:129-133` with an `EmptyFeed` block: a headline ("Your feed fills as members post"), one line of body, and a primary button that scrolls to and focuses the composer ("Share your first post"). When the user is gated and already has a hidden post, show the [[R04]] banner copy instead ("Your post is saved. Start your trial to put it in the feed.").
2. **Start progress above zero.** Render a three-step activation checklist inside the empty state for users with `combined === 0` (from `getTrialProgress`): signed in with LinkedIn (always done), shared a first post (done when `getMyPosts` returns one), reacted to two posts (done when `made >= 2`). The bar starts at 1 of 3. Hide it once every step is done. This is the only progress element on an empty feed; [[R06]]'s meter takes over once the feed has posts.
3. **Delete the invite line.** Remove `feed.empty` from en, pt and es (the locale parity test enforces this). If Henriko wants an invite link later, file it as its own backlog item; it is a growth feature, not an empty state. **Decided 2026-09-06: the invite stays as a feature — it is [[R19]] (invite a peer), never a line in the empty state.**
4. **⚖️ Seed launch with real posts. DECIDED 2026-09-06:** three or four of Henriko's own contacts load posts through the normal composer before sign-ups open, so the launch feed is never empty. The `EmptyFeed` block and its checklist stay in the code as a safety net, not a launch state; this also closes the spec §7.2 question (checklist for `combined === 0` vs the shipped `trialing | none` status gate) — moot for a feed that is never empty, the status gate stands as built. The dev seed must stay out of production. The launch checklist line exists (`docs/PLATFORM.md` §21, "Minimum live posts in feed", [[B25]]).
5. **i18n.** Keys `feed.emptyTitle`, `feed.emptyBody`, `feed.emptyCta`, `feed.checklist.signedIn`, `feed.checklist.firstPost`, `feed.checklist.reactTwice`, `feed.checklist.title` in en, pt and es.
6. **Tests.** `FeedPage.test.tsx`: empty feed renders the CTA and focuses the composer; checklist states follow the mocked queries; gated user with a hidden post sees the banner variant.
7. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **One action, never a menu.** The empty feed points at the composer and nothing else; the fixes for a blank dashboard start with a single next step ([@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021)).
- **Start the checklist above zero.** Signed in is done, so the bar opens at 1 of 3; LinkedIn's profile bar gets 88% completion from the same move ([@richardrx · 2025-11-17](https://x.com/richardrx/status/1990429269487386865), [@richardrx · 2026-03-24](https://x.com/richardrx/status/2036461688505909250)).
- **Every checklist item moves toward value.** Post, react, react again; nothing administrative like "complete your profile" ([@richardrx · 2026-02-04](https://x.com/richardrx/status/2019019293761941566)).
- **Seed the launch with real people through the normal composer.** Goldman's shopping cart won on visible normal usage by real users, never on a better cart ([@richardrx · 2025-12-23](https://x.com/richardrx/status/2003441529621270862)).
- **Design the one-result state.** A feed with a single post must not look broken inside a layout built for twenty ([@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553)).
- **Keep the "first post" item honest for gated users**: saved, waiting for the trial, never "live".
- **Order the items by what is doable now.** With an empty feed, "react to two posts" comes after the post, or waits for the feed to fill.

**Don't**

- **Don't render placeholder posts, invented counts or "3 people reacted".** Fabricated activity is fabricated proof; it wins one session and loses the next ten ([@richardrx · 2026-01-02](https://x.com/richardrx/status/2007100585464439150)).
- **Don't use sample data as the destination.** The sample-data pattern sells a dream on a dashboard; here the destination is other members' real posts, so seed with people, never fixtures ([@richardrx · 2026-02-04](https://x.com/richardrx/status/2019019293761941566)).
- **Don't keep the "invite colleagues" line.** A CTA to a feature that does not exist is a dead click ([@richardrx · 2026-07-22](https://x.com/richardrx/status/2079900733957136737)).
- **Don't stack the checklist, the [[R06]] meter and the [[R04]] banner** on one screen; one progress element per state.
- **Don't open with a tour or a welcome video.** Understanding comes from doing; the video welcomes, it does not teach ([@richardrx · 2026-04-22](https://x.com/richardrx/status/2046959126245249288), [@richardrx · 2026-06-19](https://x.com/richardrx/status/2067987722954735812)).
- **Don't ship the dev seed to production.** The launch seed is real members' posts; the dev seed exists for local work only.

## Acceptance criteria

- [x] An empty feed shows a headline, one CTA that leads to the composer, and the checklist.
- [x] The checklist starts at 1 of 3 and disappears once complete.
- [x] No copy anywhere references an invite feature.
- [x] The launch checklist names the minimum live posts before sign-ups open.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **No fake activity.** Never render placeholder posts or invented counts ("3 people reacted"); the empty state must be honest. Real seeding is the fix.
- **Crowding.** A new user could face the checklist, the [[R06]] meter and the [[R04]] banner at once. Rule: one progress element per state (empty feed → checklist; live feed while trialing → meter).
- **Hidden post is not "in the feed".** The checklist marks "shared a first post" as done, but the copy must not claim the post is live for a gated user.
- **Cold-start beyond launch.** Pro users with a narrow filter can still see an empty view; that state keeps its own copy.

## Docs to update

- `docs/PLATFORM.md` §14 (FeedPage) — the empty state, the checklist and its data sources.
- `docs/PLATFORM.md` §21 (Deployment) or the launch checklist item — minimum live posts before opening sign-ups.

## References

- Related: [[R04]], [[R06]], [[B25]].
- Prior art / plan: `convex/seed.ts` (dev seed), memory `apify-dormant-compliance-gate`.
- Principle sources: [@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021), [@richardrx · 2025-11-20](https://x.com/richardrx/status/1991470970587042014), [@richardrx · 2026-03-27](https://x.com/richardrx/status/2037583944283996418).
