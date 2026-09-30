import { useMemo } from 'react'
import { AbsoluteFill, random, useCurrentFrame } from 'remotion'
import { C, SERIF, XF } from '../brand'
import type { AdCopy } from '../copy'
import type { Layout } from '../layouts'
import { exitStyle, progress, STAGGER, Words } from '../motion'
import type { Timeline } from '../timelines'

const RING_LIFE = 72 // frames for a ring to grow to RING_MAX
const RING_MAX = 1040 // px: past the farthest dot, so every dot lights up fully

// The layout's number of dots at seeded random() positions over the whole frame, so every render is identical. They
// keep clear of the text box, the node and each other, and stay within the first ring's reach so each one lights up
// fully. `d` is the distance to the node, which sets the frame the first ring lights the dot.
function makeDots({ width, height, home, opening }: Layout) {
  const { box, dots: count } = opening
  const dots: { x: number; y: number; r: number; d: number }[] = []
  for (let i = 0; dots.length < count && i < 5000; i++) {
    const x = 40 + random(`x${i}`) * (width - 80)
    const y = 40 + random(`y${i}`) * (height - 80)
    const d = Math.hypot(x - home.x, y - home.y)
    const inText = x > box.x - 30 && x < box.x + box.w + 30 && y > box.y - 30 && y < box.y + box.h + 30
    if (inText || d <= 100 || d > RING_MAX - 80 || dots.some(dot => Math.hypot(dot.x - x, dot.y - y) < 80)) continue
    dots.push({ x, y, r: 4 + random(`r${i}`) * 3, d })
  }
  return dots
}

export function Opening({ copy, layout, timeline }: { copy: AdCopy; layout: Layout; timeline: Timeline }) {
  const frame = useCurrentFrame()
  const dots = useMemo(() => makeDots(layout), [layout])
  const { home, opening } = layout
  const { hook, rings, promise: promiseAt } = timeline.opening
  const reach = RING_MAX * progress(frame, rings[0], RING_LIFE)
  const line2At = promiseAt + copy.promise[0].split(' ').length * STAGGER + 6
  return (
    <AbsoluteFill>
      <svg
        width={layout.width}
        height={layout.height}
      >
        {rings.map(at => {
          const p = progress(frame, at, RING_LIFE)
          if (p <= 0 || p >= 1) return null
          return (
            <circle
              key={at}
              cx={home.x}
              cy={home.y}
              r={RING_MAX * p}
              fill="none"
              stroke={C.gold}
              strokeWidth={3}
              opacity={0.5 * (1 - p)}
            />
          )
        })}
        {dots.map((dot, i) => {
          // 0 → 1 as the first ring passes the dot: it swells for a moment and stays lit.
          const lit = Math.min(1, Math.max(0, (reach - dot.d) / 80))
          return (
            <circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={dot.r * (1 + 0.6 * Math.sin(Math.PI * lit))}
              fill={C.cream}
              opacity={0.22 + 0.68 * lit}
            />
          )
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: opening.box.x,
          width: opening.box.w,
          top: opening.box.y,
          height: opening.box.h,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: SERIF,
          fontWeight: 600,
          color: C.cream,
          textWrap: 'balance'
        }}
      >
        {frame < hook.out + XF ? (
          <div style={{ fontSize: opening.hook, lineHeight: 1.1, ...exitStyle(frame, hook.out) }}>
            <Words
              text={copy.hook}
              start={hook.at}
            />
          </div>
        ) : (
          <>
            <div style={{ fontSize: opening.promise, lineHeight: 1.05 }}>
              <Words
                text={copy.promise[0]}
                start={promiseAt}
              />
            </div>
            <div style={{ fontSize: opening.promise, lineHeight: 1.05, color: C.goldText }}>
              <Words
                text={copy.promise[1]}
                start={line2At}
              />
            </div>
          </>
        )}
      </div>
    </AbsoluteFill>
  )
}
