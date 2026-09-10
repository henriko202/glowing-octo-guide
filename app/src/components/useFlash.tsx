import { useCallback, useEffect, useRef, useState } from 'react'

// Lightweight inline feedback used by the admin sync actions. The app has no toast layer, so
// this matches the existing inline-feedback convention (e.g. the "Last sync" line): a transient
// banner that auto-dismisses. Shared between AdminPage (Settings) and UsersTab so both read alike.

export type FlashKind = 'success' | 'error'
export type FlashState = { kind: FlashKind; msg: string } | null

const AUTO_DISMISS_MS = 4000

export function useFlash() {
  const [flash, setFlash] = useState<FlashState>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const clearFlash = useCallback(() => {
    clearTimer()
    setFlash(null)
  }, [])

  const showFlash = useCallback((kind: FlashKind, msg: string) => {
    clearTimer()
    setFlash({ kind, msg })
    timer.current = setTimeout(() => setFlash(null), AUTO_DISMISS_MS)
  }, [])

  // Clear the pending timeout if the component unmounts mid-flash.
  useEffect(() => clearTimer, [])

  return { flash, showFlash, clearFlash }
}

export function Flash({ flash, onDismiss }: { flash: FlashState; onDismiss: () => void }) {
  if (!flash) return null
  const isError = flash.kind === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        isError
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'bg-success text-success-foreground border-[color:var(--success-foreground)]/30'
      }`}
    >
      <span>{flash.msg}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`shrink-0 leading-none ${isError ? 'text-destructive/70 hover:text-destructive' : 'text-success-foreground/70 hover:text-success-foreground'}`}
      >
        ✕
      </button>
    </div>
  )
}
