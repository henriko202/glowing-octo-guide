import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import { useNavigate } from 'react-router-dom'

export default function AdminPage() {
  const navigate = useNavigate()
  const userId = (sessionStorage.getItem('convexUserId') ?? undefined) as Id<'users'> | undefined
  const isAdmin = useQuery(api.admin.checkIsAdmin, userId ? { userId } : 'skip')
  const settings = useQuery(api.admin.getSettings, userId && isAdmin ? { userId } : 'skip')
  const toggleSync = useMutation(api.admin.toggleApifySync)
  const [toggling, setToggling] = useState(false)

  if (isAdmin === undefined) {
    return
  }

  if (!isAdmin) {
    navigate('/')
  }

  async function handleToggle() {
    if (!userId || !settings) return
    setToggling(true)
    try {
      await toggleSync({ userId, enabled: !settings.apifySyncEnabled })
    } finally {
      setToggling(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>Admin Panel</h1>

      {/* Apify Sync Toggle */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 20,
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Apify Post Sync</h2>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
              Scrapes LinkedIn posts for all active users every hour via Apify.
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling || !settings}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              fontWeight: 600,
              fontSize: 13,
              cursor: toggling ? 'wait' : 'pointer',
              background: settings?.apifySyncEnabled ? '#ef4444' : '#22c55e',
              color: '#fff'
            }}
          >
            {toggling ? '…' : settings?.apifySyncEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {/* Last sync info */}
        {settings?.lastApifySyncAt && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
            Last sync: {new Date(settings.lastApifySyncAt).toLocaleString()}
            {settings.lastApifySyncError && (
              <span style={{ color: '#ef4444', marginLeft: 8 }}>— {settings.lastApifySyncError}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
