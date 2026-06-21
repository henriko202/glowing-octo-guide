import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground',
      success: 'bg-success text-success-foreground',
      warning: 'bg-accent text-accent-foreground',
      destructive: 'bg-destructive/10 text-destructive',
      outline: 'border border-border text-foreground'
    }
  },
  defaultVariants: { variant: 'default' }
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
