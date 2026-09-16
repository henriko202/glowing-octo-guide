import { SITE_URL } from '@/lib/site'

// Crawling policy (owner decision, 2026-09-10): everything may crawl the landing, including AI
// training crawlers. The explicit lists document the intent so a future rule cannot drop a class
// of crawler by accident; the `*` rule already allows every one of them.
//
// `Content-Signal` (contentsignals.org, draft-romm-aipref-contentsignals) states the same policy in
// machine-readable form: training, search, and AI input are all allowed. It is a group directive, so
// it is emitted inside every user-agent group — a specific group shadows `*` in robots.txt, and a
// directive outside a group is ignored by parsers.
//
// Served as a route handler instead of the `app/robots.ts` metadata route because the metadata
// route API cannot emit the `Content-Signal` directive.

const CONTENT_SIGNAL = 'ai-train=yes, search=yes, ai-input=yes'

const SEARCH_AND_CITATION_BOTS = [
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Claude-User'
]

const AI_TRAINING_BOTS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Meta-ExternalAgent',
  'Bytespider',
  'cohere-ai'
]

export const dynamic = 'force-static'

function group(agents: readonly string[]) {
  return [...agents.map(agent => `User-Agent: ${agent}`), `Content-Signal: ${CONTENT_SIGNAL}`, 'Allow: /'].join('\n')
}

export function GET() {
  const body = [
    group(['*']),
    group(SEARCH_AND_CITATION_BOTS),
    group(AI_TRAINING_BOTS),
    `Host: ${new URL(SITE_URL).host}\nSitemap: ${SITE_URL}/sitemap.xml`,
    ''
  ].join('\n\n')
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
