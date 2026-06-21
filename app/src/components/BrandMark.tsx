import { Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
}

export default function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
        <LinkIcon
          className="size-4"
          aria-hidden="true"
        />
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
