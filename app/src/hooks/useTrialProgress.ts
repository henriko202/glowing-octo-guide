import { useQuery } from 'convex/react'
import { api } from '../convex'
import { useCardGate } from './useCardGate'

// Shared by Sidebar and TopBar (R06): wraps useCardGate() with the getTrialProgress subscription
// both call sites need alongside it. Skipped unless trialing — that's the only state that renders
// a meter, so there's nothing to pay for otherwise.
export function useTrialProgress() {
  const cardGate = useCardGate()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const progress = useQuery(api.users.getTrialProgress, cardGate.isTrialing && sessionToken ? { sessionToken } : 'skip')
  return { ...cardGate, progress }
}
