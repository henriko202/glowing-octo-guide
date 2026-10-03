import { type CSSProperties, Fragment } from 'react'
import { interpolate, spring, useCurrentFrame } from 'remotion'
import { EASE, XF } from './brand'
import { FPS } from './timelines'

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// 0 → 1 over `duration` frames from `start`, eased; 0 before, 1 after.
export const progress = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing: EASE })

// A value that eases from `from` to each step's `to` in turn. Steps must be in time order.
export type Step = { at: number; dur: number; to: number }
export const track = (frame: number, from: number, steps: Step[]) =>
  steps.reduce((value, step) => value + (step.to - value) * progress(frame, step.at, step.dur), from)

// The press of a tap: 1 → 0.85 → 1 over 8 frames from each tap frame.
export const tapScale = (frame: number, taps: number[]) =>
  Math.min(...taps.map(at => interpolate(frame, [at, at + 4, at + 8], [1, 0.85, 1], clamp)))

// A UI entrance: a spring with no bounce that settles in ~20 frames.
export const rise = (frame: number, start: number) =>
  spring({ frame: Math.max(0, frame - start), fps: FPS, config: { damping: 200 } })

export const enterStyle = (frame: number, start: number): CSSProperties => {
  const p = progress(frame, start, 18)
  return { opacity: p, transform: `translateY(${(1 - p) * 24}px)` }
}

export const exitStyle = (frame: number, start: number, rise = 16): CSSProperties => {
  const p = progress(frame, start, XF)
  return { opacity: 1 - p, filter: `blur(${p * 6}px)`, transform: `translateY(${-p * rise}px)` }
}

export const STAGGER = 3 // frames between two words of a reveal

// Word-by-word reveal: each word rises 24px, fades in and un-blurs over 18 frames.
export function Words({ text, start }: { text: string; start: number }) {
  const frame = useCurrentFrame()
  return (
    <>
      {text.split(' ').map((word, i) => {
        const p = progress(frame, start + i * STAGGER, 18)
        return (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span
              style={{
                display: 'inline-block',
                opacity: p,
                transform: `translateY(${(1 - p) * 24}px)`,
                filter: `blur(${(1 - p) * 6}px)`
              }}
            >
              {word}
            </span>
          </Fragment>
        )
      })}
    </>
  )
}
