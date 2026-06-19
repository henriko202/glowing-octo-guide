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
export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
export type ChatMessage = { role: 'system' | 'user'; content: string | ContentPart[] }

const PROVIDER_ROUTING = {
  data_collection: 'deny',
  zdr: true
} as const

export async function callOpenRouter(messages: ChatMessage[], opts: { action: string }): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set')
    throw new Error(`Failed to ${opts.action}. AI is not configured.`)
  }
  const model = process.env.OPENROUTER_MODEL ?? 'google/gemma-4-26b-a4b-it:floor'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  // Optional attribution headers (OpenRouter rankings) — only sent when configured.
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL
  if (process.env.OPENROUTER_SITE_NAME) headers['X-Title'] = process.env.OPENROUTER_SITE_NAME

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, stream: false, provider: PROVIDER_ROUTING })
  })
  if (!res.ok) {
    console.error(`OpenRouter ${opts.action} failed: ${res.status}`, await res.text())
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
