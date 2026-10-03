import type { CSSProperties } from 'react'
import { AbsoluteFill, spring, useCurrentFrame } from 'remotion'
import LogoMark from '../../../landing/components/LogoMark'
import { C, SANS, SERIF } from '../brand'
import type { AdCopy } from '../copy'
import type { Layout } from '../layouts'
import { enterStyle, progress, Words } from '../motion'
import { FPS, type Timeline } from '../timelines'

export const FINE_PRINT_LINE = 1.45 // the fine print's line height (layouts.ts sizes the end card's block with it)

// The logo's box, centered on the column: landing/components/LogoMark.tsx is 125 wide for every 200 tall.
function logoBox({ endCard }: Layout) {
  const w = (endCard.logo.h * 125) / 200
  return { left: endCard.x + endCard.w / 2 - w / 2, top: endCard.logo.top, w, h: endCard.logo.h }
}

// Where the gold "you" node lands (YouNode.tsx): on the logo's own node, which the reveal below never uncovers.
// Geometry of LogoMark.tsx: viewBox 11.5 3.2 25.5 40.8, node at (28.4, 7.6), r 2.4.
export function logoNode(layout: Layout) {
  const logo = logoBox(layout)
  const unit = logo.w / 25.5 // px per viewBox unit
  return { x: logo.left + (28.4 - 11.5) * unit, y: logo.top + (7.6 - 3.2) * unit, r: 2.4 * unit }
}

// The 30 s card: the logo, the brand, the button, the URL and the trial's fine print. With `monthFree` (the 15 s), the
// banner's first sentence is the title in gold, its second sits under it in the fine print's place, and the brand
// line goes.
export function EndCard({
  copy,
  monthFree,
  layout,
  timeline
}: {
  copy: AdCopy
  monthFree?: AdCopy['monthFree']
  layout: Layout
  timeline: Timeline
}) {
  const frame = useCurrentFrame()
  const { x, w, title, cta, url, finePrint, offer } = layout.endCard
  if (monthFree && !offer) throw new Error('This format has no end card for the 1-month offer (layouts.ts)')
  const at = timeline.endCard
  const logo = logoBox(layout)
  const centered: CSSProperties = { position: 'absolute', left: x, width: w, textAlign: 'center' }
  // The L rises from the bottom. The clip stops 20% from the top, so the logo's own node never shows.
  const reveal = progress(frame, at.reveal, 40)
  // The CTA pill pops in.
  const pop = spring({ frame: Math.max(0, frame - at.cta), fps: FPS, config: { damping: 12 } })
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: logo.left,
          top: logo.top,
          width: logo.w,
          height: logo.h,
          lineHeight: 0,
          color: C.gold,
          clipPath: `inset(${100 - 80 * reveal}% 0 0 0)`
        }}
      >
        <LogoMark />
      </div>
      {monthFree && offer ? (
        <div
          style={{
            ...centered,
            left: x + (w - offer.title.w) / 2,
            width: offer.title.w,
            top: offer.title.top,
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: offer.title.size,
            fontVariantNumeric: 'lining-nums', // Cormorant's default old-style 1 reads as an "ı"
            lineHeight: 1.05,
            color: C.goldText,
            textWrap: 'balance'
          }}
        >
          <Words
            text={monthFree.lines[0]}
            start={at.title}
          />
        </div>
      ) : (
        <div
          style={{
            ...centered,
            top: title.top,
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: title.size,
            letterSpacing: '0.025em',
            color: C.cream
          }}
        >
          <Words
            text="Link Into The SSI"
            start={at.title}
          />
        </div>
      )}
      <div
        style={{
          ...centered,
          top: monthFree && offer ? offer.cta : cta.top,
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            opacity: Math.min(1, pop * 1.5),
            transform: `scale(${0.6 + 0.4 * pop})`,
            // 22, 52 and 14 px at the square's 34 px
            padding: `${(cta.size * 22) / 34}px ${(cta.size * 52) / 34}px`,
            borderRadius: 999,
            background: C.gold,
            color: C.onGold,
            fontFamily: SANS,
            fontSize: cta.size,
            fontWeight: 600
          }}
        >
          {monthFree ? monthFree.cta : copy.cta}
          <span style={{ marginLeft: (cta.size * 14) / 34 }}>→</span>
        </div>
      </div>
      <div
        style={{
          ...centered,
          top: monthFree && offer ? offer.url : url.top,
          fontFamily: SANS,
          fontSize: url.size,
          fontWeight: 500,
          color: C.goldText,
          ...enterStyle(frame, at.url)
        }}
      >
        linkintothessi.com
      </div>
      {monthFree && offer ? (
        <div
          style={{
            ...centered,
            top: offer.note.top,
            fontFamily: SANS,
            fontSize: offer.note.size,
            fontWeight: 500,
            color: C.cream,
            ...enterStyle(frame, at.finePrint)
          }}
        >
          {monthFree.lines[1]}
        </div>
      ) : (
        <div
          style={{
            ...centered,
            top: finePrint.top,
            fontFamily: SANS,
            fontSize: finePrint.size,
            lineHeight: FINE_PRINT_LINE,
            color: C.muted,
            textWrap: 'balance',
            ...enterStyle(frame, at.finePrint)
          }}
        >
          {copy.finePrint}
        </div>
      )}
    </AbsoluteFill>
  )
}
