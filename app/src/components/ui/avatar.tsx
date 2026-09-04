import { cn } from '@/lib/utils'

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

const SIZES = {
  sm: { cls: 'size-8 text-xs', px: 32 },
  md: { cls: 'size-10 text-sm', px: 40 },
  lg: { cls: 'size-12 text-base', px: 48 }
} as const

export function Avatar({
  name,
  src,
  size = 'md',
  className
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const { cls, px } = SIZES[size]
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        // Profile pics are LinkedIn/Apify-hosted URLs — don't leak the app URL (referer) to that host.
        referrerPolicy="no-referrer"
        className={cn('rounded-full object-cover', cls, className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-accent text-accent-foreground inline-flex items-center justify-center rounded-full font-semibold',
        cls,
        className
      )}
    >
      {getInitials(name)}
    </span>
  )
}
