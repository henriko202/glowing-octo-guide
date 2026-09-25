// convex/ai/prompts.ts
// PURE prompt builders — no Convex/server imports, so they unit-test directly.
import { type ChatMessage, type ContentPart } from './openrouter'
import { AUTO_LANGUAGE, languageLabel } from '../lib/languages'
import { INDUSTRIES } from '../lib/profileOptions'

// Safety net for the article body (real LinkedIn articles are far smaller; this only guards against
// a pathological page). The post content itself is LinkedIn-bounded, so it is sent whole.
const ARTICLE_MAX = 40000
// Cap the number of images attached per request (vision cost + context).
const MAX_IMAGES = 6
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

interface ArticleInput {
  title?: string
  summary?: string
  text?: string
  author?: string
  imageUrls?: string[]
}
export interface ReactionPromptPost {
  content: string
  imageUrls?: string[]
  article?: ArticleInput
}
export interface CommentPromptPost {
  content: string
  mediaUrls: string[]
  imageUrls?: string[]
  author?: { name?: string; headline?: string } | null
  article?: ArticleInput
}

/** Post images + article images, de-duplicated and capped. */
function collectImages(post: { imageUrls?: string[]; article?: { imageUrls?: string[] } }): string[] {
  const all = [...(post.imageUrls ?? []), ...(post.article?.imageUrls ?? [])]
  return [...new Set(all)].slice(0, MAX_IMAGES)
}

/** A user message: plain text, or text + attached images (multimodal) when any are present. */
function userMessage(text: string, images: string[]): ChatMessage {
  if (images.length === 0) return { role: 'user', content: text }
  const parts: ContentPart[] = [
    { type: 'text', text },
    ...images.map(url => ({ type: 'image_url' as const, image_url: { url } }))
  ]
  return { role: 'user', content: parts }
}

/** Linked-article block: title, summary, then the full body (if available). */
function articleBlock(article: ArticleInput | undefined): string {
  if (!article || !(article.title || article.summary || article.text)) return ''
  let block = `\n\nLinked article — "${article.title ?? ''}"${article.author ? ` by ${article.author}` : ''}:`
  if (article.summary) block += `\n${article.summary}`
  if (article.text) block += `\n${trunc(article.text, ARTICLE_MAX)}`
  return block
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
  const images = collectImages(post)
  let text = `Post:\n${post.content ?? ''}`
  text += articleBlock(post.article)
  if (images.length) text += `\n\n(The post's image(s) are attached.)`
  text += `\n\nMost fitting reaction:`
  return [{ role: 'system', content: REACTION_SYSTEM }, userMessage(text, images)]
}

const INDUSTRY_SYSTEM = `You read a LinkedIn post and pick the industry its AUTHOR works in, from LinkedIn's industry list below. Judge where the author works, which can differ from the post's topic (a recruiter posting about software jobs works in Staffing and Recruiting). Reply with ONLY the numeric code, nothing else. If the post gives no clear sign of the author's industry, reply NONE.

${INDUSTRIES.map(i => `${i.code}: ${i.label}`).join('\n')}`

/** Asks for the industry code of the person who WROTE the post (the member's own, verified post). */
export function buildIndustryPrompt(content: string): ChatMessage[] {
  return [
    { role: 'system', content: INDUSTRY_SYSTEM },
    { role: 'user', content: `Post:\n${content}\n\nIndustry code:` }
  ]
}

export function buildCommentPrompt(post: CommentPromptPost, language: string): ChatMessage[] {
  const languageLine =
    language === AUTO_LANGUAGE
      ? 'Write the comment in the same language as the post below.'
      : `Write the comment in ${languageLabel(language, 'en')} (${language}).`

  const system = `You help a LinkedIn user write a genuine, useful comment on someone else's post. Follow every rule:
- At most 2 short paragraphs. Concise.
- Add something of value: a specific insight, a genuine reflection, or just a praise about the topic and how it's important.
- Sound like a real professional speaking in the first person. Warm, not sycophantic.
- No hashtags. Do not @-mention anyone. Avoid emojis (at most one, only if it truly fits).
- Do not restate or quote the post at length.
- DO NOT ADD EM DASHES. NEVER USE EM DASHES.
- ${languageLine}
Reply with ONLY the comment text — no preamble, no surrounding quotation marks.`

  const images = collectImages(post)

  let text = ''
  if (post.author?.name) {
    text += `Post author: ${post.author.name}${post.author.headline ? ` — ${post.author.headline}` : ''}\n`
  }
  text += `Post:\n${post.content ?? ''}`
  text += articleBlock(post.article)
  if (images.length) text += `\n\n(The post's image(s) are attached for you to consider.)`

  // Any non-image media (documents / links) the model can't view — list as plain context.
  const imageSet = new Set([...(post.imageUrls ?? []), ...(post.article?.imageUrls ?? [])])
  const otherMedia = (post.mediaUrls ?? []).filter(u => !imageSet.has(u))
  if (otherMedia.length) text += `\n\nThe post also links (not viewable): ${otherMedia.join(', ')}`

  text += `\n\nWrite the comment now.`
  return [{ role: 'system', content: system }, userMessage(text, images)]
}
