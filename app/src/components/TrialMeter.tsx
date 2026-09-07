import { useTranslation } from 'react-i18next'

// Shared shape of the `getTrialProgress` query result this component (and TrialProgressCard,
// which wraps it) render from. `trialEndsAt` is optional because a caller may not have it yet.
export interface TrialProgress {
  made: number
  received: number
  combined: number
  threshold: number
  nearThreshold: boolean
  trialEndsAt?: number
}

// The X/50 interaction bar. Pulled out of BillingPage so the shell (Sidebar, TopBar) can render
// the same meter where the taps actually happen, not only on the billing page.
export default function TrialMeter({ progress }: { progress: TrialProgress }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3">
      <p className="text-accent-foreground/80 mb-1.5 text-xs font-medium">
        {t('billing.trialProgress', {
          combined: progress.combined,
          threshold: progress.threshold
        })}
      </p>
      <div className="bg-accent-foreground/20 h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-2 rounded-full transition-[width]"
          style={{
            width: `${Math.min(100, Math.round((progress.combined / progress.threshold) * 100))}%`
          }}
        />
      </div>
    </div>
  )
}
