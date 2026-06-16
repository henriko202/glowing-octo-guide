// convex/privacy/consent.ts
// Consent (GDPR/LGPD). consentRecords is an append-only log; the current effective consent for a
// purpose is the LATEST record (by createdAt). latestConsentByPurpose is pure + unit-tested.
// Re-consent: acknowledgePolicy stamps the user's acknowledgedPolicyVersion to the current POLICY_VERSION.
import { mutation, query } from '../_generated/server'
import { v } from 'convex/values'
import { resolveSession } from '../lib/auth'
import { writeAuditLog } from '../lib/audit'
import { POLICY_VERSION } from '../lib/policy'

export type ConsentPurpose = 'marketing' | 'analytics'

type AuditDb = { insert: (t: string, d: Record<string, unknown>) => Promise<string> }

export function latestConsentByPurpose(
  records: Array<{ purpose: string; granted: boolean; createdAt: number }>
): Record<string, boolean> {
  const latest: Record<string, { granted: boolean; createdAt: number }> = {}
  for (const r of records) {
    const cur = latest[r.purpose]
    if (!cur || r.createdAt > cur.createdAt) latest[r.purpose] = { granted: r.granted, createdAt: r.createdAt }
  }
  const out: Record<string, boolean> = {}
  for (const k of Object.keys(latest)) out[k] = latest[k].granted
  return out
}

export const recordConsent = mutation({
  args: {
    sessionToken: v.string(),
    purpose: v.union(v.literal('marketing'), v.literal('analytics')),
    granted: v.boolean()
  },
  handler: async (ctx, { sessionToken, purpose, granted }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    await ctx.db.insert('consentRecords', {
      userId: user._id,
      purpose,
      granted,
      policyVersion: POLICY_VERSION,
      createdAt: Date.now()
    })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: granted ? 'consent.granted' : 'consent.withdrawn',
      targetUserId: user._id,
      metadata: JSON.stringify({ purpose })
    })
  }
})

export const getConsents = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const records = await ctx.db
      .query('consentRecords')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect()
    return latestConsentByPurpose(records)
  }
})

export const acknowledgePolicy = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    await ctx.db.patch(user._id, { acknowledgedPolicyVersion: POLICY_VERSION })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: 'policy.acknowledged',
      targetUserId: user._id,
      metadata: JSON.stringify({ version: POLICY_VERSION })
    })
  }
})

// One-time consent prompt completion: records the user's marketing + analytics choices and stamps
// `consentPromptedAt` so the first-login ConsentPromptScreen is shown only once.
export const completeConsentPrompt = mutation({
  args: { sessionToken: v.string(), marketing: v.boolean(), analytics: v.boolean() },
  handler: async (ctx, { sessionToken, marketing, analytics }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    const now = Date.now()
    const choices: ReadonlyArray<readonly [ConsentPurpose, boolean]> = [
      ['marketing', marketing],
      ['analytics', analytics]
    ]
    for (const [purpose, granted] of choices) {
      await ctx.db.insert('consentRecords', {
        userId: user._id,
        purpose,
        granted,
        policyVersion: POLICY_VERSION,
        createdAt: now
      })
    }
    await ctx.db.patch(user._id, { consentPromptedAt: now })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: 'consent.prompt_completed',
      targetUserId: user._id,
      metadata: JSON.stringify({ marketing, analytics })
    })
  }
})
