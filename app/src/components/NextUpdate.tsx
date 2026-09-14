import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const DAY_MS = 86_400_000
const SECOND_MS = 1_000

/** The next 03:30 UTC strictly after `now` — the daily ranking-board rebuild. */
function nextUpdateAt(now: number): number {
  const d = new Date(now)
  const candidate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 30)
  return now < candidate ? candidate : candidate + DAY_MS
}

type DurationUnit = 'hour' | 'minute' | 'second'

/** Locale-aware compact unit, e.g. "3h" / "59m" / "42s" in en. */
function formatUnit(value: number, unit: DurationUnit, language: string): string {
  return new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay: 'narrow' }).format(value)
}

/** "3h 59m 42s", dropping empty leading units ("59m 42s", "42s"). */
function formatRemaining(diff: number, language: string): string {
  const totalSeconds = Math.max(0, Math.floor(diff / SECOND_MS))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(formatUnit(hours, 'hour', language))
  if (hours > 0 || minutes > 0) parts.push(formatUnit(minutes, 'minute', language))
  parts.push(formatUnit(seconds, 'second', language))
  return parts.join(' ')
}

/** "Next update 3h 59m 42s" — the board rebuilds daily at 03:30 UTC; ticks once a second. */
export default function NextUpdate() {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), SECOND_MS)
    return () => clearInterval(id)
  }, [])

  const when = formatRemaining(nextUpdateAt(now) - now, i18n.language)

  return <p className="text-muted-foreground mt-2 mb-0 text-sm">{t('rankings.nextUpdate', { when })}</p>
}
