import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { Button } from '@/components/ui/button'
import MarkdownView from './MarkdownView'
import Modal from './Modal'

type DismissRecord = { token?: string; motdId?: string }

function readDismissed(): DismissRecord | null {
  try {
    const raw = sessionStorage.getItem('motdDismissed')
    return raw ? (JSON.parse(raw) as DismissRecord) : null
  } catch {
    return null
  }
}

export default function Motd() {
  const { t, i18n } = useTranslation()
  const token = sessionStorage.getItem('sessionToken') ?? undefined
  const motd = useQuery(api.motd.motd.getActiveMotd, { sessionToken: token })
  // Tracks a dismiss performed during this mount (so the UI updates immediately on click).
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  if (!motd) return null

  const stored = readDismissed()
  const isDismissed = dismissedId === motd._id || (stored?.token === token && stored?.motdId === motd._id)
  if (isDismissed) return null

  const lang = (i18n.language || 'en').split('-')[0]
  const body = motd.bodies[lang] ?? motd.bodies.en ?? ''

  // Capture the narrowed id so the dismiss closure keeps `motd`'s non-null narrowing.
  const motdId = motd._id
  function dismiss() {
    if (token) sessionStorage.setItem('motdDismissed', JSON.stringify({ token, motdId }))
    setDismissedId(motdId)
  }

  if (motd.important) {
    return (
      <Modal
        onClose={dismiss}
        dismissOnBackdrop={false}
        dismissOnEscape={false}
        panelClassName="max-w-lg"
      >
        <div className="[&_a]:text-gold-text [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-semibold">
          <MarkdownView
            markdown={body}
            className="text-foreground text-sm leading-relaxed"
          />
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            onClick={dismiss}
          >
            {t('motd.ok')}
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <div className="border-border bg-accent text-accent-foreground w-full border-b px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-[640px] items-start gap-3">
        <div className="min-w-0 flex-1 [&_p]:m-0">
          <MarkdownView markdown={body} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('motd.dismiss')}
          onClick={dismiss}
          className="shrink-0"
        >
          ✕
        </Button>
      </div>
    </div>
  )
}
