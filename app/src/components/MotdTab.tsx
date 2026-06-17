import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import MarkdownView from './MarkdownView'

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

  if (motds === undefined) return <p className="text-sm text-slate-500">Loading…</p>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Messages of the Day</h2>
        <button
          onClick={startCreate}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          New MOTD
        </button>
      </div>

      {motds.length === 0 && <p className="text-sm text-slate-500">No MOTDs yet.</p>}

      <ul className="flex flex-col gap-2">
        {motds.map(m => (
          <li
            key={m._id}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
              >
                {m.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {m.important && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Important
                </span>
              )}
              <span className="ml-auto text-xs text-slate-400">
                {m.startAt ? `from ${new Date(m.startAt).toLocaleString()} ` : ''}
                {m.expiresAt ? `until ${new Date(m.expiresAt).toLocaleString()}` : ''}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{m.bodies.en}</p>
            <div className="mt-2 flex gap-3">
              <button
                onClick={() => startEdit(m)}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => sessionToken && void toggleEnabled({ sessionToken, motdId: m._id, enabled: !m.enabled })}
                className="text-xs font-semibold text-slate-600 hover:underline"
              >
                {m.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => sessionToken && void deleteMotd({ sessionToken, motdId: m._id })}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {edit && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">{edit.id ? 'Edit MOTD' : 'New MOTD'}</h3>

          {SUPPORTED_LOCALES.map(loc => (
            <label
              key={loc}
              className="mt-3 flex flex-col gap-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {loc.toUpperCase()} {loc === 'en' ? '(required)' : '(optional)'}
              </span>
              <textarea
                value={edit.bodies[loc] ?? ''}
                onChange={e => setEdit({ ...edit, bodies: { ...edit.bodies, [loc]: e.target.value } })}
                rows={loc === 'en' ? 5 : 3}
                placeholder="Markdown supported…"
                className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </label>
          ))}

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={edit.important}
                onChange={e => setEdit({ ...edit, important: e.target.checked })}
              />
              Important (blocking modal)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={edit.enabled}
                onChange={e => setEdit({ ...edit, enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Start (optional)
              <input
                type="datetime-local"
                value={edit.startLocal}
                onChange={e => setEdit({ ...edit, startLocal: e.target.value })}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Expiry (optional)
              <input
                type="datetime-local"
                value={edit.expiresLocal}
                onChange={e => setEdit({ ...edit, expiresLocal: e.target.value })}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview</span>
              <select
                value={previewLocale}
                onChange={e => setPreviewLocale(e.target.value as Locale)}
                className="rounded border border-slate-200 text-xs"
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
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm [&_a]:text-blue-600 [&_a]:underline">
              <MarkdownView markdown={edit.bodies[previewLocale] || edit.bodies.en || ''} />
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setEdit(null)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
