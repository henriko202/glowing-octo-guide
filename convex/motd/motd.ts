// convex/motd/motd.ts
// Message of the Day: admin authoring (CRUD) + the viewer query that resolves the single
// active MOTD. Pure helpers (resolveMotdEnabled / validateMotdInput) are exported for unit tests.
// `enabled` is materialized schedule state: admin writes and the reconcile cron both derive it
// from the [startAt, expiresAt) window via resolveMotdEnabled, so getActiveMotd needs no clock.

import { internalMutation, mutation, query } from '../_generated/server'
import { ConvexError, v } from 'convex/values'
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
}

/**
 * Pure: the single source of truth for a MOTD's stored `enabled` flag. A requested enable is
 * honored only while the [startAt, expiresAt) window covers `now` (inclusive start, exclusive
 * expiry, matching the old in-query filter); a requested disable always stays off. The admin
 * mutations and the reconcile cron both go through this helper, so the flag cannot drift from
 * the schedule.
 */
export function resolveMotdEnabled(input: MotdActiveFields, now: number): boolean {
  if (!input.enabled) return false
  if (input.startAt != null && input.startAt > now) return false
  if (input.expiresAt != null && input.expiresAt <= now) return false
  return true
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
      throw new ConvexError(`Unsupported MOTD locale "${locale}". Allowed: ${SUPPORTED_MOTD_LOCALES.join(', ')}.`)
    }
    const trimmed = body.trim()
    if (trimmed.length === 0) continue
    if (trimmed.length > MAX_MOTD_BODY_LENGTH) {
      throw new ConvexError(`MOTD body for "${locale}" must be ${MAX_MOTD_BODY_LENGTH} characters or fewer.`)
    }
    cleaned[locale] = trimmed
  }
  if (!cleaned[REQUIRED_LOCALE]) {
    throw new ConvexError('An English (en) MOTD body is required.')
  }
  if (input.startAt != null && input.expiresAt != null && input.expiresAt <= input.startAt) {
    throw new ConvexError('MOTD expiry must be after its start date.')
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
    // No time check: `enabled` is materialized from the schedule window by resolveMotdEnabled on
    // every admin write and re-derived by the reconcileMotdWindows cron, so this query stays
    // wall-clock-free (no Date.now()) and cache-friendly. The by_enabled_and_created index is
    // ordered by createdAt desc, so .first() is the newest enabled MOTD.
    const active = await ctx.db
      .query('motds')
      .withIndex('by_enabled_and_created', q => q.eq('enabled', true))
      .order('desc')
      .first()
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
      // Stored enabled = requested enable AND the window covering `now`; a future-dated MOTD
      // lands disabled and the reconcile cron enables it when startAt arrives.
      enabled: resolveMotdEnabled({ enabled, startAt, expiresAt }, now),
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
    if (!existing) throw new ConvexError('MOTD not found')
    const cleaned = validateMotdInput({ bodies, startAt, expiresAt })
    const now = Date.now()
    // Setting a field to undefined in patch clears it — so clearing a date removes the schedule.
    await ctx.db.patch(motdId, {
      bodies: cleaned,
      important,
      // Same schedule-derived flag as createMotd: an edit can move a MOTD into/out of its window.
      enabled: resolveMotdEnabled({ enabled, startAt, expiresAt }, now),
      startAt: startAt ?? undefined,
      expiresAt: expiresAt ?? undefined,
      updatedAt: now
    })
  }
})

export const deleteMotd = mutation({
  args: { sessionToken: v.string(), motdId: v.id('motds') },
  handler: async (ctx, { sessionToken, motdId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const existing = await ctx.db.get(motdId)
    if (!existing) throw new ConvexError('MOTD not found')
    await ctx.db.delete(motdId)
  }
})

export const toggleMotdEnabled = mutation({
  args: { sessionToken: v.string(), motdId: v.id('motds'), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, motdId, enabled }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const existing = await ctx.db.get(motdId)
    if (!existing) throw new ConvexError('MOTD not found')
    const now = Date.now()
    if (!enabled) {
      // Explicit disable ALSO clears the schedule window. Without this, a row whose
      // [startAt, expiresAt) window is still live is re-enabled by the next
      // reconcileMotdWindows tick — the admin's off would not stick.
      await ctx.db.patch(motdId, {
        enabled: false,
        startAt: undefined,
        expiresAt: undefined,
        updatedAt: now
      })
      return
    }
    // An enable is honored only inside the existing schedule window (an expired MOTD cannot be
    // resurrected by toggling). A disable is stored as requested and clears the window above.
    await ctx.db.patch(motdId, {
      enabled: resolveMotdEnabled({ enabled: true, startAt: existing.startAt, expiresAt: existing.expiresAt }, now),
      updatedAt: now
    })
  }
})

/**
 * Cron (every 5 minutes): materialize schedule transitions into the `enabled` flag so
 * getActiveMotd never reads a wall clock.
 * - Enabled rows whose window has not started yet (e.g. written before this deploy) or has ended
 *   are switched off.
 * - Disabled rows with a scheduled start that has arrived (and no passed expiry) are switched on.
 * Bounded scan: MOTDs are an admin-authored, tiny set. The same resolveMotdEnabled helper the
 * admin mutations use decides both directions, so the cron cannot drift from the admin path.
 */
export const reconcileMotdWindows = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const [enabledRows, disabledRows] = await Promise.all([
      ctx.db
        .query('motds')
        .withIndex('by_enabled_and_created', q => q.eq('enabled', true))
        .take(50),
      ctx.db
        .query('motds')
        .withIndex('by_enabled_and_created', q => q.eq('enabled', false))
        .take(50)
    ])
    for (const row of enabledRows) {
      if (!resolveMotdEnabled({ enabled: true, startAt: row.startAt, expiresAt: row.expiresAt }, now)) {
        await ctx.db.patch(row._id, { enabled: false, updatedAt: now })
      }
    }
    for (const row of disabledRows) {
      // Only a still-armed scheduled row (startAt present) is ever auto-enabled: an admin disable
      // via toggleMotdEnabled clears startAt/expiresAt, so it stays off. A still-scheduled row
      // awaits its start — the schedule is the source of truth for armed rows.
      if (row.startAt == null) continue
      if (resolveMotdEnabled({ enabled: true, startAt: row.startAt, expiresAt: row.expiresAt }, now)) {
        await ctx.db.patch(row._id, { enabled: true, updatedAt: now })
      }
    }
  }
})
