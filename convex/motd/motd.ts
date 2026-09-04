// convex/motd/motd.ts
// Message of the Day: admin authoring (CRUD) + the viewer query that resolves the single
// active MOTD. Pure helpers (selectActiveMotd / validateMotdInput) are exported for unit tests.

import { mutation, query } from '../_generated/server'
import { v } from 'convex/values'
import { requireAuth, resolveSession } from '../lib/auth'
import { assertAdmin } from '../admin'

export const MAX_MOTD_BODY_LENGTH = 5000
export const REQUIRED_LOCALE = 'en'
// The locales the app UI actually renders (app/src/i18n supportedLngs). A body under any other key
// could never resolve on the client, so reject it at the trust boundary rather than store dead data.
export const SUPPORTED_MOTD_LOCALES = ['en', 'pt', 'es'] as const

type MotdActiveFields = {
  enabled: boolean
  startAt?: number
  expiresAt?: number
  createdAt: number
}

// Pure: the newest enabled MOTD whose [startAt, expiresAt) window covers `now`, else null.
export function selectActiveMotd<T extends MotdActiveFields>(rows: T[], now: number): T | null {
  const active = rows
    .filter(r => r.enabled)
    .filter(r => (r.startAt == null || r.startAt <= now) && (r.expiresAt == null || r.expiresAt > now))
    .sort((a, b) => b.createdAt - a.createdAt)
  return active[0] ?? null
}

// Pure: trim per-locale bodies, drop empties, enforce a required English body, cap length,
// and require expiresAt > startAt when both are present. Returns the cleaned bodies map.
export function validateMotdInput(input: {
  bodies: Record<string, string>
  startAt?: number
  expiresAt?: number
}): Record<string, string> {
  const cleaned: Record<string, string> = {}
  for (const [locale, body] of Object.entries(input.bodies)) {
    if (!(SUPPORTED_MOTD_LOCALES as readonly string[]).includes(locale)) {
      throw new Error(`Unsupported MOTD locale "${locale}". Allowed: ${SUPPORTED_MOTD_LOCALES.join(', ')}.`)
    }
    const trimmed = body.trim()
    if (trimmed.length === 0) continue
    if (trimmed.length > MAX_MOTD_BODY_LENGTH) {
      throw new Error(`MOTD body for "${locale}" must be ${MAX_MOTD_BODY_LENGTH} characters or fewer.`)
    }
    cleaned[locale] = trimmed
  }
  if (!cleaned[REQUIRED_LOCALE]) {
    throw new Error('An English (en) MOTD body is required.')
  }
  if (input.startAt != null && input.expiresAt != null && input.expiresAt <= input.startAt) {
    throw new Error('MOTD expiry must be after its start date.')
  }
  return cleaned
}

const bodiesValidator = v.record(v.string(), v.string())

// Viewer query — returns the single active MOTD (locale-resolution happens client-side) or null.
// Non-throwing: an unauthenticated/expired token yields null rather than an error state.
export const getActiveMotd = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const enabledRows = await ctx.db
      .query('motds')
      .withIndex('by_enabled_and_created', q => q.eq('enabled', true))
      .order('desc')
      .take(50)
    const active = selectActiveMotd(enabledRows, Date.now())
    if (!active) return null
    return { _id: active._id, bodies: active.bodies, important: active.important }
  }
})

// Admin: every MOTD, newest-first. Bounded — admin tool.
export const listMotds = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    return await ctx.db.query('motds').order('desc').take(200)
  }
})

export const createMotd = mutation({
  args: {
    sessionToken: v.string(),
    bodies: bodiesValidator,
    important: v.boolean(),
    enabled: v.boolean(),
    startAt: v.optional(v.number()),
    expiresAt: v.optional(v.number())
  },
  handler: async (ctx, { sessionToken, bodies, important, enabled, startAt, expiresAt }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const cleaned = validateMotdInput({ bodies, startAt, expiresAt })
    const now = Date.now()
    return await ctx.db.insert('motds', {
      bodies: cleaned,
      important,
      enabled,
      ...(startAt != null ? { startAt } : {}),
      ...(expiresAt != null ? { expiresAt } : {}),
      createdBy: admin._id,
      createdAt: now,
      updatedAt: now
    })
  }
})

export const updateMotd = mutation({
  args: {
    sessionToken: v.string(),
    motdId: v.id('motds'),
    bodies: bodiesValidator,
    important: v.boolean(),
    enabled: v.boolean(),
    startAt: v.optional(v.number()),
    expiresAt: v.optional(v.number())
  },
  handler: async (ctx, { sessionToken, motdId, bodies, important, enabled, startAt, expiresAt }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const existing = await ctx.db.get(motdId)
    if (!existing) throw new Error('MOTD not found')
    const cleaned = validateMotdInput({ bodies, startAt, expiresAt })
    // Setting a field to undefined in patch clears it — so clearing a date removes the schedule.
    await ctx.db.patch(motdId, {
      bodies: cleaned,
      important,
      enabled,
      startAt: startAt ?? undefined,
      expiresAt: expiresAt ?? undefined,
      updatedAt: Date.now()
    })
  }
})

export const deleteMotd = mutation({
  args: { sessionToken: v.string(), motdId: v.id('motds') },
  handler: async (ctx, { sessionToken, motdId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const existing = await ctx.db.get(motdId)
    if (!existing) throw new Error('MOTD not found')
    await ctx.db.delete(motdId)
  }
})

export const toggleMotdEnabled = mutation({
  args: { sessionToken: v.string(), motdId: v.id('motds'), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, motdId, enabled }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const existing = await ctx.db.get(motdId)
    if (!existing) throw new Error('MOTD not found')
    await ctx.db.patch(motdId, { enabled, updatedAt: Date.now() })
  }
})
