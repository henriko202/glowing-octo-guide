import { useCurrentFrame } from 'remotion'
import { C, SANS, XF } from './brand'
import type { Layout } from './layouts'
import { exitStyle } from './motion'

export const BADGE_H = 1.5 // the pill's height per px of text: one line plus a quarter of the size above and below

// The 15 s cut's gold badge, the landing's 1-month banner as a pill: on screen from the first frame, so a feed that
// shows only the opening seconds still shows the offer, and gone XF frames after `out`, as the end card takes over.
// It stands still (Ad.tsx undoes the camera drift) and fades without rising, so the 9:16's pill never crosses the
// Instagram Feed's crop line just above it (layouts.ts); only the fade's blur glows over it.
export function Badge({ text, out, box }: { text: string; out: number; box: NonNullable<Layout['badge']> }) {
  const frame = useCurrentFrame()
  if (frame >= out + XF) return null
  const { x, w, top, size, align } = box
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        width: w,
        top,
        display: 'flex',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        ...exitStyle(frame, out, 0)
      }}
    >
      <div
        style={{
          padding: `${size / 4}px ${size * 0.8}px`,
          borderRadius: 999,
          background: C.gold,
          color: C.onGold,
          fontFamily: SANS,
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: 'nowrap'
        }}
      >
        {text}
      </div>
    </div>
  )
}
