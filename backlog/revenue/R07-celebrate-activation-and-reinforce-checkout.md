# R07 — Celebrate activation and reinforce the checkout

> **Status:** DONE · **Priority:** P2 · **Effort:** S · **Category:** Frontend / Billing UX
> **Depends on:** none ([[R04]] gives it a stronger next action) · **Blocks:** none

## Principle

**Celebrate the activation moment instead of confirming it, and reinforce the decision the user
just made.** The peak-end rule says people remember the peak and the end of an experience; a
checkout that returns to an unchanged billing page has no peak. Choice-supportive bias says the
seconds after a decision are when the user is most open to hearing why it was right. Zeigarnik
says hand them the next open loop.
Sources: [celebrate the activation moment](https://x.com/richardrx/status/2040415841628651689),
[reinforce the decision the user just made](https://x.com/richardrx/status/2049392897598849333).

## Summary

Stripe sends the user back to `/billing?success=true`, and the page ignores the parameter. The
user lands on the same plan grid they left, with no confirmation, no "your post is now live", and
no next step. The moment the webhook reveals the user's hidden first post is the best proof the
product has, and nobody points at it.

## Evidence

- `convex/billingNode.ts:49` — `success_url: ${appUrl}/billing?success=true`.
- `app/src/pages/BillingPage.tsx` — no `useSearchParams` and no reference to `success` (grep, 2026-09-05). The page
  renders identically after checkout.
- `convex/stripe.ts:87` — on sync to a card-backed status the user's hidden posts are revealed
  (`unhideHidden: canEngage(status)`), so the first post goes live right after checkout.
- `convex/http.ts:139-149` — the `customer.subscription.created` webhook is what flips the status; it can land a moment
  after the redirect.
- `app/src/pages/BillingPage.tsx:8` — the `toast` utility is imported; the shadcn `Dialog` ([[B18]]) is available for a
  modal.
- `app/src/i18n/locales/en.json` — no `billing.checkoutSuccess*` keys (grep, 2026-09-05).

## Root cause

The success URL was set for Stripe's sake in Plan 2A. Nobody owned the return moment.

## What we need to do

1. **Read and strip the parameter.** In `BillingPage.tsx` use `useSearchParams`; when `success=true` is present, set a
   `justSubscribed` state and call `setSearchParams({}, { replace: true })` so a refresh does not repeat the
   celebration.
2. **Wait for the webhook.** While `justSubscribed` and `me.subscriptionStatus` is still `none`, show an inline
   "Activating your trial…" state. `getMe` is reactive, so the view updates when the webhook lands. Time out after about
   20 seconds into a neutral "Your payment went through; your plan will show here shortly" with the Manage button
   visible.
3. **Celebrate once the status flips.** Open `CheckoutSuccessDialog`: title "You're in.", body "Your {{plan}} trial is
   live." plus "Your first post is now in the feed." when the user had a hidden post (reuse the detection from [[R04]]
   step 2). One primary CTA "Go to the feed" (`/feed`), one secondary "Stay on billing".
4. **Reinforce the choice.** One line under the title restating the plan's benefit from
   `billing.plans.<id>.description`, for example "Growth: a targeted feed for faster results." No upsell here.
5. **Measure.** A consent-gated PostHog event `checkout_success_viewed` with the plan id.
6. **i18n.** Keys `billing.successTitle`, `billing.successBody`, `billing.successPostLive`, `billing.successCta`,
   `billing.successStay`, `billing.activating`, `billing.activatingTimeout` in en, pt and es.
7. **Tests.** `BillingPage.test.tsx`: `?success=true` with status `trialing` opens the dialog and strips the param; with
   status `none` shows the activating state; a plain visit shows nothing new.
8. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Engineer the peak when the effort clears.** The dialog opens when the subscription status flips, never on the
  redirect; Stripe's first-payment graph works because it lands right after the user finished the work
  ([@richardrx · 2026-04-04](https://x.com/richardrx/status/2040415841628651689)).
- **Show progress, never a receipt.** "Your first post is now in the feed" is the rising graph; motion and
  accomplishment create the memory, a confirmation number does not
  ([@richardrx · 2026-04-04](https://x.com/richardrx/status/2040415841628651689)).
- **Reinforce the decision with one line from the plan's own description.** The seconds after paying are when the
  buyer wants to hear they chose right; the welcome email is the second touch
  ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049392897598849333)).
- **Hand them the next open loop**: one primary CTA to the feed
  ([@richardrx · 2025-11-17](https://x.com/richardrx/status/1990429269487386865)).
- **Design the waiting and failure states with the same care.** "Activating your trial…" and the timeout copy are
  moments you control ([@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553)).
- **Write Henriko's sentence in the user's words.** Keep the two outcomes (a real LinkedIn presence, the next role),
  one per sentence, plain verbs; a message that is easy to read is judged truer
  ([@richardrx · 2026-04-08](https://x.com/richardrx/status/2041829519611371727)). A draft: "You're in. Your Growth
  trial is live and your first post is in the feed. Every reaction and comment from here on counts toward the
  presence you came for."
- **Allow one small deliberate oddity** if it is cheap and off the critical path
  ([@richardrx · 2026-01-14](https://x.com/richardrx/status/2011387621264572720)).

**Don't**

- **Don't upsell in the celebration.** The upgrade belongs at the limit ([[R08]]); an upsell that interrupts breeds
  resistance ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Don't repeat the celebration on refresh.** Strip the param.
- **Don't add a confetti library or a multi-step tour.** The peak is one screen, then the product; the video
  welcomes, it does not teach ([@richardrx · 2026-06-19](https://x.com/richardrx/status/2067987722954735812)).
- **Don't blame the user in the timeout copy or mention webhooks.** Say the payment went through and the plan will
  show shortly ([@richardrx · 2026-03-24](https://x.com/richardrx/status/2036374984206025082)).
- **Don't ship "Congratulations! You're one step closer to that dream job, or creating a real LinkedIn presence!
  Whichever you may prefer. Your future is in your hands." as written.** Three exclamation marks, a hedge and a
  pull-quote ending; keep the outcomes, cut the rest (stop-slop).
- **Don't celebrate with a number the user cannot verify** ("Join 1,000 members"); no fabricated proof (standing
  decision).

## Acceptance criteria

- [x] Returning from a successful test-mode checkout shows the celebration once, then never again on refresh.
- [x] The celebration waits for the webhook and times out gracefully if it never arrives.
- [x] The primary CTA leads to the feed.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Failed webhook.** If the webhook never lands, the user has paid and sees `none`. The timeout copy must not blame the
  user; log the case (Sentry) so it can be fixed by hand.
- **Cancelled checkout** returns to `/billing` without the parameter; nothing should change there.
- **Enterprise** uses a mailto and never hits this path.
- **Tone.** Keep it to one screen, no confetti library; a dialog and one sentence are enough for the peak.
- Henriko's note: Maybe something like "Congratulations! You're one step closer to that dream job, or creating a real
  LikedIn presence! Whichever you may prefer. Your future is in your hands." Use /revenue-centric-design and /stop-slop
  to guide this phrase.

## Docs to update

- `docs/PLATFORM.md` §14 (BillingPage states) — the success and activating states.
- `docs/PLATFORM.md` §8 (Checkout flow diagram) — the return leg now has a client-side state.

## References

- Related: [[R04]], [[R06]], [[B05]] (error monitoring for the failed-webhook case), [[B18]] (Dialog pattern).
- Prior art / plan: `docs/superpowers/plans/2026-06-20-plan-2a-billing-checkout.md`.
- Principle
  sources: [@richardrx · 2026-04-04](https://x.com/richardrx/status/2040415841628651689), [@richardrx · 2026-04-29](https://x.com/richardrx/status/2049392897598849333).
