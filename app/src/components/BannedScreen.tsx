import { signOut } from '../lib/session'
import BrandMark from '@/components/BrandMark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const SUPPORT_EMAIL = 'contact@email.com' // TODO: replace with the real support address

type Props = {
  reason?: string
}

export default function BannedScreen({ reason }: Props) {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />

        <div className="mb-3">
          <Badge variant="destructive">Account suspended</Badge>
        </div>

        <h1 className="text-foreground font-display text-2xl font-semibold">Your account has been suspended</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          An administrator has revoked your access to this app.
        </p>

        {reason && (
          <div className="border-destructive bg-destructive/10 text-destructive mt-4 rounded-r-md border-l-[3px] px-3 py-2 text-sm">
            <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Reason</span>
            <p className="mt-0.5">{reason}</p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button asChild>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              rel="noopener noreferrer"
            >
              Contact support
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
