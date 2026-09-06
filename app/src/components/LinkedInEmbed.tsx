import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Build a LinkedIn embed iframe URL from a post URN.
 *
 * LinkedIn references the same post under three URN namespaces with DIFFERENT
 * ids — urn:li:activity:{X}, urn:li:share:{Y}, urn:li:ugcPost:{Z}. The embed
 * endpoint accepts any valid form, so we preserve the stored namespace instead
 * of force-wrapping it as activity (which broke share/ugcPost embeds).
 * Colons are NOT URL-encoded — LinkedIn's embed endpoint requires raw colons.
 */
export function buildEmbedUrl(urn: string): string {
  if (urn.startsWith('urn:li:')) {
    return `https://www.linkedin.com/embed/feed/update/${urn}/`
  }
  // Fallback for malformed/legacy bare ids — wrap as an activity URN.
  const id = urn.split(':').pop() ?? ''
  return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${id}/`
}

/**
 * Build the "open this post on LinkedIn" URL for the engagement handoff — the deepest link
 * LinkedIn allows (there is no URL to focus the comment box or trigger a reaction; those happen
 * behind a click on the post page). Prefers the stored sourceUrl (most accurate); otherwise
 * reconstructs LinkedIn's documented thread permalink `/feed/update/<activityUrn>/`. Colons are
 * left RAW — LinkedIn's router (like the embed endpoint) does not match a percent-encoded URN.
 * urn:li:ugcPost and urn:li:activity ids can differ, so sourceUrl is always preferred.
 */
export function buildPostUrl(urn: string, sourceUrl?: string): string {
  if (sourceUrl) return sourceUrl
  return `https://www.linkedin.com/feed/update/${urn}/`
}

/**
 * Renders a LinkedIn post as a fixed-height clipped embed iframe, with an app-owned
 * `footer` overlaid opaquely at the bottom to cover LinkedIn's native action bar.
 *
 * The height is a HEURISTIC, not a precise clip: the embed is cross-origin and emits
 * no resize message, so we cannot know a post's real height. Consequences of a fixed
 * `containerHeight` (overflow:hidden clips everything below it):
 *   - post TALLER than the box → its native bar is below the fold (hidden); the footer
 *     just covers the bottom strip of real content.
 *   - post SHORTER than the box → content ends above the footer, so the native bar can
 *     sit in the gap and peek out above our footer.
 * So `containerHeight` is tuned a bit BELOW the typical post height: the common (media)
 * post overflows and its native bar drops out of view; only unusually short posts show
 * a sliver. Making the iframe taller than the container does NOT help — overflow already
 * clips at `containerHeight` regardless of the iframe's own height.
 */
export default function LinkedInEmbed({
  urn,
  containerHeight = 400,
  footer
}: {
  urn: string
  containerHeight?: number
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div
      className="relative overflow-hidden pb-2 pl-2"
      style={{ height: containerHeight }}
    >
      <iframe
        src={buildEmbedUrl(urn)}
        title={t('linkedInEmbed.title')}
        width="100%"
        height="100%"
        className="block border-none"
        // sandbox: explicit whitelist — prevents the iframe from navigating the
        // top window, opening popups, or submitting forms.
        // allow-scripts: needed for LinkedIn's embed JS to render the post.
        // allow-same-origin: needed so LinkedIn's cookies work (avoids sign-in wall).
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      />
      {footer && <div className="absolute right-0 bottom-0 left-0">{footer}</div>}
    </div>
  )
}
