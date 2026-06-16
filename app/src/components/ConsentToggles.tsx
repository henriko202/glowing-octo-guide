import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'

type ConsentMap = { marketing?: boolean; analytics?: boolean } | null | undefined
const PURPOSES = ['marketing', 'analytics'] as const

export default function ConsentToggles() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const consents = useQuery(api.privacy.consent.getConsents, sessionToken ? { sessionToken } : 'skip') as ConsentMap
  const recordConsent = useMutation(api.privacy.consent.recordConsent)

  async function toggle(purpose: (typeof PURPOSES)[number], granted: boolean) {
    if (!sessionToken) return
    await recordConsent({ sessionToken, purpose, granted })
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 mt-0 text-base font-semibold text-slate-900">{t('privacy.consent.title')}</h2>
      <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('privacy.consent.note')}</p>
      {PURPOSES.map(p => (
        <label
          key={p}
          className="mb-2 flex items-center gap-3 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            aria-label={t(`privacy.consent.${p}`)}
            checked={consents?.[p] === true}
            onChange={e => toggle(p, e.target.checked)}
            className="h-4 w-4"
          />
          <span>{t(`privacy.consent.${p}`)}</span>
        </label>
      ))}
    </section>
  )
}
