const SUPPORT_EMAIL = 'contact@email.com' // TODO: replace with the real support address

type Props = {
  reason?: string
}

function handleSignOut() {
  sessionStorage.removeItem('sessionToken')
  window.location.assign('/')
}

export default function BannedScreen({ reason }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-3 flex items-center gap-2 text-red-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-wider">Account suspended</span>
        </div>

        <h1 className="text-lg font-bold text-slate-900">Your account has been suspended</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          An administrator has revoked your access to this app.
        </p>

        {reason && (
          <div className="mt-4 rounded-r-md border-l-[3px] border-red-500 bg-red-50 px-3 py-2 text-sm text-slate-700">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reason</span>
            <p className="mt-0.5">{reason}</p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Contact support
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
