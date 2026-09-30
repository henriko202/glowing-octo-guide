import { Html5Audio, interpolate, random, Sequence, staticFile } from 'remotion'
import { clamp } from './motion'
import { moments } from './scenes/Demo'
import { type Length, TIMELINES } from './timelines'
import { flight } from './YouNode'

// Plays video/public/audio/*.wav (scripts/soundtrack.mjs writes them): the length's music from frame 0, and each
// effect on the frame of the moment that times its picture, so a moved tap takes its sound along. Levels are baked
// into the files.
const audio = (name: string) => staticFile(`audio/${name}.wav`)

// The AI's typing: a key every 2 frames, or 3 with probability 0.2, each one of 3 variants. Seeded random(), so every
// render types the same.
function keys([from, to]: [number, number]) {
  const out: { at: number; variant: number }[] = []
  for (let at = from, i = 0; at < to; i++) {
    out.push({ at, variant: 1 + Math.floor(random(`key-${i}`) * 3) })
    at += random(`gap-${i}`) < 0.2 ? 3 : 2
  }
  return out
}

export function Soundtrack({ length }: { length: Length }) {
  const timeline = TIMELINES[length]
  const { total, opening, demo, endCard } = timeline
  const t = moments(timeline)
  const fly = flight(timeline)
  const shimmer = demo.typing[0] - t.generating // frames: the shimmer stops where the typing starts
  const oneShots = [
    { at: opening.brighten, name: 'glow' },
    ...opening.rings.map((at, i) => ({ at, name: `ring-${i + 1}` })),
    ...demo.cards.map(at => ({ at, name: 'card' })),
    ...Object.values(demo.taps).map(at => ({ at, name: 'tap' })),
    ...keys(demo.typing).map(key => ({ at: key.at, name: `key-${key.variant}` })),
    { at: t.posted, name: 'plim' },
    { at: endCard.landed, name: 'land' },
    { at: endCard.cta, name: 'pop' }
  ]
  return (
    <>
      <Html5Audio src={audio(`music-${length}`)} />
      {oneShots.map(({ at, name }) => (
        <Sequence
          key={`${name}@${at}`}
          from={at}
          layout="none"
        >
          {/* The effects fade out with the music over the ad's last 15 frames; `f` counts from the Sequence. */}
          <Html5Audio
            src={audio(name)}
            volume={f => interpolate(at + f, [total - 15, total - 1], [1, 0], clamp)}
          />
        </Sequence>
      ))}
      <Sequence
        from={t.generating}
        durationInFrames={shimmer}
        layout="none"
      >
        <Html5Audio
          src={audio('shimmer')}
          volume={f => interpolate(f, [shimmer - 4, shimmer - 1], [1, 0], clamp)}
        />
      </Sequence>
      {/* Ends where the node lands, so a longer flight can't make the glide overrun the landing. */}
      <Sequence
        from={fly.at}
        durationInFrames={endCard.landed - fly.at}
        layout="none"
      >
        <Html5Audio src={audio('glide')} />
      </Sequence>
    </>
  )
}
