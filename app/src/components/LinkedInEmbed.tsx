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
    <div className="relative overflow-hidden" style={{ height: containerHeight }}>
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
      {footer && <div className="absolute bottom-0 left-0 right-0">{footer}</div>}
    </div>
  )
}
