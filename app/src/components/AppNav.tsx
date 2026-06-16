// app/src/components/AppNav.tsx
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import { beginSignOut, signOut } from '../lib/session'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' }
]

const NAV_LINKS = [
  { path: '/feed', label: 'Feed' },
  { path: '/my-posts', label: 'My Posts' },
  { path: '/settings', label: 'Settings' },
  { path: '/privacy-data', label: 'Privacy' },
  { path: '/billing', label: 'Billing' }
]

export default function AppNav() {
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const logout = useMutation(api.users.logout)

  async function handleSignOut() {
    const token = sessionStorage.getItem('sessionToken')
    // Set the guard BEFORE logout: logout makes getMe reactively return null, which would otherwise
    // trip RequireAuth's auto-OAuth and silently re-log us in before the landing redirect lands.
    beginSignOut()
    if (token) {
      try {
        await logout({ sessionToken: token })
      } catch {
        /* ignore */
      }
    }
    // Drop the local token and leave the SPA for the marketing/landing site.
    signOut()
  }

  return (
    <nav className="flex h-12 items-center border-b border-slate-800 bg-slate-900 px-4 font-sans text-sm">
      <span className="mr-6 text-[13px] font-bold tracking-tight text-slate-200">🔗 Link Into The SSI</span>
      {NAV_LINKS.map(link => (
        <Link
          key={link.path}
          to={link.path}
          className={`flex h-12 items-center border-b-2 px-3 text-[13px] no-underline ${pathname === link.path ? 'border-blue-500 font-semibold text-blue-500' : 'border-transparent font-normal text-slate-400'}`}
        >
          {link.label}
        </Link>
      ))}
      <select
        value={i18n.language?.split('-')[0] ?? 'en'}
        onChange={e => i18n.changeLanguage(e.target.value)}
        className="ml-auto h-7 cursor-pointer rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400 outline-none"
      >
        {LANGUAGES.map(lang => (
          <option
            key={lang.code}
            value={lang.code}
          >
            {lang.label}
          </option>
        ))}
      </select>
      <button
        onClick={handleSignOut}
        className="ml-3 cursor-pointer border-none bg-none px-2 text-[13px] text-slate-500 outline-none"
      >
        Sign out
      </button>
    </nav>
  )
}
