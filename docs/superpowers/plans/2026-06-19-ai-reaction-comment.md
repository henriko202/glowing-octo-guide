# AI Reaction & Comment Assistance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use DeepSeek (`deepseek-v4-flash`) to predict each submitted post's most-likely LinkedIn reaction (stored,
surfaced as a pre-selected reaction picker) and to draft on-demand comments in a user-chosen language.

**Architecture:** A single DeepSeek client seam (`convex/ai/deepseek.ts`) mirrors the existing `linkedin/client.ts`.
Pure helper modules (`lib/reactions.ts`, `lib/languages.ts`, `ai/prompts.ts`) hold all testable logic. Reaction
prediction runs **async** — `submitPost` schedules an internal action that patches `posts.suggestedReaction`. Comment
drafting is a public action returning transient text (never persisted). Frontend gets a reaction picker (PostCard) and
Generate/Regenerate + language combobox (CommentBox), plus a Settings default.

**Tech Stack:** Convex (`^1.41.0`), TypeScript, React 19 + Vite, Vitest + @testing-library/react, react-i18next,
Tailwind. DeepSeek OpenAI-compatible chat API.

**Spec:** `docs/superpowers/specs/2026-06-19-ai-reaction-comment-design.md`

## Global Constraints

- **NEVER run `git commit` or `git push`** (per `CLAUDE.md` — Henriko makes all commits). Each task ends with a **Verify
  gate** (tests/typecheck), not a commit. Stop after a task and let the user commit.
- **Convex tooling:** use **pnpm**, run from the **repo root** (`D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI`). Never run the
  convex CLI from inside `convex/`.
- **Testing convention:** this repo does **not** use `convex-test`. Unit-test **pure** logic with Vitest; registered
  Convex wrappers are validated by the TypeScript/codegen pass (`pnpm typecheck`). Do not introduce `convex-test`.
- **Canonical reaction enum** (LinkedIn `/rest/reactions` `reactionType`, verbatim): `LIKE`, `PRAISE`, `EMPATHY`,
  `INTEREST`, `APPRECIATION`, `ENTERTAINMENT`.
- **Default comment language is `auto`** (write in the post's language). Resolution: per-comment selection → saved
  `users.commentLanguage` → `auto`.
- **DeepSeek is gated behind `DEEPSEEK_API_KEY`** — unset (production default) ⇒ prediction no-ops to `LIKE` and
  Generate surfaces "AI unavailable". Do **not** enable in production (compliance gate in the spec).
- **Keep `docs/PLATFORM.md` in sync** — Task 12 updates it; a feature is not done until it does.
- **Verify-gate commands** (from repo root):
    - Convex unit test: `pnpm --filter convex exec vitest run <file>`
    - App unit test: `pnpm --filter app exec vitest run <file>`
    - Typecheck (all packages): `pnpm typecheck`

---

### Task 1: Reaction model + `parseReaction`

**Files:**

- Create: `convex/lib/reactions.ts`
- Test: `convex/lib/reactions.test.ts`

**Interfaces:**

- Produces: `reactionValidator` (Convex validator), `type Reaction`,
  `REACTIONS: ReadonlyArray<{ value: Reaction; emoji: string; labelKey: string }>`,
  `parseReaction(raw: string): Reaction`.

- [ ] **Step 1: Write the failing test**

```typescript
// convex/lib/reactions.test.ts
import { describe, expect, it } from 'vitest'
import { parseReaction, REACTIONS } from './reactions'

describe('parseReaction', () => {
  it('returns a clean one-word reply verbatim', () => {
    expect(parseReaction('PRAISE')).toBe('PRAISE')
    expect(parseReaction('like')).toBe('LIKE')
    expect(parseReaction('  Empathy \n')).toBe('EMPATHY')
  })
  it('extracts the keyword from a noisy reply', () => {
    expect(parseReaction('Reaction: INTEREST.')).toBe('INTEREST')
    expect(parseReaction('I would react with APPRECIATION here')).toBe('APPRECIATION')
  })
  it('does not false-match LIKE inside another word', () => {
    expect(parseReaction('That is unlikely to be insightful')).toBe('INTEREST')
  })
  it('defaults to LIKE on empty/unknown/garbage', () => {
    expect(parseReaction('')).toBe('LIKE')
    expect(parseReaction('banana')).toBe('LIKE')
    expect(parseReaction(undefined as unknown as string)).toBe('LIKE')
  })
  it('exposes 6 reactions with emoji + label keys', () => {
    expect(REACTIONS).toHaveLength(6)
    expect(REACTIONS.map(r => r.value)).toEqual(['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter convex exec vitest run convex/lib/reactions.test.ts`
Expected: FAIL — cannot find module `./reactions`.

- [ ] **Step 3: Write the implementation**

```typescript
// convex/lib/reactions.ts
import { type Infer, v } from 'convex/values'

/** LinkedIn /rest/reactions reactionType values (verbatim). Single source of truth. */
export const reactionValidator = v.union(
  v.literal('LIKE'),
  v.literal('PRAISE'),
  v.literal('EMPATHY'),
  v.literal('INTEREST'),
  v.literal('APPRECIATION'),
  v.literal('ENTERTAINMENT')
)
export type Reaction = Infer<typeof reactionValidator>

/** UI metadata, co-located so labels/emoji can never reference a non-existent reaction. */
export const REACTIONS: ReadonlyArray<{ value: Reaction; emoji: string; labelKey: string }> = [
  { value: 'LIKE', emoji: '👍', labelKey: 'reactions.like' },
  { value: 'PRAISE', emoji: '👏', labelKey: 'reactions.celebrate' },
  { value: 'EMPATHY', emoji: '❤️', labelKey: 'reactions.love' },
  { value: 'INTEREST', emoji: '💡', labelKey: 'reactions.insightful' },
  { value: 'APPRECIATION', emoji: '🤝', labelKey: 'reactions.support' },
  { value: 'ENTERTAINMENT', emoji: '😄', labelKey: 'reactions.funny' }
]

/**
 * Coerce a raw model reply into a valid reaction. Exact one-word reply wins; else the
 * first keyword matched as a whole word (\b) wins; anything else defaults to LIKE.
 */
export function parseReaction(raw: string): Reaction {
  const text = (raw ?? '').trim().toUpperCase()
  for (const r of REACTIONS) if (text === r.value) return r.value
  for (const r of REACTIONS) if (new RegExp(`\\b${r.value}\\b`).test(text)) return r.value
  return 'LIKE'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter convex exec vitest run convex/lib/reactions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify gate** — `pnpm --filter convex exec vitest run convex/lib/reactions.test.ts` green. Stop for the
  user to review/commit.

---

### Task 2: Comment-languages module

**Files:**

- Create: `convex/lib/languages.ts`
- Test: `convex/lib/languages.test.ts`

**Interfaces:**

- Produces: `LANGUAGE_CODES: readonly string[]`, `AUTO_LANGUAGE = 'auto'`,
  `isValidCommentLanguage(value: string): boolean`, `resolveCommentLanguage(stored: string | undefined): string`,
  `languageLabel(code: string, locale?: string): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// convex/lib/languages.test.ts
import { describe, expect, it } from 'vitest'
import { AUTO_LANGUAGE, isValidCommentLanguage, languageLabel, LANGUAGE_CODES, resolveCommentLanguage } from './languages'

describe('comment languages', () => {
  it('includes major languages', () => {
    for (const c of ['en', 'pt', 'es', 'fr', 'de', 'ja', 'zh', 'ar']) expect(LANGUAGE_CODES).toContain(c)
  })
  it('validates codes and the auto sentinel', () => {
    expect(isValidCommentLanguage('en')).toBe(true)
    expect(isValidCommentLanguage(AUTO_LANGUAGE)).toBe(true)
    expect(isValidCommentLanguage('xx')).toBe(false)
    expect(isValidCommentLanguage('')).toBe(false)
  })
  it('resolves: unset/invalid → auto, valid → passthrough', () => {
    expect(resolveCommentLanguage(undefined)).toBe('auto')
    expect(resolveCommentLanguage('')).toBe('auto')
    expect(resolveCommentLanguage('zz')).toBe('auto')
    expect(resolveCommentLanguage('pt')).toBe('pt')
    expect(resolveCommentLanguage('auto')).toBe('auto')
  })
  it('labels a code via Intl, falling back to the raw code', () => {
    expect(languageLabel('pt', 'en')).toMatch(/portuguese/i)
    expect(languageLabel('zz')).toBe('zz')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter convex exec vitest run convex/lib/languages.test.ts`
Expected: FAIL — cannot find module `./languages`.

- [ ] **Step 3: Write the implementation**

```typescript
// convex/lib/languages.ts
// PURE DATA — no Convex/server imports. Safe to import from convex functions (validation)
// and the Vite client (dropdowns). Mirrors lib/profileOptions.ts (codes + Intl.DisplayNames).

/** ISO 639-1 language codes. Display names are derived via Intl.DisplayNames (see languageLabel). */
export const LANGUAGE_CODES: readonly string[] = [
  'aa','ab','ae','af','ak','am','an','ar','as','av','ay','az','ba','be','bg','bh','bi','bm','bn','bo','br','bs',
  'ca','ce','ch','co','cr','cs','cu','cv','cy','da','de','dv','dz','ee','el','en','eo','es','et','eu','fa','ff',
  'fi','fj','fo','fr','fy','ga','gd','gl','gn','gu','gv','ha','he','hi','ho','hr','ht','hu','hy','hz','ia','id',
  'ie','ig','ii','ik','io','is','it','iu','ja','jv','ka','kg','ki','kj','kk','kl','km','kn','ko','kr','ks','ku',
  'kv','kw','ky','la','lb','lg','li','ln','lo','lt','lu','lv','mg','mh','mi','mk','ml','mn','mr','ms','mt','my',
  'na','nb','nd','ne','ng','nl','nn','no','nr','nv','ny','oc','oj','om','or','os','pa','pi','pl','ps','pt','qu',
  'rm','rn','ro','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sq','sr','ss','st','su','sv',
  'sw','ta','te','tg','th','ti','tk','tl','tn','to','tr','ts','tt','tw','ty','ug','uk','ur','uz','ve','vi','vo',
  'wa','wo','xh','yi','yo','za','zh','zu'
]

export const AUTO_LANGUAGE = 'auto' as const
const CODE_SET = new Set<string>(LANGUAGE_CODES)

export function isValidCommentLanguage(value: string): boolean {
  return value === AUTO_LANGUAGE || CODE_SET.has(value)
}

/** Saved setting → a valid value, defaulting to 'auto'. Pure; shared by server + both selects. */
export function resolveCommentLanguage(stored: string | undefined): string {
  return stored && isValidCommentLanguage(stored) ? stored : AUTO_LANGUAGE
}

/** Localized language display name for a code (falls back to the raw code). */
export function languageLabel(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter convex exec vitest run convex/lib/languages.test.ts`
Expected: PASS (4 tests). (Prettier will reformat the array — that's fine.)

- [ ] **Step 5: Verify gate** — test green. Stop for review/commit.

---

### Task 3: Schema widening + `reactToPost` enum fix

**Files:**

- Modify: `convex/schema.ts` (`posts`, `users`)
- Modify: `convex/interactions.ts:141-148` (`reactToPost` validator), `interactions.ts:171-177` (body unchanged —
  verify)

**Interfaces:**

- Consumes: `reactionValidator` (Task 1).
- Produces: `posts.suggestedReaction?: Reaction`, `users.commentLanguage?: string`; `reactToPost` now accepts the
  canonical enum.

- [ ] **Step 1: Add schema fields**

In `convex/schema.ts`, add the import and fields:

```typescript
// top, with other imports:
import { reactionValidator } from './lib/reactions'

// inside posts: defineTable({ ... }) — after `inFeed`:
    // AI-predicted most-likely reaction (convex/ai/reactions.ts). Absent ⇒ UI treats as LIKE.
    suggestedReaction: v.optional(reactionValidator),

// inside users: defineTable({ ... }) — near primaryLocale:
    // Default language for AI-generated comments: an ISO 639-1 code or 'auto'. Absent ⇒ 'auto'.
    // Validated against convex/lib/languages.ts in setCommentLanguage. Distinct from primaryLocale (UI seed).
    commentLanguage: v.optional(v.string()),
```

- [ ] **Step 2: Fix the `reactToPost` validator**

In `convex/interactions.ts`, add the import and replace the inline union:

```typescript
// with the other imports at top:
import { reactionValidator } from './lib/reactions'

// in reactToPost args — replace the 6-literal v.union(...) with:
    reactionType: reactionValidator,
```

The request body (`body: { root: post.linkedinPostUrn, reactionType }`) is unchanged — it now forwards a valid API
value.

- [ ] **Step 3: Verify gate (typecheck + codegen)**

Run: `pnpm typecheck`
Expected: PASS. (Convex regenerates `_generated` types; `suggestedReaction`/`commentLanguage` appear on `Doc<'posts'>`/
`Doc<'users'>`; `reactToPost` accepts the new enum.)

If `convex dev`/codegen is needed first, run `npx convex codegen` from the repo root. Stop for review/commit.

---

### Task 4: DeepSeek client seam

**Files:**

- Create: `convex/ai/deepseek.ts`
- Test: `convex/ai/deepseek.test.ts`

**Interfaces:**

- Produces: `type ChatMessage = { role: 'system' | 'user'; content: string }`,
  `callDeepSeek(messages: ChatMessage[], opts: { action: string }): Promise<string>`.

- [ ] **Step 1: Write the failing test** (mocks global `fetch` + env)

```typescript
// convex/ai/deepseek.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callDeepSeek } from './deepseek'

const okJson = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as unknown as Response

describe('callDeepSeek', () => {
  beforeEach(() => { process.env.DEEPSEEK_API_KEY = 'test-key' })
  afterEach(() => { delete process.env.DEEPSEEK_API_KEY; vi.restoreAllMocks() })

  it('posts to the chat endpoint with auth + model and returns the content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson('Hello'))
    vi.stubGlobal('fetch', fetchMock)
    const out = await callDeepSeek([{ role: 'user', content: 'hi' }], { action: 'test' })
    expect(out).toBe('Hello')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    expect(JSON.parse(init.body).model).toBe('deepseek-v4-flash')
  })
  it('throws a sanitized error when the API key is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY
    await expect(callDeepSeek([{ role: 'user', content: 'x' }], { action: 'predict reaction' }))
      .rejects.toThrow(/not configured/i)
  })
  it('throws a sanitized error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' } as unknown as Response))
    await expect(callDeepSeek([{ role: 'user', content: 'x' }], { action: 'generate comment' }))
      .rejects.toThrow(/Failed to generate comment/i)
  })
  it('throws on empty content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson('   ')))
    await expect(callDeepSeek([{ role: 'user', content: 'x' }], { action: 'test' })).rejects.toThrow(/Failed to test/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter convex exec vitest run convex/ai/deepseek.test.ts`
Expected: FAIL — cannot find module `./deepseek`.

- [ ] **Step 3: Write the implementation**

```typescript
// convex/ai/deepseek.ts
// Single seam for DeepSeek chat calls (OpenAI-compatible). Mirrors linkedin/client.ts:
// owns auth + the log-real-error→throw-sanitized policy. Uses fetch() — NO "use node".
export type ChatMessage = { role: 'system' | 'user'; content: string }

export async function callDeepSeek(messages: ChatMessage[], opts: { action: string }): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY not set')
    throw new Error(`Failed to ${opts.action}. AI is not configured.`)
  }
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false })
  })
  if (!res.ok) {
    console.error(`DeepSeek ${opts.action} failed: ${res.status}`, await res.text())
    throw new Error(`Failed to ${opts.action}. Please try again.`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    console.error(`DeepSeek ${opts.action}: empty/invalid response`)
    throw new Error(`Failed to ${opts.action}. Please try again.`)
  }
  return text
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter convex exec vitest run convex/ai/deepseek.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify gate** — test green. Stop for review/commit.

---

### Task 5: Prompt builders

**Files:**

- Create: `convex/ai/prompts.ts`
- Test: `convex/ai/prompts.test.ts`

**Interfaces:**

- Consumes: `languageLabel`, `AUTO_LANGUAGE` (Task 2); `ChatMessage` (Task 4).
- Produces: input types `ReactionPromptPost`, `CommentPromptPost`;
  `buildReactionPrompt(post: ReactionPromptPost): ChatMessage[]`,
  `buildCommentPrompt(post: CommentPromptPost, language: string): ChatMessage[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// convex/ai/prompts.test.ts
import { describe, expect, it } from 'vitest'
import { buildCommentPrompt, buildReactionPrompt } from './prompts'

describe('buildReactionPrompt', () => {
  it('lists the 6 keywords and includes the post content', () => {
    const [system, user] = buildReactionPrompt({ content: 'We hit $1M ARR!' })
    expect(system.role).toBe('system')
    for (const k of ['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT']) {
      expect(system.content).toContain(k)
    }
    expect(user.content).toContain('We hit $1M ARR!')
  })
  it('includes the article title/summary when present', () => {
    const [, user] = buildReactionPrompt({ content: 'x', article: { title: 'Scaling', summary: 'How we scaled' } })
    expect(user.content).toContain('Scaling')
    expect(user.content).toContain('How we scaled')
  })
})

describe('buildCommentPrompt', () => {
  it('auto language → "same language as the post"', () => {
    const [system] = buildCommentPrompt({ content: 'x', mediaUrls: [] }, 'auto')
    expect(system.content).toMatch(/same language as the post/i)
    expect(system.content).toMatch(/at most 2/i)
  })
  it('specific language → names it', () => {
    const [system] = buildCommentPrompt({ content: 'x', mediaUrls: [] }, 'pt')
    expect(system.content).toMatch(/portuguese/i)
    expect(system.content).toContain('(pt)')
  })
  it('includes author, article and a cannot-view-media note', () => {
    const [, user] = buildCommentPrompt(
      { content: 'Body', mediaUrls: ['https://x/y.png'], author: { name: 'Jane', headline: 'Eng' },
        article: { title: 'T', summary: 'S', text: 'Long body' } },
      'en'
    )
    expect(user.content).toContain('Jane')
    expect(user.content).toContain('T')
    expect(user.content).toMatch(/cannot view/i)
    expect(user.content).toContain('https://x/y.png')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter convex exec vitest run convex/ai/prompts.test.ts`
Expected: FAIL — cannot find module `./prompts`.

- [ ] **Step 3: Write the implementation**

```typescript
// convex/ai/prompts.ts
import { type ChatMessage } from './deepseek'
import { AUTO_LANGUAGE, languageLabel } from '../lib/languages'

const REACTION_MAX = 1500
const COMMENT_ARTICLE_MAX = 2000
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

export interface ReactionPromptPost {
  content: string
  article?: { title?: string; summary?: string; text?: string }
}
export interface CommentPromptPost {
  content: string
  mediaUrls: string[]
  author?: { name?: string; headline?: string } | null
  article?: { title?: string; summary?: string; text?: string; author?: string }
}

const REACTION_SYSTEM = `You predict the single most fitting LinkedIn reaction a thoughtful professional would give to a post. Reply with ONLY one of these keywords — nothing else, no punctuation, no explanation:

LIKE — general agreement, acknowledgement, or support; the safe default.
PRAISE — celebrating an announcement, milestone, promotion, new job, award, or successful launch.
EMPATHY — a heartwarming, caring, or moving post you appreciate or love.
INTEREST — the post shares a useful insight, idea, tip, or makes you think.
APPRECIATION — supporting someone through a challenge, setback, or vulnerable moment.
ENTERTAINMENT — the post is funny, witty, or light-hearted.

If you are unsure, reply LIKE.`

export function buildReactionPrompt(post: ReactionPromptPost): ChatMessage[] {
  let user = `Post:\n${trunc(post.content ?? '', REACTION_MAX)}`
  if (post.article?.title || post.article?.summary || post.article?.text) {
    const a = post.article
    user += `\n\nLinked article — "${a.title ?? ''}": ${trunc(a.summary ?? a.text ?? '', REACTION_MAX)}`
  }
  user += `\n\nMost fitting reaction:`
  return [{ role: 'system', content: REACTION_SYSTEM }, { role: 'user', content: user }]
}

export function buildCommentPrompt(post: CommentPromptPost, language: string): ChatMessage[] {
  const languageLine =
    language === AUTO_LANGUAGE
      ? 'Write the comment in the same language as the post below.'
      : `Write the comment in ${languageLabel(language, 'en')} (${language}).`

  const system = `You help a LinkedIn user write a genuine, useful comment on someone else's post. Follow every rule:
- At most 2 short paragraphs. Concise.
- Add something of value: a specific insight, a thoughtful question, or a genuine reflection — not empty praise.
- Sound like a real professional speaking in the first person. Warm, not sycophantic.
- No hashtags. Do not @-mention anyone. Avoid emojis (at most one, only if it truly fits).
- Do not restate or quote the post at length.
- ${languageLine}
Reply with ONLY the comment text — no preamble, no surrounding quotation marks.`

  let user = ''
  if (post.author?.name) user += `Post author: ${post.author.name}${post.author.headline ? ` — ${post.author.headline}` : ''}\n`
  user += `Post:\n${post.content ?? ''}`
  if (post.article?.title || post.article?.summary || post.article?.text) {
    const a = post.article
    user += `\n\nLinked article — "${a.title ?? ''}"${a.author ? ` by ${a.author}` : ''}:\n${a.summary ?? ''}`
    if (a.text) user += `\n${trunc(a.text, COMMENT_ARTICLE_MAX)}`
  }
  if (post.mediaUrls?.length) {
    user += `\n\nThe post also includes media you cannot view — infer only from context:\n${post.mediaUrls.join('\n')}`
  }
  user += `\n\nWrite the comment now.`
  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter convex exec vitest run convex/ai/prompts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify gate** — test green. Stop for review/commit.

---

### Task 6: Reaction prediction action + submit hook

**Files:**

- Create: `convex/ai/reactions.ts`
- Modify: `convex/posts.ts` (`submitPost`, after the upsert)

**Interfaces:**

- Consumes: `internal.interactions.getPost` (existing), `buildReactionPrompt` (T5), `callDeepSeek` (T4),
  `parseReaction`/`reactionValidator` (T1).
- Produces: `internal.ai.reactions.predictReaction({ postId })`,
  `internal.ai.reactions.setSuggestedReaction({ postId, reaction })`.

- [ ] **Step 1: Write the implementation** (thin wrappers — verified by typecheck, not convex-test)

```typescript
// convex/ai/reactions.ts
import { internalAction, internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { parseReaction, reactionValidator } from '../lib/reactions'
import { buildReactionPrompt } from './prompts'
import { callDeepSeek } from './deepseek'

/** Best-effort: any failure (incl. missing API key) is swallowed; the post keeps its default LIKE. */
export const predictReaction = internalAction({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) return
    try {
      const raw = await callDeepSeek(buildReactionPrompt(post), { action: 'predict reaction' })
      await ctx.runMutation(internal.ai.reactions.setSuggestedReaction, { postId, reaction: parseReaction(raw) })
    } catch (e) {
      console.error('predictReaction failed (post keeps default LIKE):', e)
    }
  }
})

export const setSuggestedReaction = internalMutation({
  args: { postId: v.id('posts'), reaction: reactionValidator },
  handler: async (ctx, { postId, reaction }) => {
    await ctx.db.patch(postId, { suggestedReaction: reaction })
  }
})
```

- [ ] **Step 2: Wire the schedule into `submitPost`**

In `convex/posts.ts`, after `if (!postId) throw ...` and before `return { postId }`:

```typescript
    // Best-effort, async: predict the most-likely reaction without blocking the submit.
    // Failure (incl. missing DEEPSEEK_API_KEY) leaves the post at its default LIKE.
    await ctx.scheduler.runAfter(0, internal.ai.reactions.predictReaction, { postId })

    return { postId }
```

- [ ] **Step 3: Verify gate (typecheck)**

Run: `pnpm typecheck`
Expected: PASS. `internal.ai.reactions.predictReaction` resolves; `getPost` return type carries `content`/`article` for
`buildReactionPrompt`.

> Note: `buildReactionPrompt` accepts `ReactionPromptPost` (`content` + optional `article`); `Doc<'posts'>` satisfies it
> structurally. If TS complains about extra fields, pass `{ content: post.content, article: post.article }`.

- [ ] **Step 4:** Stop for review/commit.

---

### Task 7: Comment generation action + author query

**Files:**

- Create: `convex/ai/comments.ts`
- Modify: `convex/users.ts` (add `getPublicAuthor` internal query)

**Interfaces:**

- Consumes: `requireAuthAction` (`lib/auth`), `internal.lib.rateLimit.checkAndIncrement` (existing),
  `internal.interactions.getPost`, `buildCommentPrompt` (T5), `callDeepSeek` (T4), `resolveCommentLanguage` (T2).
- Produces: `api.ai.comments.generateComment({ sessionToken, postId, language? }) → { comment: string }`;
  `internal.users.getPublicAuthor({ userId }) → { name, headline } | null`.

- [ ] **Step 1: Add `getPublicAuthor` to `convex/users.ts`**

```typescript
// Internal: display-only author fields for the AI comment prompt (no tokens/PII beyond public profile).
export const getPublicAuthor = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId)
    return u ? { name: u.name, headline: u.headline } : null
  }
})
```

(`internalQuery` is already imported in `users.ts`.)

- [ ] **Step 2: Write the action**

```typescript
// convex/ai/comments.ts
import { action } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { requireAuthAction } from '../lib/auth'
import { resolveCommentLanguage } from '../lib/languages'
import { buildCommentPrompt } from './prompts'
import { callDeepSeek } from './deepseek'

export const generateComment = action({
  args: { sessionToken: v.string(), postId: v.id('posts'), language: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, postId, language }): Promise<{ comment: string }> => {
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
    if (!user.isAdmin) {
      await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
        userId: user._id, action: 'generateComment', maxPerHour: 30
      })
    }
    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')
    const author = await ctx.runQuery(internal.users.getPublicAuthor, { userId: post.authorId })

    const lang = resolveCommentLanguage(language ?? user.commentLanguage)
    const text = await callDeepSeek(buildCommentPrompt({ ...post, author }, lang), { action: 'generate comment' })
    return { comment: text.trim() }
  }
})
```

- [ ] **Step 3: Verify gate (typecheck)**

Run: `pnpm typecheck`
Expected: PASS. `api.ai.comments.generateComment` + `internal.users.getPublicAuthor` resolve.

- [ ] **Step 4:** Stop for review/commit.

---

### Task 8: `setCommentLanguage` mutation

**Files:**

- Modify: `convex/users.ts`

**Interfaces:**

- Consumes: `requireAuth`, `isValidCommentLanguage` (T2).
- Produces: `api.users.setCommentLanguage({ sessionToken, commentLanguage })`.

- [ ] **Step 1: Add the mutation** (import `isValidCommentLanguage` at top of `users.ts`)

```typescript
// add to imports:
import { isValidCommentLanguage } from './lib/languages'

// Public: set the default language for AI-generated comments ('auto' or an ISO 639-1 code).
export const setCommentLanguage = mutation({
  args: { sessionToken: v.string(), commentLanguage: v.string() },
  handler: async (ctx, { sessionToken, commentLanguage }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (!isValidCommentLanguage(commentLanguage)) throw new Error('Unsupported language')
    await ctx.db.patch(user._id, { commentLanguage })
  }
})
```

- [ ] **Step 2: Verify gate (typecheck)**

Run: `pnpm typecheck`
Expected: PASS. (`commentLanguage` is on `Doc<'users'>` from Task 3, so `getMe`/`toSafeMe` already surface it — no
`getMe` change needed.)

- [ ] **Step 3:** Stop for review/commit.

---

### Task 9: Reaction picker UI + i18n

**Files:**

- Modify: `app/src/components/PostCard.tsx`
- Modify: `app/src/components/PostCard.test.tsx`
- Modify: `app/src/pages/FeedPage.tsx`
- Modify: `app/src/i18n/locales/en.json`, `pt.json`, `es.json`

**Interfaces:**

- Consumes: `REACTIONS`, `type Reaction` (T1); `posts.suggestedReaction` (T3).
- Produces: `PostCard` `onReact: (postId, reaction) => void`; `PostWithAuthor.suggestedReaction?: Reaction`.

- [ ] **Step 1: Add i18n keys** (en.json shown; mirror into pt/es with the table below)

```jsonc
// en.json — add a top-level "reactions" block:
  "reactions": {
    "like": "Like", "celebrate": "Celebrate", "love": "Love",
    "insightful": "Insightful", "support": "Support", "funny": "Funny",
    "react": "React"
  },
```

| key                  | pt.json   | es.json     |
|----------------------|-----------|-------------|
| reactions.like       | Gostei    | Recomendar  |
| reactions.celebrate  | Parabéns  | Felicitar   |
| reactions.love       | Adorei    | Me encanta  |
| reactions.insightful | Genial    | Interesante |
| reactions.support    | Apoio     | Apoyo       |
| reactions.funny      | Engraçado | Divertido   |
| reactions.react      | Reagir    | Reaccionar  |

- [ ] **Step 2: Update the failing test** (picker open → select)

Replace the "wires the Like button" test in `PostCard.test.tsx` and add a pre-highlight test:

```typescript
  it('opens the reaction picker and calls onReact with the chosen reaction', () => {
    const onReact = vi.fn()
    render(<PostCard post={mockPost} onComment={() => {}} onReact={onReact} />)
    fireEvent.click(screen.getByRole('button', { name: /react/i })) // open picker
    fireEvent.click(screen.getByRole('button', { name: /celebrate/i }))
    expect(onReact).toHaveBeenCalledWith(mockPost._id, 'PRAISE')
  })

  it('pre-highlights the suggested reaction', () => {
    render(<PostCard post={{ ...mockPost, suggestedReaction: 'INTEREST' }} onComment={() => {}} onReact={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /react/i }))
    expect(screen.getByRole('button', { name: /insightful/i })).toHaveAttribute('aria-pressed', 'true')
  })
```

Run: `pnpm --filter app exec vitest run app/src/components/PostCard.test.tsx`
Expected: FAIL (no "react" button yet).

- [ ] **Step 3: Implement the picker in `PostCard.tsx`**

Add the import + type field, and replace the Like `<button>` in the footer with a self-contained picker (no Radix —
simpler + testable for a fixed 6-item row):

```tsx
import { useState } from 'react'
import { REACTIONS, type Reaction } from '../../../convex/lib/reactions'
// ...
export type PostWithAuthor = {
  // ...existing fields...
  suggestedReaction?: Reaction
}

function ReactionPicker({
  postId, suggested, onReact
}: { postId: Id<'posts'>; suggested: Reaction; onReact: (postId: Id<'posts'>, reaction: Reaction) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const current = REACTIONS.find(r => r.value === suggested) ?? REACTIONS[0]
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('reactions.react')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
      >
        {current.emoji} {t(current.labelKey)}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-md">
          {REACTIONS.map(r => (
            <button
              key={r.value}
              type="button"
              role="menuitem"
              aria-pressed={r.value === suggested}
              title={t(r.labelKey)}
              onClick={() => { onReact(postId, r.value); setOpen(false) }}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-lg outline-none ${r.value === suggested ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:bg-slate-100'}`}
            >
              <span aria-hidden="true">{r.emoji}</span>
              <span className="sr-only">{t(r.labelKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

In the footer JSX, replace the existing `👍 … Like` button with:

```tsx
            <ReactionPicker postId={post._id} suggested={post.suggestedReaction ?? 'LIKE'} onReact={onReact} />
```

And change the prop type:

```tsx
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
```

> The `accessible name` of each option is its label (via `sr-only`), so `getByRole('button', { name: /celebrate/i })`
> matches. The like-count display moves into/near the picker trigger if desired — not required for tests.

- [ ] **Step 4: Update `FeedPage.tsx`**

```tsx
              onReact={(id, reactionType) => react({ postId: id, reactionType, sessionToken: sessionToken ?? '' })}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter app exec vitest run app/src/components/PostCard.test.tsx`
Expected: PASS. Then `pnpm typecheck`.

- [ ] **Step 6:** Stop for review/commit.

---

### Task 10: CommentBox — AI drafting + language combobox + i18n

**Files:**

- Modify: `app/src/components/CommentBox.tsx`
- Modify: `app/src/i18n/locales/en.json`, `pt.json`, `es.json`

**Interfaces:**

- Consumes: `api.ai.comments.generateComment` (T7), `api.users.getMe` (`commentLanguage`), `LANGUAGE_CODES`/
  `languageLabel`/`resolveCommentLanguage`/`AUTO_LANGUAGE` (T2), `VirtualizedCombobox`.

- [ ] **Step 1: Add i18n keys**

```jsonc
// en.json — extend "comment":
  "comment": {
    "placeholder": "Write a comment…",
    "cancel": "Cancel",
    "submit": "Post to LinkedIn",
    "submitting": "Posting...",
    "generate": "Generate with AI",
    "regenerate": "Regenerate",
    "generating": "Generating…",
    "language": "Comment language",
    "languageAuto": "Auto — match the post",
    "generateError": "Couldn't generate a comment. Please try again."
  },
```

| key                   | pt.json                                                | es.json                                               |
|-----------------------|--------------------------------------------------------|-------------------------------------------------------|
| comment.generate      | Gerar com IA                                           | Generar con IA                                        |
| comment.regenerate    | Gerar novamente                                        | Regenerar                                             |
| comment.generating    | Gerando…                                               | Generando…                                            |
| comment.language      | Idioma do comentário                                   | Idioma del comentario                                 |
| comment.languageAuto  | Automático — idioma da publicação                      | Automático — idioma de la publicación                 |
| comment.generateError | Não foi possível gerar um comentário. Tente novamente. | No se pudo generar un comentario. Inténtalo de nuevo. |

(Also drop the "(AI suggestions coming soon)" suffix from the pt/es `comment.placeholder`.)

- [ ] **Step 2: Implement the drafting controls + language combobox**

Edit `CommentBox.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { VirtualizedCombobox } from './VirtualizedCombobox'
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'
import type { Id } from '../../../convex/_generated/dataModel'

export default function CommentBox({ postId, sessionToken, onClose }: {
  postId: Id<'posts'>; sessionToken: string; onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const comment = useAction(api.interactions.commentOnPost)
  const generate = useAction(api.ai.comments.generateComment)

  const me = useQuery(api.users.getMe, { sessionToken }) as { commentLanguage?: string } | null | undefined
  const uiLang = i18n.language?.split('-')[0] ?? 'en'
  const [language, setLanguage] = useState<string>(() => resolveCommentLanguage(me?.commentLanguage))
  const languageOptions = useMemo(
    () => [
      { value: AUTO_LANGUAGE, label: t('comment.languageAuto') },
      ...LANGUAGE_CODES.map(c => ({ value: c, label: languageLabel(c, uiLang) })).sort((a, b) => a.label.localeCompare(b.label))
    ],
    [t, uiLang]
  )
  const [hasDraft, setHasDraft] = useState(false)

  async function handleGenerate() {
    setGenerating(true); setError(null)
    try {
      const { comment: draft } = await generate({ postId, sessionToken, language })
      setText(draft); setHasDraft(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('comment.generateError'))
    } finally {
      setGenerating(false)
    }
  }
  // ...keep existing handleSubmit...
```

In the JSX, add a controls row above/below the textarea (combobox + Generate/Regenerate):

```tsx
      <div className="mb-2 flex items-center gap-2">
        <div className="w-56">
          <VirtualizedCombobox
            options={languageOptions}
            value={language}
            onChange={v => setLanguage(v === '' ? AUTO_LANGUAGE : v)} {/* re-select clears to '' — treat as auto */}
            ariaLabel={t('comment.language')}
            placeholder={t('comment.languageAuto')}
          />
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md border border-blue-500 px-3 py-1.5 text-[13px] font-semibold text-blue-600 disabled:opacity-60"
        >
          {generating ? t('comment.generating') : hasDraft ? t('comment.regenerate') : t('comment.generate')}
        </button>
      </div>
```

- [ ] **Step 3: Verify gate**

Run: `pnpm typecheck` then `pnpm --filter app exec vitest run` (existing CommentBox has no test; ensure nothing else
breaks).
Expected: PASS. Manually confirm Generate fills the textarea and the language combobox defaults to Auto.

- [ ] **Step 4:** Stop for review/commit.

---

### Task 11: Settings — "AI Comments" section

**Files:**

- Modify: `app/src/pages/SettingsPage.tsx`
- Modify: `app/src/i18n/locales/en.json`, `pt.json`, `es.json`

**Interfaces:**

- Consumes: `api.users.setCommentLanguage` (T8), `LANGUAGE_CODES`/`languageLabel`/`resolveCommentLanguage`/
  `AUTO_LANGUAGE` (T2), `VirtualizedCombobox`.

- [ ] **Step 1: Add i18n keys**

```jsonc
// en.json — extend "settings":
    "aiComments": "AI Comments",
    "aiCommentsNote": "Default language for AI-drafted comments. You can override it per comment.",
    "commentLanguage": "Default comment language",
```

| key                      | pt.json                                                                               | es.json                                                                                         |
|--------------------------|---------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| settings.aiComments      | Comentários com IA                                                                    | Comentarios con IA                                                                              |
| settings.aiCommentsNote  | Idioma padrão dos comentários gerados por IA. Você pode alterá-lo em cada comentário. | Idioma predeterminado de los comentarios generados por IA. Puedes cambiarlo en cada comentario. |
| settings.commentLanguage | Idioma padrão do comentário                                                           | Idioma predeterminado del comentario                                                            |

- [ ] **Step 2: Add the section + state + save** (extend `MeProfile` with `commentLanguage?: string`)

```tsx
// near other imports:
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'

// in MeProfile interface: add
  commentLanguage?: string

// hooks:
  const setCommentLanguage = useMutation(api.users.setCommentLanguage)
  const [commentLang, setCommentLang] = useState<string>('auto')
  const [commentLangDirty, setCommentLangDirty] = useState(false)
  const [commentLangSaving, setCommentLangSaving] = useState(false)
  const [commentLangSaved, setCommentLangSaved] = useState(false)
  const meCommentLanguage = me?.commentLanguage
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror server value until user edits
    if (!commentLangDirty) setCommentLang(resolveCommentLanguage(meCommentLanguage))
  }, [meCommentLanguage, commentLangDirty])

  const commentLangOptions = [
    { value: AUTO_LANGUAGE, label: t('comment.languageAuto') },
    ...LANGUAGE_CODES.map(c => ({ value: c, label: languageLabel(c, lang) })).sort((a, b) => a.label.localeCompare(b.label))
  ]

  async function handleSaveCommentLanguage() {
    if (!sessionToken) return
    setCommentLangSaving(true)
    try {
      await setCommentLanguage({ sessionToken, commentLanguage: commentLang })
      setCommentLangDirty(false)
      setCommentLangSaved(true)
      setTimeout(() => setCommentLangSaved(false), 3000)
    } finally {
      setCommentLangSaving(false)
    }
  }
```

Add the section (after the "LinkedIn Identity" `</section>`):

```tsx
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 mt-0 text-base font-semibold text-slate-900">{t('settings.aiComments')}</h2>
        <p className="mb-3 mt-0 text-[13px] text-slate-500">{t('settings.aiCommentsNote')}</p>
        <div className="mb-1 text-sm font-medium text-slate-700">{t('settings.commentLanguage')}</div>
        <VirtualizedCombobox
          options={commentLangOptions}
          value={commentLang}
          onChange={v => { setCommentLang(v === '' ? AUTO_LANGUAGE : v); setCommentLangDirty(true) }}
          ariaLabel={t('settings.commentLanguage')}
          placeholder={t('comment.languageAuto')}
        />
        <div className="mt-3">
          <button
            onClick={handleSaveCommentLanguage}
            disabled={commentLangSaving}
            className={`rounded-md border-none px-4 py-[7px] text-[13px] text-white transition-colors duration-300 ${commentLangSaved ? 'bg-green-500' : 'bg-blue-500'} ${commentLangSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            {commentLangSaved ? t('settings.saved') : commentLangSaving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </section>
```

- [ ] **Step 3: Verify gate**

Run: `pnpm typecheck` then `pnpm --filter app exec vitest run app/src/pages/SettingsPage.test.tsx`
Expected: PASS. Manually confirm the section saves and reloads the chosen language.

- [ ] **Step 4:** Stop for review/commit.

---

### Task 12: Env example + PLATFORM.md docs

**Files:**

- Modify: `convex/.env.local.example`
- Modify: `docs/PLATFORM.md`

- [ ] **Step 1: Document env vars** — append to `convex/.env.local.example`:

```bash
# DeepSeek (AI reaction prediction + comment drafting). Unset ⇒ AI features no-op.
# COMPLIANCE: set on the dev deployment ONLY during the test phase (see PLATFORM.md AI section).
DEEPSEEK_API_KEY=
# Optional model override (default: deepseek-v4-flash)
DEEPSEEK_MODEL=
```

- [ ] **Step 2: Update `docs/PLATFORM.md`**

- §5 Data Model → `posts.suggestedReaction` and `users.commentLanguage` rows.
- §10 → note `submitPost` schedules `internal.ai.reactions.predictReaction` after upsert.
- §11 Interactions → correct the reaction enum to `{LIKE,PRAISE,EMPATHY,INTEREST,APPRECIATION,ENTERTAINMENT}`; remove
  the "hard-codes LIKE" line; add the picker; add the `generateComment` 30/h rate-limit row.
- §16 Env Vars → `DEEPSEEK_API_KEY` (gate), `DEEPSEEK_MODEL`.
- New section **"AI Reaction & Comment Assistance"** (+ ToC entry) with the compliance gate, language-resolution chain,
  and a Mermaid diagram of the async reaction flow (copy from the spec).

- [ ] **Step 3: Verify gate**

Run: `pnpm verify` (format + lint + typecheck + all tests).
Expected: PASS. Stop for review/commit.

---

## Self-Review

**Spec coverage:**

- Reaction picker pre-selected to suggestion → Task 9. ✔
- Reaction enum alignment + `reactToPost` fix → Tasks 1, 3. ✔
- Async prediction on submit → Task 6. ✔
- `posts.suggestedReaction` / `users.commentLanguage` → Task 3. ✔
- Comment Generate/Regenerate (explicit) → Task 10. ✔
- All ISO 639-1 languages + Auto, default auto → Task 2; resolution → Tasks 7/10/11. ✔
- Settings default + per-comment override → Tasks 8, 10, 11. ✔
- DeepSeek client + prompts (the two prompts) → Tasks 4, 5. ✔
- Rate limit 30/h `generateComment` → Task 7. ✔
- Env gate + compliance + docs → Task 12. ✔
- `feed.ts` — **intentionally untouched**: `getFeed` spreads `{ ...post }`, so `suggestedReaction` flows automatically (
  verified). `getMe` likewise via `toSafeMe`.

**Placeholder scan:** No "TBD/TODO/handle edge cases". `LANGUAGE_CODES` is the full ISO 639-1 set (real data). UI
snippets show complete handlers; `// ...keep existing handleSubmit...` refers to code already in the file being
modified, not an unwritten function.

**Type consistency:** `Reaction`, `reactionValidator`, `REACTIONS` (T1) used identically in T3/T6/T9.
`resolveCommentLanguage`/`AUTO_LANGUAGE`/`languageLabel`/`LANGUAGE_CODES` (T2) consistent across T7/T10/T11.
`onReact: (postId, reaction) => void` matches between PostCard (T9) and FeedPage (T9).
`generateComment({ sessionToken, postId, language? }) → { comment }` matches T7 ↔ T10.

**Known integration gotchas encoded:** VirtualizedCombobox re-select-clears-to-`''` → handlers map `'' → auto` (T10,
T11). Picker is self-contained (no Radix) for jsdom-testability (T9).
