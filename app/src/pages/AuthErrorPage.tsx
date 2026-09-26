import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import BrandMark from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { LANDING_URL } from '../lib/session'

// Where every failed sign-in lands (the OAuth callback and AuthSuccessPage send members here). The route sits
// outside RequireAuth on purpose: that guard starts a new sign-in on its own, which bounced a member who had just
// canceled straight back to LinkedIn. Retrying is the member's choice here.
export default function AuthErrorPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const denied = searchParams.get('reason') === 'denied'

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">
          {denied ? t('auth.error.deniedTitle') : t('auth.error.failedTitle')}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {denied ? t('auth.error.deniedBody') : t('auth.error.failedBody')}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            asChild
            className="w-full"
          >
            <Link to="/auth/start">{t('auth.error.tryAgain')}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full"
          >
            <a href={LANDING_URL}>{t('auth.error.backToSite')}</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
