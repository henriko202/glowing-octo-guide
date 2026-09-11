// convex/ai/openrouter.ts
// Single seam for LLM chat calls via OpenRouter (OpenAI-compatible). Mirrors linkedin/client.ts:
// owns auth + the log-real-error→throw-sanitized policy. Uses fetch() — NO "use node".
//
// PRIVACY: every request is pinned to DeepInfra's fp8 endpoint with NO fallback, and routed ONLY to
// providers that do not retain prompts (`zdr`) and do not train on / store data (`data_collection:
// "deny"`). These are compliance-critical and intentionally NOT env-overridable. See docs/compliance
// + PLATFORM.md §11A.
// Content is either plain text or, for multimodal (vision) requests, an array of parts mixing
// text with image_url parts (OpenAI-compatible). callOpenRouter just JSON-stringifies it.
import { env } from '../_generated/server'
import { scrubError } from '../lib/scrubError'
import { fetchWithTimeout } from '../lib/fetchWithTimeout'

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
export type ChatMessage = { role: 'system' | 'user'; content: string | ContentPart[] }

const PROVIDER_ROUTING = {
  data_collection: 'deny',
  zdr: true
} as const

export async function callOpenRouter(messages: ChatMessage[], opts: { action: string }): Promise<string> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set')
    throw new Error(`Failed to ${opts.action}. AI is not configured.`)
  }
  const model = env.OPENROUTER_MODEL ?? 'google/gemma-4-26b-a4b-it'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  // Optional attribution headers (OpenRouter rankings) — only sent when configured.
  if (env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = env.OPENROUTER_SITE_URL
  if (env.OPENROUTER_SITE_NAME) headers['X-Title'] = env.OPENROUTER_SITE_NAME

  // 60s: LLM generation legitimately runs many seconds (prompts carry full article text), longer
  // than the 15s default seams.
  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: false, provider: PROVIDER_ROUTING })
    },
    60_000
  )
  if (!res.ok) {
    const body = await res.text()
    // The response body can carry the request's post/article content back — scrub + cap it before
    // it reaches Convex's function logs.
    console.error(`OpenRouter ${opts.action} failed: ${res.status}`, scrubError(body))
    // Model-not-found is OpenRouter's documented 404 case: a permanent misconfig, not a transient
    // blip — throw a distinct message so it isn't mistaken for "try again".
    // ponytail: not matching 400s here — a 400 can also mean context-length-exceeded (realistic,
    // prompts carry full article text), and /model/i on the body would mislabel that as misconfig.
    if (res.status === 404) {
      throw new Error('AI model misconfigured.')
    }
    throw new Error(`Failed to ${opts.action}. Please try again.`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    console.error(`OpenRouter ${opts.action}: empty/invalid response`)
    throw new Error(`Failed to ${opts.action}. Please try again.`)
  }
  return text
}
