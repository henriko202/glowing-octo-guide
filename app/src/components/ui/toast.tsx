import { useEffect, useState } from 'react'

// Minimal toast: transient bottom-center notifications. A module-level pub/sub lets any code call
// `toast('…')` without threading a hook or context through event handlers (sonner-style API), so we
// don't pull in a toast dependency for a couple of one-line handoff messages.
// ponytail: one <Toaster/> mounted at the app root; auto-dismiss only — no stacking limit, swipe,
// or queueing. Reach for `sonner` if those become real requirements.
type ToastItem = { id: number; message: string; onClick?: () => void }

let counter = 0
const listeners = new Set<(t: ToastItem) => void>()

export function toast(message: string, options?: { onClick?: () => void }): void {
  const item = { id: ++counter, message, onClick: options?.onClick }
  listeners.forEach(l => l(item))
}

export function Toaster({ duration = 4000 }: { duration?: number }) {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const onToast = (item: ToastItem) => {
      setItems(prev => [...prev, item])
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), duration)
    }
    listeners.add(onToast)
    return () => {
      listeners.delete(onToast)
    }
  }, [duration])

  // The live region is always mounted (even when empty) so assistive tech announces new toasts.
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {items.map(item =>
        item.onClick ? (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="border-border bg-card text-foreground pointer-events-auto max-w-sm cursor-pointer rounded-lg border px-4 py-2.5 text-sm shadow-lg"
          >
            {item.message}
          </button>
        ) : (
          <div
            key={item.id}
            className="border-border bg-card text-foreground pointer-events-auto max-w-sm rounded-lg border px-4 py-2.5 text-sm shadow-lg"
          >
            {item.message}
          </div>
        )
      )}
    </div>
  )
}
