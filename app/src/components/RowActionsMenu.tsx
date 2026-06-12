import { useEffect, useRef, useState } from 'react'

export type RowAction = {
  label: string
  onClick: () => void
  danger?: boolean
}

type Props = {
  label: string
  items: RowAction[]
}

export default function RowActionsMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(o => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
      >
        <span className="text-base leading-none tracking-widest">···</span>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                item.danger ? 'text-red-600' : 'text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
