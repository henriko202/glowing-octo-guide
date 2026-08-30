import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Page-scroll model — the window is the scroller (see AppShell), so the declarative router never
// resets scroll on a client-side route change and a scrolled feed carries its scroll into the next
// page. Reset to top whenever the pathname changes; skip when the URL targets an in-page #anchor so
// the browser can still jump to it.
// ponytail: scroll-to-top, not full restoration — Back also lands at the top rather than remembering
// the feed's position. Add key-based restoration (sessionStorage + POP detection) if that's wanted.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}
