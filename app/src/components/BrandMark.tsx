import { cn } from '@/lib/utils'
import LogoMark from '@/components/LogoMark'

interface BrandMarkProps {
  className?: string
}

export default function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
        <LogoMark className="h-[15px] w-2.5" />
      </span>
      <span
        className="font-display text-base font-semibold"
        translate="no"
      >
        Link Into The SSI
      </span>
    </div>
  )
}
