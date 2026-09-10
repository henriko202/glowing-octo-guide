import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Crawling policy (owner decision, 2026-09-10): everything may crawl the landing, including
// AI training crawlers. The explicit lists document the intent so a future rule cannot drop a
// class of crawler by accident; the `*` rule already allows every one of them.
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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: SEARCH_AND_CITATION_BOTS, allow: '/' },
      { userAgent: AI_TRAINING_BOTS, allow: '/' }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: new URL(SITE_URL).host
  }
}
