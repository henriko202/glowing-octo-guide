import type { ReactNode } from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, XF } from './brand'
import { COPY, type Lang } from './copy'
import { type Format, LAYOUTS } from './layouts'
import { progress } from './motion'
import { Demo } from './scenes/Demo'
import { EndCard } from './scenes/EndCard'
import { Opening } from './scenes/Opening'
import { Soundtrack } from './Soundtrack'
import { type Length, TIMELINES } from './timelines'
import { YouNode } from './YouNode'

export type AdProps = { lang: Lang; format: Format; length: Length }

// Mounts a scene for frames [from, to). It fades in over the first XF frames and out over the last XF,
// scaling 0.98 → 1 on the way in and 1 → 1.02 on the way out (a camera push, not a slide).
function Crossfade({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  if (frame < from || frame >= to) return null
  const fadeIn = from === 0 ? 1 : progress(frame, from, XF)
  const fadeOut = to === durationInFrames ? 0 : progress(frame, to - XF, XF)
  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn * (1 - fadeOut),
        transform: `scale(${(0.98 + 0.02 * fadeIn) * (1 + 0.02 * fadeOut)})`
      }}
    >
      {children}
    </AbsoluteFill>
  )
}

export function Ad({ lang, format, length }: AdProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const copy = COPY[lang]
  const layout = LAYOUTS[format]
  const timeline = TIMELINES[length]
  const { cuts } = timeline
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 12% 8%, rgba(201, 150, 62, 0.16), transparent 55%), radial-gradient(circle at 90% 94%, rgba(0, 119, 181, 0.14), transparent 55%), ${C.ink}`
      }}
    >
      {/* The camera drift: the whole frame scales 1 → 1.03 over the ad. */}
      <AbsoluteFill style={{ transform: `scale(${interpolate(frame, [0, durationInFrames], [1, 1.03])})` }}>
        <Crossfade
          from={0}
          to={cuts.feed}
        >
          <Opening
            copy={copy}
            layout={layout}
            timeline={timeline}
          />
        </Crossfade>
        <Crossfade
          from={cuts.feed - XF}
          to={cuts.end}
        >
          <Demo
            copy={copy}
            layout={layout}
            timeline={timeline}
          />
        </Crossfade>
        <Crossfade
          from={cuts.end - XF}
          to={durationInFrames}
        >
          <EndCard
            copy={copy}
            layout={layout}
            timeline={timeline}
          />
        </Crossfade>
        <YouNode
          layout={layout}
          timeline={timeline}
        />
      </AbsoluteFill>
      <Soundtrack length={length} />
    </AbsoluteFill>
  )
}
