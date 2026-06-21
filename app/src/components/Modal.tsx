import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Props = {
  onClose: () => void
  children: ReactNode
  panelClassName?: string
  dismissOnBackdrop?: boolean
  dismissOnEscape?: boolean
  /** Accessible name for screen readers — radix Dialog requires a title; rendered visually hidden. */
  title?: string
}

export default function Modal({
  onClose,
  children,
  panelClassName = '',
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  title = 'Dialog'
}: Props) {
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn('block', panelClassName)}
        onEscapeKeyDown={dismissOnEscape ? undefined : e => e.preventDefault()}
        onInteractOutside={dismissOnBackdrop ? undefined : e => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}
