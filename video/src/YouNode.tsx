import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C } from './brand'
import type { Layout } from './layouts'
import { progress, type Step, tapScale, track } from './motion'
import { TAPS } from './scenes/Demo'
import { logoNode } from './scenes/EndCard'
import type { Timeline } from './timelines'

// The gold "you" node, one layer above every scene. It lights up in the Opening, taps through the Demo and flies
// into the logo's node on the end card.
// The flight into the logo's node: 50 frames in every length (scripts/soundtrack.mjs sizes the glide to `dur`).
export const flight = ({ endCard }: Timeline) => ({ at: endCard.landed - 50, dur: 50, arc: 160 })
// Each tap's name, frame and stage position, in the order the node visits them.
const taps = ({ demo }: Timeline) =>
  (Object.keys(TAPS) as (keyof typeof TAPS)[]).map(name => ({ name, at: demo.taps[name], ...TAPS[name] }))

// Where the node's path stops, in frame coordinates. The taps are in the mock's stage coordinates (Demo.tsx), so each
// one moves by the layout's stage origin. layouts.ts checks every stop against the safe zone.
export function nodeStops(layout: Layout, timeline: Timeline) {
  const { home, stage } = layout
  const { sink, jump, lead, travel } = timeline.node
  const node = logoNode(layout)
  const fly = flight(timeline)
  return [
    // sinks as the Opening ends
    { at: sink, dur: 16, x: home.x, y: home.y + 70 },
    // jumps while hidden, next to the first tap
    { at: jump, dur: 1, x: stage.x + TAPS.comment.x + 90, y: stage.y + TAPS.comment.y + 60 },
    // leaves `lead` frames before each tap and takes `travel` frames to get there
    ...taps(timeline).map(tap => ({ at: tap.at - lead, dur: travel, x: stage.x + tap.x, y: stage.y + tap.y })),
    { at: fly.at, dur: fly.dur, x: node.x, y: node.y }
  ]
}

export function YouNode({ layout, timeline }: { layout: Layout; timeline: Timeline }) {
  const f = useCurrentFrame()
  const { home, stage } = layout
  const { opening, demo, endCard } = timeline
  const { sink, jump, lead, travel } = timeline.node
  const fly = flight(timeline)
  const stops = nodeStops(layout, timeline)
  const pathX: Step[] = stops.map(stop => ({ at: stop.at, dur: stop.dur, to: stop.x }))
  const pathY: Step[] = stops.map(stop => ({ at: stop.at, dur: stop.dur, to: stop.y }))
  const x = track(f, home.x, pathX)
  const y = track(f, home.y, pathY) - fly.arc * Math.sin(Math.PI * progress(f, fly.at, fly.dur))
  // Lit in the Opening, dimmed as it sinks and lit again after the jump: opacity and radius take the same steps.
  const steps = (lit: number, dimmed: number): Step[] => [
    { at: opening.brighten, dur: 18, to: lit },
    { at: sink, dur: 16, to: dimmed },
    { at: jump + 2, dur: 16, to: lit }
  ]
  // ends the size of the logo's node
  const r = track(f, 14, [...steps(18, 8), { at: fly.at, dur: fly.dur, to: logoNode(layout).r }])
  const glow = 1 - progress(f, endCard.landed, 20) // the halo goes once the node is part of the logo
  // The submit button is as gold as the node: on it the node gets a dark edge and its tap ring turns dark.
  const edge = progress(f, demo.taps.submit - lead, travel) - progress(f, demo.taps.paste - lead, travel)
  const presses = [...opening.rings, ...Object.values(demo.taps)]
  return (
    <AbsoluteFill>
      {taps(timeline).map(tap => {
        const p = progress(f, tap.at, 16)
        if (p <= 0 || p >= 1) return null
        return (
          <div
            key={tap.name}
            style={{
              position: 'absolute',
              left: stage.x + tap.x - 60 * p,
              top: stage.y + tap.y - 60 * p,
              width: 120 * p,
              height: 120 * p,
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: `3px solid ${tap.name === 'submit' ? C.onGold : C.gold}`,
              opacity: 1 - p
            }}
          />
        )
      })}
      <div
        style={{
          position: 'absolute',
          left: x - r,
          top: y - r,
          width: 2 * r,
          height: 2 * r,
          borderRadius: '50%',
          background: C.gold,
          opacity: track(f, 0.35, steps(1, 0)),
          transform: `scale(${tapScale(f, presses)})`,
          boxShadow: `0 0 0 ${3 * edge}px ${C.onGold}, 0 0 ${28 * glow}px ${8 * glow}px rgba(216, 169, 78, ${0.55 * glow})`
        }}
      />
    </AbsoluteFill>
  )
}
