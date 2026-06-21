import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import MarkdownView from './MarkdownView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const SUPPORTED_LOCALES = ['en', 'pt', 'es'] as const
type Locale = (typeof SUPPORTED_LOCALES)[number]

type EditState = {
  id: Id<'motds'> | null // null = creating
  bodies: Record<string, string>
  important: boolean
  enabled: boolean
  startLocal: string
  expiresLocal: string
}

// epoch ms -> value for <input type="datetime-local"> (local wall-clock), and back.
function msToLocalInput(ms?: number): string {
  if (ms == null) return ''
  const d = new Date(ms)
  return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function localInputToMs(s: string): number | undefined {
  if (!s) return undefined
  const ms = new Date(s).getTime()
  return Number.isNaN(ms) ? undefined : ms
}

export default function MotdTab({ sessionToken, isAdmin }: { sessionToken?: string; isAdmin?: boolean }) {
  const motds = useQuery(api.motd.motd.listMotds, sessionToken && isAdmin ? { sessionToken } : 'skip')
  const createMotd = useMutation(api.motd.motd.createMotd)
  const updateMotd = useMutation(api.motd.motd.updateMotd)
  const deleteMotd = useMutation(api.motd.motd.deleteMotd)
  const toggleEnabled = useMutation(api.motd.motd.toggleMotdEnabled)

  const [edit, setEdit] = useState<EditState | null>(null)
  const [previewLocale, setPreviewLocale] = useState<Locale>('en')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startCreate() {
    setError(null)
    setEdit({
      id: null,
      bodies: { en: '', pt: '', es: '' },
      important: false,
      enabled: true,
      startLocal: '',
      expiresLocal: ''
    })
  }

  function startEdit(m: {
    _id: Id<'motds'>
    bodies: Record<string, string>
    important: boolean
    enabled: boolean
    startAt?: number
    expiresAt?: number
  }) {
    setError(null)
    setEdit({
      id: m._id,
      bodies: { en: m.bodies.en ?? '', pt: m.bodies.pt ?? '', es: m.bodies.es ?? '' },
      important: m.important,
      enabled: m.enabled,
      startLocal: msToLocalInput(m.startAt),
      expiresLocal: msToLocalInput(m.expiresAt)
    })
  }

  async function handleSave() {
    if (!sessionToken || !edit) return
    setSaving(true)
    setError(null)
    const payload = {
      sessionToken,
      bodies: edit.bodies,
      important: edit.important,
      enabled: edit.enabled,
      startAt: localInputToMs(edit.startLocal),
      expiresAt: localInputToMs(edit.expiresLocal)
    }
    try {
      if (edit.id) await updateMotd({ ...payload, motdId: edit.id })
      else await createMotd(payload)
      setEdit(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save MOTD')
    } finally {
      setSaving(false)
    }
  }

  if (motds === undefined) return <p className="text-muted-foreground text-sm">Loading…</p>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-foreground text-base font-semibold">Messages of the Day</h2>
        <Button onClick={startCreate}>New MOTD</Button>
      </div>

      {motds.length === 0 && <p className="text-muted-foreground text-sm">No MOTDs yet.</p>}

      <ul className="flex flex-col gap-2">
        {motds.map(m => (
          <li
            key={m._id}
            className="border-border bg-card rounded-lg border p-3"
          >
            <div className="flex items-center gap-2">
              {m.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}
              {m.important && <Badge variant="warning">Important</Badge>}
              <span className="text-muted-foreground ml-auto text-xs">
                {m.startAt ? `from ${new Date(m.startAt).toLocaleString()} ` : ''}
                {m.expiresAt ? `until ${new Date(m.expiresAt).toLocaleString()}` : ''}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{m.bodies.en}</p>
            <div className="mt-2 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit(m)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sessionToken && void toggleEnabled({ sessionToken, motdId: m._id, enabled: !m.enabled })}
              >
                {m.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => sessionToken && void deleteMotd({ sessionToken, motdId: m._id })}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {edit && (
        <div className="border-border bg-card mt-5 rounded-lg border p-4">
          <h3 className="text-foreground text-sm font-semibold">{edit.id ? 'Edit MOTD' : 'New MOTD'}</h3>

          {SUPPORTED_LOCALES.map(loc => (
            <label
              key={loc}
              className="mt-3 flex flex-col gap-1"
            >
              <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                {loc.toUpperCase()} {loc === 'en' ? '(required)' : '(optional)'}
              </span>
              <Textarea
                value={edit.bodies[loc] ?? ''}
                onChange={e => setEdit({ ...edit, bodies: { ...edit.bodies, [loc]: e.target.value } })}
                rows={loc === 'en' ? 5 : 3}
                placeholder="Markdown supported…"
                className="resize-none"
              />
            </label>
          ))}

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="text-foreground flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.important}
                onChange={e => setEdit({ ...edit, important: e.target.checked })}
                className="border-border rounded"
              />
              Important (blocking modal)
            </label>
            <label className="text-foreground flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.enabled}
                onChange={e => setEdit({ ...edit, enabled: e.target.checked })}
                className="border-border rounded"
              />
              Enabled
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="text-muted-foreground flex flex-col gap-1 text-xs">
              Start (optional)
              <input
                type="datetime-local"
                value={edit.startLocal}
                onChange={e => setEdit({ ...edit, startLocal: e.target.value })}
                className="border-border bg-card text-foreground rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <label className="text-muted-foreground flex flex-col gap-1 text-xs">
              Expiry (optional)
              <input
                type="datetime-local"
                value={edit.expiresLocal}
                onChange={e => setEdit({ ...edit, expiresLocal: e.target.value })}
                className="border-border bg-card text-foreground rounded-md border px-2 py-1 text-sm"
              />
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Preview</span>
              <select
                value={previewLocale}
                onChange={e => setPreviewLocale(e.target.value as Locale)}
                className="border-border bg-card text-foreground rounded border text-xs"
              >
                {SUPPORTED_LOCALES.map(l => (
                  <option
                    key={l}
                    value={l}
                  >
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="border-border bg-muted [&_a]:text-gold-text rounded-md border p-3 text-sm [&_a]:underline">
              <MarkdownView markdown={edit.bodies[previewLocale] || edit.bodies.en || ''} />
            </div>
          </div>

          {error && <p className="text-destructive mt-2 text-xs">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEdit(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
