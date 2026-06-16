// Minimal structural types for Convex handler ctx and db.
// These are used in place of the generated DataModel types (which require `npx convex dev`).
// Once _generated/ exists, replace these with proper GenericMutationCtx<DataModel> etc.

/** Minimal index query builder — matches Convex's fluent query API shape */
export interface IndexQueryBuilder {
  eq(field: string, value: unknown): IndexQueryBuilder
}

/** Minimal filter query builder */
export interface FilterQueryBuilder {
  eq(a: unknown, b: unknown): unknown
  field(name: string): unknown
  or(...conditions: unknown[]): unknown
}

/** Minimal query builder that only needs .first() — used for narrow upsert operations */
export interface IndexFirstQuery {
  first(): Promise<ConvexDocument | null>
}

/** Full collection query chain returned from db.query() */
export interface CollectionQuery {
  withIndex(name: string, fn: (q: IndexQueryBuilder) => IndexQueryBuilder): CollectionQuery
  filter(fn: (q: FilterQueryBuilder) => unknown): CollectionQuery
  order(direction: 'asc' | 'desc'): CollectionQuery
  first(): Promise<ConvexDocument | null>
  collect(): Promise<ConvexDocument[]>
}

/** A generic Convex document — has _id and _creationTime plus arbitrary fields */
export type ConvexDocument = {
  _id: string
  _creationTime: number
  [key: string]: unknown
}

/** Narrow db interface for upsertUserHandler — only needs query+withIndex+first, patch, insert */
export interface UpsertDb {
  query(table: string): {
    withIndex(name: string, fn: (q: IndexQueryBuilder) => IndexQueryBuilder): IndexFirstQuery
  }
  patch(id: string, fields: Record<string, unknown>): Promise<void>
  insert(table: string, doc: Record<string, unknown>): Promise<string>
}

/** Full db interface used by query/mutation/action handlers */
export interface ConvexDb {
  query(table: string): CollectionQuery
  get(id: string): Promise<ConvexDocument | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
  insert(table: string, doc: Record<string, unknown>): Promise<string>
}

/** Minimal auth object returned by ctx.auth */
export interface ConvexAuth {
  getUserIdentity(): Promise<{ subject: string; name?: string; email?: string } | null>
}

/** Minimal ctx for query handlers */
export interface QueryCtx {
  db: ConvexDb
  auth: ConvexAuth
}

/** Minimal ctx for mutation handlers */
export interface MutationCtx {
  db: ConvexDb
  auth: ConvexAuth
  scheduler: {
    runAfter(delayMs: number, ref: unknown, args: Record<string, unknown>): Promise<unknown>
  }
}

/** Minimal ctx for action handlers */
export interface ActionCtx {
  auth: ConvexAuth
  runQuery<T>(ref: unknown, args: Record<string, unknown>): Promise<T>
  runMutation(ref: unknown, args: Record<string, unknown>): Promise<unknown>
  runAction(ref: unknown, args: Record<string, unknown>): Promise<unknown>
  scheduler: {
    runAfter(delayMs: number, ref: unknown, args: Record<string, unknown>): Promise<unknown>
  }
}

/** User document shape (mirrors schema.ts) */
export interface UserDoc extends ConvexDocument {
  linkedinId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  industry?: string
  country?: string
  location?: string
  primaryLocale?: string
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
  trialEndsAt?: number
  stripeCustomerId?: string
  linkedinAccessToken?: string
  linkedinRefreshToken?: string
  tokenExpiresAt?: number
  linkedinPublicIdentifier?: string
  isAdmin?: boolean
  isBanned?: boolean
  bannedAt?: number
  bannedBy?: string
  bannedReason?: string
  // Privacy & compliance fields (mirror schema.ts; read by getMe → toSafeMe → the app's me object)
  email?: string
  emailVerified?: boolean
  deletionRequestedAt?: number
  deletionScheduledAt?: number
  deletionReason?: 'user_request' | 'dormancy'
  lastLoginAt?: number
  acknowledgedPolicyVersion?: string
  consentPromptedAt?: number
  publicIdentifierPromptedAt?: number
  createdAt: number
}

/** Post document shape (mirrors schema.ts) */
export interface PostDoc extends ConvexDocument {
  linkedinPostUrn: string
  authorId: string
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  mediaUrls: string[]
  isFeatured: boolean
  featuredAt?: number
  visibilityIndustries: string[]
  visibilityCountries: string[]
  hidden: boolean
}

/** Subscription document shape (mirrors schema.ts) */
export interface SubscriptionDoc extends ConvexDocument {
  userId: string
  stripeSubscriptionId: string
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  status: string
  currentPeriodEnd: number
}

/** AppSettings document shape (mirrors schema.ts) */
export interface AppSettingsDoc extends ConvexDocument {
  apifySyncEnabled: boolean
  apifyEnabled?: boolean
  apifyProfileScrapeEnabled?: boolean
  lastApifySyncAt?: number
  lastApifySyncError?: string
}

/** UserConnections document shape (mirrors schema.ts) */
export interface UserConnectionsDoc extends ConvexDocument {
  userId: string
  connectionLinkedinIds: string[]
  lastSyncedAt: number
}
