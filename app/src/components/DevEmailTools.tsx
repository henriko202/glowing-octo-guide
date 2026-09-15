import { useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { api } from '../convex'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Dev-only email test tools. Rendered from App.tsx behind import.meta.env.DEV; the backend
// additionally refuses every call unless ALLOW_DEV_IMPERSONATION=true on the deployment.
const KINDS = [
  { kind: 'digest', label: 'Digest (real)' },
  { kind: 'digest_sample', label: 'Digest (sample)' },
  { kind: 'trial_near_end', label: 'Trial near end' },
  { kind: 'trial_converted', label: 'Trial converted' },
  { kind: 'post_cap', label: 'Post cap' },
  { kind: 'duplicate_canceled', label: 'Duplicate canceled' }
] as const

type EmailKind = (typeof KINDS)[number]['kind']

function EmailToolsPanel({ memberEmail, onClose }: { memberEmail: string | undefined; onClose: () => void }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const sendTestEmail = useAction(api.dev.sendTestEmail)
  const getUnsubscribeLink = useAction(api.dev.getUnsubscribeLink)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function send(kind: EmailKind) {
    setError(null)
    setStatus(null)
    setCopied(false)
    setBusy(kind)
    try {
      const result = await sendTestEmail({ sessionToken, kind, to: to.trim() || undefined })
      setStatus(`[${kind}] ${result.status}${result.detail ? ` — ${result.detail}` : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setBusy(null)
    }
  }

  async function copyLink() {
    setError(null)
    setStatus(null)
    setCopied(false)
    setBusy('link')
    try {
      const { url } = await getUnsubscribeLink({ sessionToken })
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setStatus(`[unsubscribe] copied ${url}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-background fixed right-5 bottom-[11.5rem] z-50 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-xl border shadow-xl">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <p className="text-sm font-semibold">DEV · Emails</p>
          <p className="text-muted-foreground text-xs">To: {memberEmail ?? 'no email on file'}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="border-b p-2">
        <Input
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder={memberEmail ?? 'recipient@example.com'}
          aria-label="To"
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-2">
        {KINDS.map(k => (
          <Button
            key={k.kind}
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void send(k.kind)}
          >
            {busy === k.kind ? 'Sending…' : k.label}
          </Button>
        ))}
      </div>

      <div className="border-t p-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={busy !== null}
          onClick={() => void copyLink()}
        >
          {busy === 'link' ? 'Copying…' : copied ? 'Copied' : 'Copy unsubscribe link'}
        </Button>
      </div>

      {status && <p className="text-muted-foreground border-t px-3 py-2 text-xs break-words">{status}</p>}
      {error && <p className="text-destructive border-t px-3 py-2 text-xs break-words">{error}</p>}
    </div>
  )
}

function EmailToolsPanelData({ onClose }: { onClose: () => void }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })
  return (
    <EmailToolsPanel
      memberEmail={me?.email}
      onClose={onClose}
    />
  )
}

export default function DevEmailTools() {
  const [open, setOpen] = useState(false)
  if (!import.meta.env.DEV) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="fixed right-5 bottom-36 z-50 rounded-full bg-amber-400 px-3 py-2 text-xs font-bold text-black shadow-lg hover:bg-amber-300"
      >
        DEV · Emails
      </button>
      {open && <EmailToolsPanelData onClose={() => setOpen(false)} />}
    </>
  )
}
