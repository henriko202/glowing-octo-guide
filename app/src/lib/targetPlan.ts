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
