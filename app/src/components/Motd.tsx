import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
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
        <div className="[&_a]:text-blue-600 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-semibold">
          <MarkdownView
            markdown={body}
            className="text-sm leading-relaxed text-slate-700"
          />
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t('motd.ok')}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <div className="w-full bg-blue-600 px-4 py-2 text-sm text-white">
      <div className="mx-auto flex max-w-[640px] items-start gap-3">
        <div className="min-w-0 flex-1 [&_p]:m-0">
          <MarkdownView markdown={body} />
        </div>
        <button
          type="button"
          aria-label={t('motd.dismiss')}
          onClick={dismiss}
          className="shrink-0 cursor-pointer rounded px-1 text-white/80 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
