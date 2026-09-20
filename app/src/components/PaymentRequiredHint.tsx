// app/src/components/PaymentRequiredHint.tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

/**
 * The `past_due` composer hint: what happened, and the one link that fixes it. Shared by the feed
 * and My Posts composers so the two cannot drift — the server side is `assertCanSubmitPost` in
 * convex/lib/access.ts.
 */
export default function PaymentRequiredHint() {
  const { t } = useTranslation()
  return (
    <>
      {t('feed.cardGateBodyPastDue')}{' '}
      <Link
        to="/billing"
        className="underline"
      >
        {t('feed.cardGatePastDueCta')}
      </Link>
    </>
  )
}
