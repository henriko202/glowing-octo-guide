import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'

export default function PolicyUpdateScreen() {
  const { t } = useTranslation()
  const acknowledge = useMutation(api.privacy.consent.acknowledgePolicy)
  const [working, setWorking] = useState(false)

  async function handleAcknowledge() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await acknowledge({ sessionToken: token })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="text-lg font-bold text-slate-900">{t('privacy.policyUpdate.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('privacy.policyUpdate.body')}</p>
        <div className="mt-5 flex items-center gap-3">
          <a
            href="https://linkintothessi.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            {t('privacy.policyUpdate.readPolicy')}
          </a>
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={working}
            className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {working ? '…' : t('privacy.policyUpdate.acknowledge')}
          </button>
        </div>
      </div>
    </div>
  )
}
