import React from 'react'
import { useTranslation } from 'react-i18next'

const CONVEX_URL = import.meta.env.VITE_CONVEX_SITE as string
const AUTH_URL = `${CONVEX_URL}/auth/linkedin`

export default function LoginPage(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('login.title')}</h1>
        <p className="text-gray-500">{t('login.tagline')}</p>
        <a
          href={AUTH_URL}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0077B5] px-6 py-3 font-medium text-white transition-colors hover:bg-[#005885]"
        >
          {t('login.signInButton')}
        </a>
      </div>
    </div>
  )
}
