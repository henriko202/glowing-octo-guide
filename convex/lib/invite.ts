// convex/lib/invite.ts
// Pure helpers for backlog/R19 (invite a peer). Only the code travels: the landing puts ?ref=<code>
// on its sign-in links, http.ts carries it through the OAuth state, and upsertUserHandler stamps
// `referredByCode` on the NEW user only. No invites table, no counters — the users table is the log.
//
// INVITE_CODE_RE is duplicated in landing/components/RefCarrier.tsx, because the landing bundle must
// not import from convex/. Keep the two in sync.
export const INVITE_CODE_RE = /^[a-z0-9]{8}$/
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function isInviteCode(value: unknown): value is string {
  return typeof value === 'string' && INVITE_CODE_RE.test(value)
}

/** Eight of [a-z0-9]: 36^8 ≈ 2.8e12 codes. The minting mutation retries a collision once. */
export function generateInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 8; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)]
  return code
}

/** "Ana Souza" → "Ana": the gift line names the inviter the way a friend would. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}
