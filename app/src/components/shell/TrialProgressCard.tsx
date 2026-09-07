import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TrialMeter, { type TrialProgress } from '@/components/TrialMeter'

// Puts the R06 trial meter where the taps happen: above the nav, visible on every page while
// trialing. Mirrors the amber near-threshold state already used on the billing page banner.
export default function TrialProgressCard({ progress, tier }: { progress: TrialProgress; tier: string }) {
  const { t, i18n } = useTranslation()
  const planName = t(`billing.plans.${tier}.name`)
  const goalText = progress.trialEndsAt
    ? t('shell.trialGoal', {
        plan: planName,
        threshold: progress.threshold,
        date: new Date(progress.trialEndsAt).toLocaleDateString(i18n.language)
      })
    : t('shell.trialGoalNoDate', { plan: planName, threshold: progress.threshold })

  return (
    <div
      data-testid="trial-progress-card"
      data-near={String(progress.nearThreshold)}
      className={`mb-3 rounded-xl border p-3 text-xs ${
        progress.nearThreshold
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border bg-accent text-accent-foreground'
      }`}
    >
      <TrialMeter progress={progress} />
      <p className="mt-2 mb-0">{goalText}</p>
      <p className="text-accent-foreground/70 mt-1 mb-0">
        {t('shell.trialMadeReceived', { made: progress.made, received: progress.received })}
      </p>
      {progress.nearThreshold && (
        <p className="mt-1 mb-0">
          {t('shell.trialNearEnd', { remaining: Math.max(0, progress.threshold - progress.combined), plan: planName })}{' '}
          <Link
            to="/billing"
            className="underline"
          >
            {t('nav.billing')}
          </Link>
        </p>
      )}
    </div>
  )
}
