// convex/lib/articleValidator.ts
import {type Infer, v} from 'convex/values'

/**
 * Structured data for the article a post links to (e.g. a LinkedIn Pulse article),
 * captured best-effort on manual submission to seed a future AI-comment feature.
 *
 * Shared by the `posts` schema and the `upsertPost` mutation args so the two can never
 * drift. The article's full body text is parsed from the guest SSR page, alongside its
 * title / summary / author / images. `url` is the clean canonical article URL; everything
 * else is optional because parsing is best-effort.
 */
export const articleValidator = v.object({
  url: v.string(),
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  text: v.optional(v.string()),
  author: v.optional(v.string()),
  imageUrls: v.array(v.string())
})

export type ArticleData = Infer<typeof articleValidator>
