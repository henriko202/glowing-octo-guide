import { describe, expect, it } from 'vitest'
import {
  appendMediaLinks,
  extractArticleUrl,
  parseArticle,
  parsePostAuthor,
  parsePostContent,
  parsePostEngagement,
  type PostMedia
} from './parsePostContent'

describe('appendMediaLinks', () => {
  const media: PostMedia[] = [
    { type: 'image', url: 'https://media.licdn.com/img.jpg' },
    { type: 'article', url: 'https://example.com/article' }
  ]

  it('appends labeled links after the text with a blank-line separator', () => {
    expect(appendMediaLinks('Hello world', media)).toBe(
      'Hello world\n\n[image] https://media.licdn.com/img.jpg\n[article] https://example.com/article'
    )
  })

  it('returns only the labeled links when there is no text', () => {
    expect(appendMediaLinks('', media)).toBe(
      '[image] https://media.licdn.com/img.jpg\n[article] https://example.com/article'
    )
  })

  it('returns only the trimmed text when there is no media', () => {
    expect(appendMediaLinks('  Hello world  ', [])).toBe('Hello world')
  })

  it('returns an empty string when there is neither text nor media', () => {
    expect(appendMediaLinks('', [])).toBe('')
  })
})

describe('parsePostContent', () => {
  it('extracts articleBody text and image + article media from JSON-LD (preferring articleBody over og:description)', () => {
    const html = `<html><head>
      <meta property="og:description" content="Fallback description">
      <script type="application/ld+json">
      {"@type":"Article","url":"https://example.com/the-article","articleBody":"Excited to share our Q2 results!","image":"https://media.licdn.com/img1.jpg"}
      </script>
    </head></html>`
    const result = parsePostContent(html)
    expect(result.text).toBe('Excited to share our Q2 results!')
    expect(result.media).toEqual([
      { type: 'image', url: 'https://media.licdn.com/img1.jpg' },
      { type: 'article', url: 'https://example.com/the-article' }
    ])
  })

  it('falls back to og:description and captures og:image when there is no JSON-LD', () => {
    const html = `<head>
      <meta property="og:description" content="A post with an image">
      <meta property="og:image" content="https://media.licdn.com/photo.jpg">
    </head>`
    const result = parsePostContent(html)
    expect(result.text).toBe('A post with an image')
    expect(result.media).toEqual([{ type: 'image', url: 'https://media.licdn.com/photo.jpg' }])
  })

  it('captures document (slides) PDF links', () => {
    const html = `<head><meta property="og:description" content="Check out my slides"></head>
      <body><a href="https://media.licdn.com/dms/document/slides.pdf">Doc</a></body>`
    const result = parsePostContent(html)
    expect(result.text).toBe('Check out my slides')
    expect(result.media).toEqual([{ type: 'document', url: 'https://media.licdn.com/dms/document/slides.pdf' }])
  })

  it('decodes HTML entities in extracted URLs', () => {
    const html = `<meta property="og:image" content="https://media.licdn.com/p.jpg?a=1&amp;b=2">`
    const result = parsePostContent(html)
    expect(result.media).toEqual([{ type: 'image', url: 'https://media.licdn.com/p.jpg?a=1&b=2' }])
  })

  it('returns empty text and no media for HTML with nothing recognizable', () => {
    expect(parsePostContent('<html><body>nothing here</body></html>')).toEqual({ text: '', media: [] })
    expect(parsePostContent('')).toEqual({ text: '', media: [] })
  })

  it('preserves query-string tokens on document PDF links', () => {
    const html = `<a href="https://media.licdn.com/dms/document/slides.pdf?e=1&amp;t=TOKEN">Doc</a>`
    const result = parsePostContent(html)
    expect(result.media).toEqual([
      { type: 'document', url: 'https://media.licdn.com/dms/document/slides.pdf?e=1&t=TOKEN' }
    ])
  })

  it('ignores non-pdf URLs that merely contain .pdf earlier in the path', () => {
    const html = `<a href="https://example.com/file.pdf.zip">x</a>`
    const result = parsePostContent(html)
    expect(result.media).toEqual([])
  })

  it('extracts the shared article link from the post body anchor, not the "more from author" decoys', () => {
    // Mirrors real LinkedIn post HTML: the post's @type is SocialMediaPosting (NOT Article),
    // the article URL appears only as an <a data-test-id="article-content"> anchor, and the
    // page also lists other /pulse/ articles by the author that must be ignored.
    const html = `
      <meta property="og:image" content="https://media.licdn.com/cover.jpg">
      <script type="application/ld+json">
        {"@type":"SocialMediaPosting","articleBody":"My take on modern Java","image":{"@type":"ImageObject","url":"https://media.licdn.com/cover.jpg"}}
      </script>
      <a href="https://www.linkedin.com/pulse/why-modern-java-7wksf?trk=public_post_feed-article-content" data-tracking-control-name="public_post_feed-article-content" class="flex flex-col feed-article-content" data-test-id="article-content"><span>Read</span></a>
      <a href="https://www.linkedin.com/pulse/rise-ai-coding-tools-3cicf?trk=public_post">More by author</a>
      <a href="https://www.linkedin.com/pulse/using-selenium-ai-ovtrf?trk=public_post">More by author</a>`
    const result = parsePostContent(html)
    expect(result.text).toBe('My take on modern Java')
    expect(result.media).toContainEqual({
      type: 'article',
      url: 'https://www.linkedin.com/pulse/why-modern-java-7wksf'
    })
    expect(result.media).toContainEqual({ type: 'image', url: 'https://media.licdn.com/cover.jpg' })
    expect(result.media.some(m => m.url.includes('rise-ai-coding-tools'))).toBe(false)
    expect(result.media.some(m => m.url.includes('using-selenium-ai'))).toBe(false)
  })
})

describe('extractArticleUrl', () => {
  // Real LinkedIn post HTML marks the primary shared article with data-test-id="article-content"
  // and a feed-article-content class/tracking name. "More from author" links lack those markers,
  // so they must never be selected. Tracking query params are stripped to a clean canonical URL.
  const html = `
    <a href="https://www.linkedin.com/pulse/why-modern-java-more-exciting-than-ever-backend-junior-nakamura-7wksf?trk=public_post_feed-article-content" target="_self" data-tracking-control-name="public_post_feed-article-content" data-tracking-will-navigate class="flex flex-col feed-article-content" data-test-id="article-content"><span>Read</span></a>
    <a href="https://www.linkedin.com/pulse/rise-ai-coding-tools-has-created-common-misconception-junior-nakamura-3cicf?trk=public_post" data-tracking-control-name="public_post">Another</a>
    <a href="https://www.linkedin.com/pulse/using-selenium-ai-improve-test-automation-junior-nakamura-ovtrf?trk=public_post">Another</a>`

  it('returns the primary shared article URL with tracking params stripped', () => {
    expect(extractArticleUrl(html)).toBe(
      'https://www.linkedin.com/pulse/why-modern-java-more-exciting-than-ever-backend-junior-nakamura-7wksf'
    )
  })

  it('never selects a "more from author" decoy link', () => {
    const url = extractArticleUrl(html)
    expect(url).not.toContain('rise-ai-coding-tools')
    expect(url).not.toContain('using-selenium-ai')
  })

  it('returns null when the post shares no article', () => {
    expect(extractArticleUrl('<a href="https://www.linkedin.com/feed/">home</a>')).toBeNull()
    expect(extractArticleUrl('')).toBeNull()
  })

  it('rejects a non-LinkedIn host even when the article-content marker is present (SSRF guard)', () => {
    const evil = `<a data-test-id="article-content" href="https://evil.example.com/pulse/x?trk=public_post_feed-article-content">x</a>`
    expect(extractArticleUrl(evil)).toBeNull()
  })

  it('decodes HTML entities in the extracted href', () => {
    const html = `<a data-test-id="article-content" href="https://www.linkedin.com/pulse/a-b?trk=x&amp;utm=y">x</a>`
    expect(extractArticleUrl(html)).toBe('https://www.linkedin.com/pulse/a-b')
  })
})

describe('parseArticle', () => {
  // Mirrors a real LinkedIn Pulse article guest page: a single @type:Article JSON-LD block
  // where `name` is the title and `headline` is the intro/summary (LinkedIn's unusual mapping),
  // plus og: tags.
  const html = `
    <meta property="og:title" content="Why Modern Java Is More Exciting Than Ever for Backend Engineers">
    <meta property="og:description" content="Java continues to evolve much faster than many developers realize.">
    <meta property="og:image" content="https://media.licdn.com/cover.jpg">
    <script type="application/ld+json">
      {"@type":"Article","name":"Why Modern Java Is More Exciting Than Ever for Backend Engineers","headline":"Java continues to evolve much faster than many developers realize.","url":"https://www.linkedin.com/pulse/why-modern-java-7wksf","image":{"@type":"ImageObject","url":"https://media.licdn.com/cover.jpg"},"author":{"@type":"Person","name":"JUNIOR N.","url":"https://br.linkedin.com/in/junior-nakamura-developer"}}
    </script>`

  it('reads title from JSON-LD name, summary from headline, and author from author.name', () => {
    const result = parseArticle(html)
    expect(result.title).toBe('Why Modern Java Is More Exciting Than Ever for Backend Engineers')
    expect(result.summary).toBe('Java continues to evolve much faster than many developers realize.')
    expect(result.author).toBe('JUNIOR N.')
  })

  it('captures the cover image and de-duplicates it across JSON-LD and og:image', () => {
    expect(parseArticle(html).imageUrls).toEqual(['https://media.licdn.com/cover.jpg'])
  })

  it('falls back to og: tags when there is no JSON-LD', () => {
    const ogOnly = `
      <meta property="og:title" content="A Title">
      <meta property="og:description" content="A summary">
      <meta property="og:image" content="https://media.licdn.com/x.jpg">`
    const result = parseArticle(ogOnly)
    expect(result.title).toBe('A Title')
    expect(result.summary).toBe('A summary')
    expect(result.imageUrls).toEqual(['https://media.licdn.com/x.jpg'])
    expect(result.author).toBeUndefined()
    expect(result.text).toBeUndefined()
  })

  it('returns empty fields (and an empty image array) for unrecognized HTML', () => {
    expect(parseArticle('<html><body>nothing</body></html>')).toEqual({
      title: undefined,
      summary: undefined,
      text: undefined,
      author: undefined,
      imageUrls: []
    })
  })

  describe('full body extraction from article-content-blocks', () => {
    // Mirrors the real SSR structure: <article> → header (excluded) → article-content-blocks with
    // publishing-text-block <p>/<h3>/<pre>/list elements (the body) → </article> → comments + "more
    // articles" chrome (excluded). Sign-in chrome before/after must not leak into the extracted text.
    const articleHtml = `
      <a href="/uas/login?session_redirect=x">Sign in</a>
      <article class="article-main pulse">
        <figure class="cover-img"><img src="https://media.licdn.com/cover.jpg"></figure>
        <header>
          <h1 class="pulse-title">Why Modern Java Is More Exciting Than Ever for Backend Engineers</h1>
          <img data-delayed-url="https://media.licdn.com/avatar.jpg" alt="JUNIOR N.">
        </header>
        <div data-test-id="article-content-blocks">
          <div class="article-main__content" data-test-id="publishing-text-block">
            <p><span class>Java continues to evolve much faster than many developers realize.</span><!----></p>
          </div>
          <div class="article-main__content" data-test-id="publishing-text-block">
            <h3><span class>Scoped Values</span><!----></h3>
          </div>
          <div class="article-main__content" data-test-id="publishing-text-block">
            <img data-delayed-url="https://media.licdn.com/inline-body-image.jpg" alt="diagram">
          </div>
          <div class="article-main__content" data-test-id="publishing-text-block">
            <pre class="x"><span class>int x = 1;
if (x &gt; 0) {
  print(x);
}</span></pre>
          </div>
          <div class="article-main__content" data-test-id="publishing-text-block">
            <p><span class><ul><li><span class>Compact Object Headers</span><!----></li><li><span class>Generational Shenandoah GC</span><!----></li></ul></span><!----></p>
          </div>
          <div class="article-main__content" data-test-id="publishing-text-block">
            <p><span class>#Java #Java25 #SpringBoot</span><!----></p>
          </div>
        </div>
      </article>
      <div class="comments"><p class="comment__text">Thanks for sharing!!</p></div>
      <section class="stacked-articles"><p class="base-main-card__description">A teaser for another article</p></section>`

    it('extracts paragraphs, headings, list bullets and fenced code in document order', () => {
      const text = parseArticle(articleHtml).text ?? ''
      expect(text).toContain('Java continues to evolve much faster than many developers realize.')
      expect(text).toContain('Scoped Values')
      expect(text).toContain('- Compact Object Headers')
      expect(text).toContain('- Generational Shenandoah GC')
      expect(text).toContain('#Java #Java25 #SpringBoot')
      // Code: fenced, entities decoded, <span> wrapper stripped, internal newlines + indent preserved.
      expect(text).toContain('```')
      expect(text).toContain('int x = 1;\nif (x > 0) {')
      expect(text).toContain('  print(x);')
    })

    it('keeps blocks in document order separated by blank lines', () => {
      const text = parseArticle(articleHtml).text ?? ''
      expect(text.indexOf('Java continues to evolve')).toBeLessThan(text.indexOf('Scoped Values'))
      expect(text.indexOf('Scoped Values')).toBeLessThan(text.indexOf('Compact Object Headers'))
      expect(text).toContain('realize.\n\nScoped Values')
    })

    it('excludes sign-in chrome, comments and "more articles" cards', () => {
      const text = parseArticle(articleHtml).text ?? ''
      expect(text).not.toMatch(/sign in/i)
      expect(text).not.toContain('Thanks for sharing')
      expect(text).not.toContain('A teaser for another article')
    })

    it('captures inline body images but not the cover or the author avatar', () => {
      const result = parseArticle(articleHtml)
      expect(result.imageUrls).toContain('https://media.licdn.com/inline-body-image.jpg')
      expect(result.imageUrls).not.toContain('https://media.licdn.com/avatar.jpg')
      expect(result.imageUrls).not.toContain('https://media.licdn.com/cover.jpg')
    })
  })
})

describe('parsePostEngagement', () => {
  it('reads like + comment counts from a JSON-LD interactionStatistic array (string interactionType)', () => {
    const html = `<script type="application/ld+json">
      {"@type":"DiscussionForumPosting","interactionStatistic":[
        {"@type":"InteractionCounter","interactionType":"https://schema.org/LikeAction","userInteractionCount":142},
        {"@type":"InteractionCounter","interactionType":"https://schema.org/CommentAction","userInteractionCount":17}
      ]}
    </script>`
    expect(parsePostEngagement(html)).toEqual({ likeCount: 142, commentCount: 17 })
  })

  it('handles interactionType as an object and userInteractionCount as a string', () => {
    const html = `<script type="application/ld+json">
      {"interactionStatistic":[
        {"interactionType":{"@type":"LikeAction"},"userInteractionCount":"8"},
        {"interactionType":{"@type":"CommentAction"},"userInteractionCount":"3"}
      ]}
    </script>`
    expect(parsePostEngagement(html)).toEqual({ likeCount: 8, commentCount: 3 })
  })

  it('accepts a single (non-array) interactionStatistic object', () => {
    const html = `<script type="application/ld+json">
      {"interactionStatistic":{"interactionType":"https://schema.org/LikeAction","userInteractionCount":5}}
    </script>`
    expect(parsePostEngagement(html)).toEqual({ likeCount: 5, commentCount: 0 })
  })

  it('keeps the largest matching counter when multiple JSON-LD blocks are present', () => {
    const html = `
      <script type="application/ld+json">
      {"interactionStatistic":[{"interactionType":"LikeAction","userInteractionCount":2}]}
      </script>
      <script type="application/ld+json">
      {"interactionStatistic":[{"interactionType":"LikeAction","userInteractionCount":99}]}
      </script>`
    expect(parsePostEngagement(html)).toEqual({ likeCount: 99, commentCount: 0 })
  })

  it('returns zeros when there is no interactionStatistic or no JSON-LD at all', () => {
    expect(parsePostEngagement('<html><body>nothing</body></html>')).toEqual({ likeCount: 0, commentCount: 0 })
    expect(parsePostEngagement('')).toEqual({ likeCount: 0, commentCount: 0 })
    const noStats = `<script type="application/ld+json">{"@type":"Article","articleBody":"hi"}</script>`
    expect(parsePostEngagement(noStats)).toEqual({ likeCount: 0, commentCount: 0 })
  })

  it('coerces malformed / negative counts to 0', () => {
    const html = `<script type="application/ld+json">
      {"interactionStatistic":[
        {"interactionType":"LikeAction","userInteractionCount":"oops"},
        {"interactionType":"CommentAction","userInteractionCount":-4}
      ]}
    </script>`
    expect(parsePostEngagement(html)).toEqual({ likeCount: 0, commentCount: 0 })
  })
})

describe('parsePostAuthor', () => {
  it('extracts name + vanity from a SocialMediaPosting author (real-post shape)', () => {
    // Mirrors the real post JSON-LD: author is a Person with name + a profile url on a country subdomain.
    const html = `<script type="application/ld+json">
      {"@type":"SocialMediaPosting","articleBody":"hi","author":{"@type":"Person","name":"Mateus Yonemoto","url":"https://br.linkedin.com/in/mateus-yonemoto","image":{"@type":"ImageObject","url":"https://media.licdn.com/x.jpg"}}}
    </script>`
    expect(parsePostAuthor(html)).toEqual({ name: 'Mateus Yonemoto', vanity: 'mateus-yonemoto' })
  })

  it('handles a DiscussionForumPosting post type', () => {
    const html = `<script type="application/ld+json">
      {"@type":"DiscussionForumPosting","author":{"name":"Ana Souza","url":"https://www.linkedin.com/in/ana-souza"}}
    </script>`
    expect(parsePostAuthor(html)).toEqual({ name: 'Ana Souza', vanity: 'ana-souza' })
  })

  it('returns the post block author, never a nested comment author', () => {
    const html = `<script type="application/ld+json">
      {"@type":"SocialMediaPosting","author":{"name":"Real Poster","url":"https://www.linkedin.com/in/real-poster"},"comment":[{"@type":"Comment","author":{"name":"Some Commenter","url":"https://www.linkedin.com/in/commenter"}}]}
    </script>`
    expect(parsePostAuthor(html)).toEqual({ name: 'Real Poster', vanity: 'real-poster' })
  })

  it('returns the name but no vanity when author.url is missing', () => {
    const html = `<script type="application/ld+json">
      {"@type":"SocialMediaPosting","author":{"name":"No URL Person"}}
    </script>`
    expect(parsePostAuthor(html)).toEqual({ name: 'No URL Person', vanity: undefined })
  })

  it('drops a vanity that fails the accepted format (e.g. too short)', () => {
    const html = `<script type="application/ld+json">
      {"@type":"SocialMediaPosting","author":{"name":"Short Vanity","url":"https://www.linkedin.com/in/x"}}
    </script>`
    expect(parsePostAuthor(html)).toEqual({ name: 'Short Vanity', vanity: undefined })
  })

  it('returns {} when there is no post-typed JSON-LD block', () => {
    expect(
      parsePostAuthor(`<script type="application/ld+json">{"@type":"Article","author":{"name":"A"}}</script>`)
    ).toEqual({})
    expect(parsePostAuthor('<html>nothing</html>')).toEqual({})
  })
})
