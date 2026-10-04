import { TRIAL_PLAN } from '../../../convex/lib/trialMilestone'

const PLAN_IDS = ['starter', 'growth', 'pro'] as const

export type PlanId = (typeof PLAN_IDS)[number]

export function isPlanId(p: string | null): p is PlanId {
  return !!p && (PLAN_IDS as readonly string[]).includes(p)
}

export { PLAN_IDS }

/**
 * The plan a card-gate CTA should land on. The visitor already chose a plan on the landing page; it
 * arrives either as ?plan= or in the sessionStorage stash written by AuthSuccessPage. Growth is the
 * cold-arrival fallback and the recommended plan.
 */
export function resolveTargetPlan(searchParams: URLSearchParams | null): PlanId {
  const param = searchParams?.get('plan') ?? null
  const stashed = sessionStorage.getItem('chosenPlan')
  return isPlanId(param) ? param : isPlanId(stashed) ? stashed : 'growth'
}

/**
 * The plan the card gate sells. Only Pro has a trial (2026-10-03), so a member who can still trial
 * is offered Pro's; one who can't is sent to subscribe to the plan they chose, as before.
 */
export function gatePlan(searchParams: URLSearchParams | null, canTrial: boolean): PlanId {
  return canTrial ? TRIAL_PLAN : resolveTargetPlan(searchParams)
}
