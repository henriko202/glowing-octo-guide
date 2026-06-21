// The trial converts (Stripe trial ends early) at this many combined interactions
// (made + received). The 7-day side of "50 OR 7 days" is Stripe's own trial_period_days.
export const TRIAL_INTERACTION_THRESHOLD = 50

// True only on the increment that first reaches the threshold, so endTrialEarly fires once.
export function crossesThreshold(current: number, delta: number, threshold = TRIAL_INTERACTION_THRESHOLD): boolean {
  return current < threshold && current + delta >= threshold
}
