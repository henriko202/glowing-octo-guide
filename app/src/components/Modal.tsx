import { type ReactNode, useEffect } from 'react'

type Props = {
  onClose: () => void
  children: ReactNode
  panelClassName?: string
  dismissOnBackdrop?: boolean
  dismissOnEscape?: boolean
}

export default function Modal({
  onClose,
  children,
  panelClassName = 'max-w-sm',
  dismissOnBackdrop = true,
  dismissOnEscape = true
}: Props) {
  useEffect(() => {
    if (!dismissOnEscape) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissOnEscape])

  return (
    <div
      data-testid="modal-backdrop"
      onClick={dismissOnBackdrop ? onClose : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full ${panelClassName} bg-card rounded-xl p-5 shadow-2xl`}
      >
        {children}
      </div>
    </div>
  )
}
