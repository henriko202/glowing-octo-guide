import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  lead,
  className,
  children
}: {
  title: string
  lead?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h1 className="border-primary text-foreground inline-block border-b-2 pb-1 font-display text-3xl font-semibold text-balance">
          {title}
        </h1>
        {lead ? <p className="text-muted-foreground mt-2 text-sm">{lead}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}
