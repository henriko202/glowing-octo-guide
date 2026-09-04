import { useTranslation } from 'react-i18next'
import { signOut } from '../lib/session'
import { SUPPORT_EMAIL } from '../lib/support'
import BrandMark from '@/components/BrandMark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Props = {
  reason?: string
}

export default function BannedScreen({ reason }: Props) {
  const { t } = useTranslation()
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />

        <div className="mb-3">
          <Badge variant="destructive">{t('bannedScreen.badge')}</Badge>
        </div>

        <h1 className="text-foreground font-display text-2xl font-semibold">{t('bannedScreen.heading')}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('bannedScreen.body')}</p>

        {reason && (
          <div className="border-destructive bg-destructive/10 text-destructive mt-4 rounded-r-md border-l-[3px] px-3 py-2 text-sm">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
              {t('bannedScreen.reasonLabel')}
            </span>
            <p className="mt-0.5">{reason}</p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button asChild>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              rel="noopener noreferrer"
            >
              {t('bannedScreen.contactSupport')}
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={signOut}
          >
            {t('nav.signOut')}
          </Button>
        </div>
      </div>
    </div>
  )
}
