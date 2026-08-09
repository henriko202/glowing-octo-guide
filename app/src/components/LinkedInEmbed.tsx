import type { ReactNode } from 'react'

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
 * Renders a LinkedIn post as a clipped embed iframe. The iframe is rendered
 * taller than its container so the container's overflow:hidden clips LinkedIn's
 * native action bar at the bottom. An optional `footer` is overlaid at the
 * bottom (opaque) to cover that strip with app-owned controls.
 */
export default function LinkedInEmbed({
  urn,
  containerHeight = 420,
  iframeHeight = 480,
  footer
}: {
  urn: string
  containerHeight?: number
  iframeHeight?: number
  footer?: ReactNode
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ height: containerHeight }}
    >
      <iframe
        src={buildEmbedUrl(urn)}
        title="LinkedIn post"
        width="100%"
        height={iframeHeight}
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
