import { type ReactNode, useEffect } from 'react'

type Props = {
  onClose: () => void
  children: ReactNode
}

export default function Modal({ onClose, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      data-testid="modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl"
      >
        {children}
      </div>
    </div>
  )
}
