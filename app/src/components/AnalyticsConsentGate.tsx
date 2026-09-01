import { useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import { syncAnalyticsConsent } from '../lib/observability/analytics'

type ConsentMap = { analytics?: boolean; marketing?: boolean } | null | undefined

// Drives PostHog capture on/off from the signed-in user's live `analytics` consent. Renders nothing;
// mounted only inside the authenticated shell, where `userId` is known. Reacts to consent changes
// (e.g. the user toggling analytics off in Settings) without a reload.
export default function AnalyticsConsentGate({ userId, sessionToken }: { userId: string; sessionToken?: string }) {
  const consents = useQuery(api.privacy.consent.getConsents, sessionToken ? { sessionToken } : 'skip') as ConsentMap

  useEffect(() => {
    syncAnalyticsConsent(userId, consents)
  }, [userId, consents])

  return null
}
