// app/src/components/EmptyFeed.tsx
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import CardGateBanner from './CardGateBanner'

const CHECKLIST_STEPS = ['signedIn', 'firstPost', 'reactTwice'] as const

/** Scrolls to and focuses the composer's URL input by its stable id — no ref plumbing. */
function focusComposer() {
  const input = document.getElementById('post-url-input')
  input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  input?.focus()
}

/**
 * The unfiltered empty-feed state (backlog/R05). One headline, one action — never a menu — plus a
 * three-step activation checklist that starts above zero (signing in already counts as step 1).
 * A gated member whose own post is hidden sees the R04 `CardGateBanner` instead of the checklist:
 * one progress element per state, and the checklist never has to claim a gated member's post is
 * live, because it never renders in that case.
 */
export default function EmptyFeed({
  gated,
  hasOwnPost,
  made,
  trialStatus
}: {
  gated: boolean
  hasOwnPost: boolean
  made: number
  trialStatus?: string
}) {
  const { t } = useTranslation()
  const done = { signedIn: true, firstPost: hasOwnPost, reactTwice: made >= 2 }
  const doneCount = CHECKLIST_STEPS.filter(step => done[step]).length
  const allDone = doneCount === CHECKLIST_STEPS.length
  const showBanner = gated && hasOwnPost
  // trialInteractionsMade only increments while subscriptionStatus === 'trialing' (convex/
  // interactions.ts's bumpTrialInteraction) — outside a trial, `made` is a frozen snapshot that can
  // never reach 2 again once the member converted or lapsed — showing the checklist there would
  // present a permanently-stuck "react twice" step (F12). A member who has not started yet
  // (`none`) is the opposite case: every step is still ahead of them (spec §7.2), and the two
  // undone lines are the open loop that makes starting the trial worth it.
  const checklistReachable = trialStatus === 'trialing' || trialStatus === 'none'

  return (
    <div className="py-8 text-center">
      <h2 className="text-foreground mt-0 mb-2 text-lg font-semibold">{t('feed.emptyTitle')}</h2>
      {/* A member who already posted has nothing to "share first" — the body says whose posts fill the
          feed and the one action drops away (no second, weaker CTA takes its place). */}
      <p className="text-muted-foreground mb-4 text-sm">{t(hasOwnPost ? 'feed.emptyBodyPosted' : 'feed.emptyBody')}</p>
      {!hasOwnPost && (
        <Button
          type="button"
          onClick={focusComposer}
        >
          {t('feed.emptyCta')}
        </Button>
      )}

      {showBanner ? (
        <CardGateBanner className="mt-6 text-left" />
      ) : (
        checklistReachable &&
        !allDone && (
          <div
            data-testid="activation-checklist"
            className="border-border bg-card mx-auto mt-6 max-w-xs rounded-xl border p-4 text-left text-sm"
          >
            <p className="text-muted-foreground m-0 mb-2 text-xs font-medium tracking-wide uppercase">
              {t('feed.checklist.title')} · {doneCount} / {CHECKLIST_STEPS.length}
            </p>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {CHECKLIST_STEPS.map(step => (
                <li
                  key={step}
                  className={done[step] ? 'text-muted-foreground line-through' : 'text-foreground'}
                >
                  {t(`feed.checklist.${step}`)}
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  )
}
