import { type ReactNode, useEffect } from 'react'

type Props = {
  onClose: () => void
  children: ReactNode
  panelClassName?: string
}

export default function Modal({ onClose, children, panelClassName = 'max-w-sm' }: Props) {
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
        className={`w-full ${panelClassName} rounded-xl bg-white p-5 shadow-2xl`}
      >
        {children}
      </div>
    </div>
  )
}
