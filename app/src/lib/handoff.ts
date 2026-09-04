// Deep-link handoff helpers. The flow keeps the user in the app — button spinner + toast visible —
// for a brief beat, and only THEN opens the LinkedIn post. Because that open happens after the delay
// (outside the click gesture), a strict browser may popup-block the new tab; we fall back to same-tab
// navigation so the handoff still lands.

/** ms to keep the toast + button spinner on screen before handing the user off to LinkedIn. */
export const HANDOFF_DELAY_MS = 1500

export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Open `url` in a new tab, nulling `opener` for reverse-tabnabbing safety. If the browser blocks the
 * (deferred, gesture-less) popup, fall back to navigating the current tab so the handoff still lands.
 */
export function openLinkedIn(url: string): void {
  const tab = window.open(url, '_blank')
  if (tab) tab.opener = null
  else window.location.href = url
}
