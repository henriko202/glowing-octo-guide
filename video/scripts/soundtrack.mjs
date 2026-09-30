// The ad's soundtrack, synthesized in code with no dependencies: a music file per length (music-30s.wav and
// music-15s.wav) plus one WAV per sound effect, written to video/public/audio/ (gitignored) after a self-check.
// Soundtrack.tsx plays them: the length's music from frame 0, each effect on the frame of its event. PLATFORM.md §15A
// "Sound" has the map.
//
//   pnpm --filter video audio        (the studio and render scripts run it first)
//
// The levels, the harmony and the brightness are constants at the top; the instruments are functions below. Noise
// comes from seeded generators, so every run writes the same bytes.

import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { FPS, LENGTHS, TIMELINES } from '../src/timelines.ts'

// Levels in dB. The music is mastered to MUSIC_PEAK_DB, and each effect is normalized to its PEAK_DB.
const MUSIC_PEAK_DB = -3
const PEAK_DB = {
  glow: -16,
  ring: -14,
  card: -24,
  tap: -12,
  shimmer: -24,
  key: -22,
  plim: -13,
  glide: -18,
  land: -12,
  pop: -14
}
const THIRD_DB = 0 // ring-2's F#3 pad voice, against one pad voice in music-30s.wav
// The music's parts, each normalized to this peak before mastering. `echo` (the pluck's delay) and `octave` (the
// second pass's doubling) are relative to the pluck, and `reverb` to what it's fed (pad, pluck and clap).
const MIX_DB = {
  pad: -11,
  pluck: -4,
  echo: -8,
  octave: -9,
  bass: -8,
  kick: -6,
  clap: -7,
  hat: -18,
  riser: -14,
  impact: -4,
  reverb: -18
}
// Brightness: the low-pass cutoffs (Hz). The pad's opens from `padClosed` to `pad` across the intro.
const CUTOFF = { padClosed: 250, pad: 3000, pluck: 3200, bassSaw: 700 }

const SR = 48000
// The two numbers repeated by hand; timelines.ts has the rest of the timing. The glide lasts exactly the flight
// (YouNode.tsx flight(), 50 frames in both lengths), and the shimmer's Sequence cuts it at typing[0] (Demo.tsx
// moments().generating → typing[0]: 30 frames in the 30 s, 12 in the 15 s).
const GLIDE_FRAMES = 50
const SHIMMER_SECONDS = 1

// The chords the arrangements use (ARRANGEMENTS below). Each has its pad voicing, the top voice the fuller parts add,
// the bass root and the four notes the pluck cycles through.
const CHORDS = {
  D: { pad: ['D3', 'F#3', 'A3', 'D4'], top: 'F#4', bass: 'D2', arp: ['D4', 'A4', 'D5', 'F#5'] },
  Bm: { pad: ['B2', 'F#3', 'B3', 'D4'], top: 'F#4', bass: 'B1', arp: ['B3', 'F#4', 'B4', 'D5'] },
  G: { pad: ['G2', 'G3', 'B3', 'D4'], top: 'G4', bass: 'G1', arp: ['G3', 'D4', 'G4', 'B4'] },
  A: { pad: ['A2', 'E3', 'A3', 'C#4'], top: 'E4', bass: 'A1', arp: ['A3', 'E4', 'A4', 'C#5'] },
  Asus4: { pad: ['A2', 'E3', 'A3', 'D4'], top: 'E4', bass: 'A1', arp: ['A3', 'E4', 'A4', 'D5'] },
  'G/D': { pad: ['D3', 'G3', 'B3', 'D4'], top: 'G4', bass: 'D2', arp: ['D4', 'G4', 'B4', 'D5'] }
}
const INTRO = ['D3', 'A3', 'D4', 'E4'] // Dsus2, no third: an open question. ring-2.wav brings the F#.

// The music of each length (timelines.ts has its total and cuts): the chords of the Demo and of the end card, one
// entry per bar (two chords split theirs). The intro holds Dsus2 until the feed cut, the breath falls on the last Demo
// bar's third beat, and the final D enters `pulseBars` bars after the end cut. The 15 s drops Bm: D, G, A is the
// shortest loop that keeps the breath.
const ARRANGEMENTS = {
  '30s': {
    bars: [['D'], ['Bm'], ['G'], ['A'], ['D'], ['Bm'], ['G'], ['Asus4', 'A']], // the Demo
    fullFrom: 4, // the bar where the top voice and the octave plucks enter
    endBars: [['D'], ['G/D'], ['D']], // the end card, ending on the final D
    pulseBars: 2, // the end bars the pulse plays through
    driveDb: 1 // how hard the music hits its limiter: more is louder at the same peak
  },
  '15s': {
    bars: [['D'], ['G'], ['Asus4', 'A']],
    fullFrom: 1,
    endBars: [['D', 'G/D'], ['D']],
    pulseBars: 1,
    driveDb: -0.3
  }
}

const ARP = [0, 1, 2, 3, 2, 1, 2, 3] // the arpeggio note each eighth plays
const PANS = [-0.35, -0.1, 0.1, 0.35] // where each arpeggio note sits, low notes left
const BREATH_STRUM = ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4']
const FINAL_STRUM = ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']
const SHIMMER_NOTES = ['E6', 'F#6', 'A6', 'B6', 'E7', 'F#7', 'A7', 'B7'] // they fit every chord of the loop

// ─── Basics ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const db = x => 10 ** (x / 20)
const at = seconds => Math.round(seconds * SR)
const smooth = x => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x))) // raised cosine, 0 → 1
const channels = track => (track.l ? [track.l, track.r] : [track])
const len = track => channels(track)[0].length
const stereo = seconds => ({ l: new Float32Array(at(seconds)), r: new Float32Array(at(seconds)) })
const centered = x => ({ l: x, r: Float32Array.from(x) })
const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const hz = name => {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(name)
  return 440 * 2 ** ((12 * (Number(octave) + 1) + NOTES[letter] + (sharp ? 1 : 0) - 69) / 12)
}

// mulberry32: a small seeded generator, so the noise is the same on every run.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function peak(track) {
  let p = 0
  for (const ch of channels(track)) for (const x of ch) p = Math.max(p, Math.abs(x))
  return p
}

function scale(track, gain) {
  for (const ch of channels(track)) for (let i = 0; i < ch.length; i++) ch[i] *= gain
  return track
}

// Silence has no peak, so it normalizes to NaN, which the self-check catches.
const normalize = (track, peakDb) => scale(track, db(peakDb) / peak(track))

// Adds a sound into a stereo track at `start` seconds. A mono sound is panned (−1 … 1) at equal power; a stereo one
// keeps its own image.
function add(track, sound, start, gain = 1, pan = 0) {
  const s = at(start)
  const [l, r] = sound.l ? [sound.l, sound.r] : [sound, sound]
  const angle = ((pan + 1) * Math.PI) / 4
  const gl = sound.l ? gain : gain * Math.cos(angle)
  const gr = sound.l ? gain : gain * Math.sin(angle)
  const n = Math.min(l.length, track.l.length - s)
  for (let i = 0; i < n; i++) {
    track.l[s + i] += l[i] * gl
    track.r[s + i] += r[i] * gr
  }
}

function fadeIn(track, seconds) {
  const n = at(seconds)
  for (const ch of channels(track)) for (let i = 0; i < n; i++) ch[i] *= smooth(i / n)
  return track
}

// Fades the last `seconds` down to exactly 0, so a sound never ends on a click.
function fadeOut(track, seconds) {
  for (const ch of channels(track)) {
    const n = Math.min(at(seconds), ch.length)
    for (let i = 0; i < n; i++) ch[ch.length - 1 - i] *= smooth(i / n)
  }
  return track
}

// ─── Synthesis ───────────────────────────────────────────────────────────────────────────────────────────────────────

// PolyBLEP: smooths a saw's jump, so its harmonics don't alias.
function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt
    return x + x - x * x - 1
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt
    return x * x + x + x + 1
  }
  return 0
}

// Simper's trapezoidal state-variable filter. `cutoff` is in Hz, or a function of the sample index; `mode` is 'low',
// 'band' or 'high'.
function svf(x, cutoff, q, mode) {
  const y = new Float32Array(x.length)
  const k = 1 / q
  let ic1 = 0
  let ic2 = 0
  let g = 0
  for (let i = 0; i < x.length; i++) {
    if (i % 32 === 0) {
      const f = typeof cutoff === 'function' ? cutoff(i) : cutoff
      g = Math.tan((Math.PI * Math.min(f, 0.45 * SR)) / SR)
    }
    const a1 = 1 / (1 + g * (g + k))
    const a2 = g * a1
    const a3 = g * a2
    const v3 = x[i] - ic2
    const v1 = a1 * ic1 + a2 * v3
    const v2 = ic2 + a2 * ic1 + a3 * v3
    ic1 = 2 * v1 - ic1
    ic2 = 2 * v2 - ic2
    y[i] = mode === 'low' ? v2 : mode === 'band' ? v1 : x[i] - k * v1 - v2
  }
  return y
}
const svf2 = (track, cutoff, q, mode) => ({ l: svf(track.l, cutoff, q, mode), r: svf(track.r, cutoff, q, mode) })

// A warm pad voice: three anti-aliased saws detuned −7, 0 and +7 cents, spread left, center and right, with a
// raised-cosine attack and release. The bus it lands on is low-passed as a whole.
function padVoice(track, freq, start, seconds, attack, release, rng) {
  const s = at(start)
  const n = Math.min(at(seconds), track.l.length - s)
  for (const [cents, pan] of [
    [-7, -0.6],
    [0, 0],
    [7, 0.6]
  ]) {
    const dt = (freq * 2 ** (cents / 1200)) / SR
    const gl = Math.cos(((pan + 1) * Math.PI) / 4) / 3
    const gr = Math.sin(((pan + 1) * Math.PI) / 4) / 3
    let t = rng()
    for (let i = 0; i < n; i++) {
      const x = (2 * t - 1 - polyBlep(t, dt)) * smooth(i / (attack * SR)) * smooth((n - i) / (release * SR))
      track.l[s + i] += x * gl
      track.r[s + i] += x * gr
      t += dt
      if (t >= 1) t -= 1
    }
  }
}

// A plucked string (Karplus-Strong): one period of soft noise circulates in a delay line and loses its highs on every
// pass, so it rings like harp or nylon. The output doubles as the delay line, read with linear interpolation.
function pluck(freq, seconds, rng, decay = 0.996) {
  const y = new Float32Array(at(seconds))
  const d = SR / freq - 0.5 // the loop's two-point average adds half a sample
  const whole = Math.floor(d)
  const frac = d - whole
  const tap = j => (j < 0 ? 0 : y[j])
  const delayed = j => (1 - frac) * tap(j - whole) + frac * tap(j - whole - 1)
  let pick = 0
  for (let i = 0; i < y.length; i++) {
    if (i < whole) pick += 0.35 * (rng() * 2 - 1 - pick) // low-passed noise: a soft pick
    y[i] = (i < whole ? pick : 0) + decay * 0.5 * (delayed(i) + delayed(i - 1))
  }
  return fadeOut(dcBlock(y), 0.05)
}

// Removes DC with a one-pole high-pass at about 8 Hz.
function dcBlock(x) {
  const y = new Float32Array(x.length)
  let px = 0
  let py = 0
  for (let i = 0; i < x.length; i++) {
    py = x[i] - px + 0.999 * py
    px = x[i]
    y[i] = py
  }
  return y
}

// A bell: five sine partials at inharmonic ratios, the higher ones dying faster. `ring` is the fundamental's decay
// time constant (s).
const PARTIALS = [
  { ratio: 1, level: 1, decay: 1 },
  { ratio: 2, level: 0.45, decay: 0.6 },
  { ratio: 3.01, level: 0.25, decay: 0.4 },
  { ratio: 4.2, level: 0.12, decay: 0.25 },
  { ratio: 5.4, level: 0.08, decay: 0.18 }
]
function bell(freq, seconds, ring, attack = 0.002) {
  const y = new Float32Array(at(seconds))
  for (const p of PARTIALS) {
    if (freq * p.ratio > 0.45 * SR) continue
    const w = (2 * Math.PI * freq * p.ratio) / SR
    const k = Math.exp(-1 / (ring * p.decay * SR))
    let env = p.level
    for (let i = 0; i < y.length; i++) {
      y[i] += Math.sin(w * i) * env
      env *= k
    }
  }
  const a = at(attack)
  for (let i = 0; i < a && i < y.length; i++) y[i] *= smooth(i / a)
  return fadeOut(y, Math.min(0.05, seconds / 4))
}

// Freeverb (Jezar's public-domain design) at room size 0.85 and damping 0.4: eight damped combs into four allpasses
// per side, the right side 23 samples longer for width. Returns the wet signal only.
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
const ALLPASSES = [556, 441, 341, 225]
function reverb(track) {
  const n = track.l.length
  const input = new Float32Array(n)
  for (let i = 0; i < n; i++) input[i] = (track.l[i] + track.r[i]) * 0.015
  const feedback = 0.7 + 0.28 * 0.85
  const d1 = 0.4 * 0.4
  const d2 = 1 - d1
  const side = spread => {
    const out = new Float32Array(n)
    for (const size of COMBS) {
      const buf = new Float32Array(Math.round(((size + spread) * SR) / 44100))
      let idx = 0
      let store = 0
      for (let i = 0; i < n; i++) {
        const o = buf[idx]
        store = o * d2 + store * d1
        buf[idx] = input[i] + store * feedback
        if (++idx === buf.length) idx = 0
        out[i] += o
      }
    }
    for (const size of ALLPASSES) {
      const buf = new Float32Array(Math.round(((size + spread) * SR) / 44100))
      let idx = 0
      for (let i = 0; i < n; i++) {
        const b = buf[idx]
        buf[idx] = out[i] + b * 0.5
        out[i] = b - out[i]
        if (++idx === buf.length) idx = 0
      }
    }
    return scale(out, 3) // Freeverb's wet scale
  }
  return { l: side(0), r: side(23) }
}

// Puts a sound in the room: pads it with `tail` seconds, adds the reverb at `wetDb` and fades the end.
function room(sound, tail, wetDb) {
  const track = stereo(len(sound) / SR + tail)
  add(track, sound, 0)
  add(track, reverb(track), 0, db(wetDb))
  return fadeOut(track, tail / 2)
}

// A ping-pong echo: the first repeat on the left, the next on the right, each darker than the last.
function pingPong(track, time, feedback, cutoff) {
  const n = track.l.length
  const d = at(time)
  const bl = new Float32Array(d)
  const br = new Float32Array(d)
  const out = { l: new Float32Array(n), r: new Float32Array(n) }
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR)
  let idx = 0
  let fl = 0
  let fr = 0
  for (let i = 0; i < n; i++) {
    const el = bl[idx]
    const er = br[idx]
    fl += a * (el - fl)
    fr += a * (er - fr)
    bl[idx] = (track.l[i] + track.r[i]) * 0.5 + fr * feedback
    br[idx] = fl * feedback
    out.l[i] = el
    out.r[i] = er
    if (++idx === d) idx = 0
  }
  return out
}

// The bass dips under each kick and swells back.
function duck(x, kicks, depth) {
  for (const kick of kicks) {
    const s = at(kick)
    for (let i = 0; i < at(0.5) && s + i < x.length; i++) {
      const t = i / SR
      x[s + i] *= 1 - depth * (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.12)
    }
  }
  return x
}

// A look-ahead peak limiter: the gain reduction starts 2 ms ahead of a peak and releases over 80 ms, so no sample
// passes the ceiling and nothing clicks.
function limit(track, ceilingDb) {
  const c = db(ceilingDb)
  const n = track.l.length
  const r = new Float64Array(n)
  for (let i = 0; i < n; i++) r[i] = 1 - Math.min(1, c / Math.max(Math.abs(track.l[i]), Math.abs(track.r[i]), 1e-9))
  const release = Math.exp(-1 / (0.08 * SR))
  const attack = Math.exp(-1 / (0.002 * SR))
  for (let i = 1; i < n; i++) r[i] = Math.max(r[i], r[i - 1] * release)
  for (let i = n - 2; i >= 0; i--) r[i] = Math.max(r[i], r[i + 1] * attack)
  for (let i = 0; i < n; i++) {
    track.l[i] *= 1 - r[i]
    track.r[i] *= 1 - r[i]
  }
  return track
}

// ─── Instruments ─────────────────────────────────────────────────────────────────────────────────────────────────────

// A soft kick: a sine falling from 110 to 45 Hz, lightly saturated so phones hear its harmonics.
function kickDrum() {
  const y = new Float32Array(at(0.45))
  let phase = 0
  for (let i = 0; i < y.length; i++) {
    const t = i / SR
    phase += (2 * Math.PI * (45 + 65 * Math.exp(-t / 0.04))) / SR
    y[i] = Math.tanh(1.5 * Math.sin(phase)) * Math.exp(-t / 0.18) * smooth(t / 0.001)
  }
  return fadeOut(y, 0.05)
}

// A soft clap: three quick noise bursts and a short tail, band-passed around 1.1 kHz.
function clapHit(rng) {
  const y = new Float32Array(at(0.3))
  for (let i = 0; i < y.length; i++) {
    const t = i / SR
    const bursts = Math.max(...[0, 0.011, 0.023].map(s => (t < s ? 0 : Math.exp(-(t - s) / 0.005))))
    const tail = t < 0.03 ? 0 : 0.7 * Math.exp(-(t - 0.03) / 0.08)
    y[i] = (rng() * 2 - 1) * Math.max(bursts, tail)
  }
  return fadeOut(svf(y, 1100, 1.2, 'band'), 0.05)
}

// A closed hat: a short burst of noise above 8 kHz.
function hat(rng) {
  const y = new Float32Array(at(0.08))
  for (let i = 0; i < y.length; i++) y[i] = (rng() * 2 - 1) * Math.exp(-i / SR / 0.02)
  return fadeOut(svf(y, 8000, 0.8, 'high'), 0.01)
}

// Adds one bass note to two tracks, a sine and a saw; the saw is low-passed later and gives phones something to play.
function bassNote(sine, saw, freq, start, seconds, decay) {
  const s = at(start)
  const n = Math.min(at(seconds), sine.length - s)
  const dt = freq / SR
  let t = 0
  for (let i = 0; i < n; i++) {
    const env = smooth(i / at(0.004)) * smooth((n - i) / at(0.03)) * Math.exp(-i / SR / decay)
    sine[s + i] += Math.sin(2 * Math.PI * t) * env
    saw[s + i] += (2 * t - 1 - polyBlep(t, dt)) * env
    t += dt
    if (t >= 1) t -= 1
  }
}

// Band-passed noise sweeping 500 Hz → 5 kHz and swelling, cut at its end: it lands on the next downbeat.
function riser(rng, seconds) {
  const n = at(seconds)
  const side = () => {
    const x = new Float32Array(n)
    for (let i = 0; i < n; i++) x[i] = (rng() * 2 - 1) * (i / n) ** 2 * smooth((n - i) / at(0.01))
    return svf(x, i => 500 * 10 ** (i / n), 2, 'band')
  }
  return { l: side(), r: side() }
}

// The end card's low impact: a sine falling from 70 to 32 Hz under a long decay.
function impact() {
  const y = new Float32Array(at(2.5))
  let phase = 0
  for (let i = 0; i < y.length; i++) {
    const t = i / SR
    phase += (2 * Math.PI * (32 + 38 * Math.exp(-t / 0.15))) / SR
    y[i] = Math.tanh(1.2 * Math.sin(phase)) * Math.exp(-t / 0.8) * smooth(t / 0.003)
  }
  return fadeOut(y, 0.3)
}

// A strum: the notes low to high, 30 ms apart, spread across the stereo field.
function strum(track, notes, start, seconds, decay, rng) {
  notes.forEach((note, i) => {
    add(track, pluck(hz(note), seconds, rng, decay), start + 0.03 * i, 0.8, -0.5 + i / (notes.length - 1))
  })
}

// ─── Music ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function music(length) {
  const { total, cuts } = TIMELINES[length]
  const { bars, fullFrom, endBars, pulseBars, driveDb } = ARRANGEMENTS[length]
  const SECONDS = total / FPS
  const LENGTH = at(SECONDS) // samples per channel
  const FEED = cuts.feed / FPS // 7.0 s in the 30 s, 5.0 s in the 15 s
  const END = cuts.end / FPS // 23.5 s in the 30 s, 11.2 s in the 15 s
  const BEAT = (END - FEED) / (4 * bars.length) // 4 beats a Demo bar: about 116.36 BPM in the 30 s, 116.13 in the 15 s
  const BAR = 4 * BEAT
  const BREATH = FEED + (bars.length - 1) * BAR + 2 * BEAT // the last bar's third beat: A sus4 turns to A
  // Every chord with its start and end (s). `full` marks the bars from `fullFrom` on and the end card, which add the
  // top voice.
  const SEGMENTS = [
    [bars, FEED],
    [endBars, END]
  ].flatMap(([chordBars, from]) =>
    chordBars.flatMap((chords, k) =>
      chords.map((name, j) => {
        const start = from + k * BAR + (j * BAR) / chords.length
        return { chord: CHORDS[name], start, end: start + BAR / chords.length, full: from === END || k >= fullFrom }
      })
    )
  )
  const chordAt = t => SEGMENTS.find(s => t >= s.start && t < s.end).chord
  const rng = mulberry32(1)
  const pad = stereo(SECONDS)
  const plucks = stereo(SECONDS)
  const claps = stereo(SECONDS)
  const beat = stereo(SECONDS) // kick and hats
  const fx = stereo(SECONDS) // riser and impact
  const sine = new Float32Array(LENGTH)
  const saw = new Float32Array(LENGTH)
  const kicks = []
  const kick = normalize(kickDrum(), MIX_DB.kick)
  const clapHits = [0, 1, 2, 3].map(() => normalize(clapHit(rng), MIX_DB.clap))
  const hats = [0, 1, 2, 3].map(() => normalize(hat(rng), MIX_DB.hat))

  // The hook's open question: Dsus2 rising from silence. ring-2.wav brings its third.
  for (const note of INTRO) padVoice(pad, hz(note), 0, FEED + 0.3, 1.5, 0.5, rng)
  // One pad chord per segment, the fuller ones with the top voice. The last one rings to the end.
  for (const s of SEGMENTS) {
    const last = s === SEGMENTS.at(-1)
    for (const note of s.full ? [...s.chord.pad, s.chord.top] : s.chord.pad) {
      padVoice(pad, hz(note), s.start, (last ? SECONDS : s.end + 0.3) - s.start, 0.2, last ? 1.5 : 0.3, rng)
    }
  }
  add(fx, normalize(riser(rng, 2 * BEAT), MIX_DB.riser), FEED - 2 * BEAT)

  // The feed, in eighths: kick on 1 and 3, clap on 2 and 4, hats on every eighth (the offbeats louder), the bass
  // pulsing on the root and the pluck on the arpeggio, doubled an octave up from bar `fullFrom` on. At BREATH it all
  // stops for a strum on A.
  for (let e = 0; FEED + (e * BEAT) / 2 < BREATH; e++) {
    const t = FEED + (e * BEAT) / 2
    const chord = chordAt(t)
    if (e % 4 === 0) {
      add(beat, kick, t)
      kicks.push(t)
    }
    if (e % 4 === 2) add(claps, clapHits[(e >> 2) % 4], t)
    add(beat, hats[e % 4], t, e % 2 ? 1 : 0.5, 0.2)
    bassNote(sine, saw, hz(chord.bass), t, BEAT / 2 - 0.03, 0.3)
    const i = ARP[e % 8]
    add(plucks, pluck(hz(chord.arp[i]), 1.2, rng), t, e % 2 ? 0.75 : 1, PANS[i])
    if (e >= 8 * fullFrom) add(plucks, pluck(2 * hz(chord.arp[i]), 0.8, rng), t, db(MIX_DB.octave), -PANS[i])
  }
  strum(plucks, BREATH_STRUM, BREATH, END + 1 - BREATH, 0.997, rng)

  // The end card: the impact lands on D. Kick and bass keep pulsing for `pulseBars` bars (two in the 30 s, one in the
  // 15 s) under quarter-note plucks; the last D drops the kick, holds the bass and strums, ringing into the fade.
  add(fx, normalize(impact(), MIX_DB.impact), END)
  const last = END + pulseBars * BAR
  for (let e = 0; END + (e * BEAT) / 2 < last; e++) {
    const t = END + (e * BEAT) / 2
    const chord = chordAt(t)
    if (e % 4 === 0) {
      add(beat, kick, t)
      kicks.push(t)
    }
    bassNote(sine, saw, hz(chord.bass), t, BEAT / 2 - 0.03, 0.3)
    if (e % 2 === 0) add(plucks, pluck(hz(chord.arp[(e / 2) % 4]), 1.2, rng), t, 0.9, PANS[(e / 2) % 4])
  }
  bassNote(sine, saw, hz('D2'), last, SECONDS - last, 1.5)
  strum(plucks, FINAL_STRUM, last, SECONDS - last, 0.998, rng)

  // The buses. The pad's low-pass opens across the intro (slowly at first); the bass ducks under the kicks; pad, pluck
  // and clap share one room.
  const opens = at(FEED)
  const padCutoff = i =>
    i < opens ? CUTOFF.padClosed * (CUTOFF.pad / CUTOFF.padClosed) ** ((i / opens) ** 2) : CUTOFF.pad
  const padBus = svf2(pad, padCutoff, 0.707, 'low')
  const padGain = db(MIX_DB.pad) / peak(padBus)
  scale(padBus, padGain)
  const pluckBus = normalize(svf2(plucks, CUTOFF.pluck, 0.707, 'low'), MIX_DB.pluck)
  const low = svf(saw, CUTOFF.bassSaw, 0.8, 'low')
  const bass = new Float32Array(LENGTH)
  for (let i = 0; i < LENGTH; i++) bass[i] = sine[i] + low[i]
  normalize(duck(bass, kicks, 0.6), MIX_DB.bass)
  const send = stereo(SECONDS)
  for (const part of [padBus, pluckBus, claps]) add(send, part, 0)

  const master = stereo(SECONDS)
  for (const part of [padBus, pluckBus, claps, beat, fx, bass]) add(master, part, 0)
  add(master, pingPong(pluckBus, 0.75 * BEAT, 0.35, 2500), 0, db(MIX_DB.echo))
  add(master, reverb(send), 0, db(MIX_DB.reverb))

  // Mastering: drive into the limiter, fade in over 2 s and out over the last 0.5 s, then set the peak.
  const drive = db(driveDb) / peak(master)
  limit(scale(master, drive), MUSIC_PEAK_DB)
  fadeOut(fadeIn(master, 2), 0.5)
  const trim = db(MUSIC_PEAK_DB) / peak(master)
  scale(master, trim)
  return { track: master, padGain: padGain * drive * trim }
}

// ─── Sound effects ───────────────────────────────────────────────────────────────────────────────────────────────────

// A burst of noise band-passed at `center` over a short sine thump: the tap and the keys.
function click(rng, burst, center, thump) {
  const noise = new Float32Array(at(0.08))
  const b = at(burst)
  for (let i = 0; i < b; i++) noise[i] = (rng() * 2 - 1) * (1 - i / b)
  const y = svf(noise, center, 2, 'band')
  for (let i = 0; i < y.length; i++) {
    y[i] += 0.5 * Math.sin((2 * Math.PI * thump * i) / SR) * Math.exp(-i / SR / 0.012) * smooth(i / at(0.001))
  }
  return fadeOut(y, 0.01)
}

// The card's tick: softer and darker than a click.
function tick(rng) {
  const noise = new Float32Array(at(0.1))
  for (let i = 0; i < noise.length; i++) noise[i] = (rng() * 2 - 1) * Math.exp(-i / SR / 0.008)
  return fadeOut(svf(svf(noise, 1800, 1.5, 'band'), 3000, 0.707, 'low'), 0.01)
}

// The AI generating: high bell grains on E, F#, A and B, from 8 to 40 a second.
function shimmer(rng) {
  const grains = stereo(SHIMMER_SECONDS + 0.3)
  for (let t = 0; t < SHIMMER_SECONDS; t += -Math.log(1 - rng()) / (8 + 32 * t)) {
    const note = SHIMMER_NOTES[Math.floor(rng() * SHIMMER_NOTES.length)]
    add(grains, bell(hz(note), 0.3, 0.08, 0.003), t, 0.4 + 0.6 * rng(), 1.6 * rng() - 0.8)
  }
  return room(grains, 0.4, -4)
}

// ring-2: the F# bell, plus the pad's third. A pad voice on F#3 swells in under the bell, holds past the cut to the
// feed (whose D chord brings its own F#3) and releases, at the level of one pad voice in music-30s.wav (0.4 dB over
// one in music-15s.wav: both lengths share the effects).
function ringWithThird(padGain) {
  const hold = 3.4 // s: ring-2 plays at 4.0 s in the 30 s and 2.9 s in the 15 s, so the voice ends near 7.4 s or 6.3 s
  const voice = stereo(hold)
  padVoice(voice, hz('F#3'), 0, hold, 1, 0.6, mulberry32(9))
  const opened = svf2(voice, i => 600 * 5 ** (i / at(hold)), 0.707, 'low') // 600 Hz → 3 kHz, like the intro pad
  const third = room(scale(opened, padGain * db(THIRD_DB)), 1.5, MIX_DB.reverb)
  const track = stereo(len(third) / SR)
  add(track, third, 0)
  add(track, normalize(room(bell(hz('F#5'), 1.5, 1), 1.5, -8), PEAK_DB.ring), 0)
  return peak(track) > db(PEAK_DB.ring) ? normalize(track, PEAK_DB.ring) : track
}

// The posted plim: A5, then D6.
function plim() {
  const notes = stereo(0.7)
  add(notes, bell(hz('A5'), 0.7, 0.35), 0, 0.8)
  add(notes, bell(hz('D6'), 0.6, 0.45), 0.1)
  return room(notes, 1.3, -8)
}

// The node's flight: a soft tone rising an octave, D5 → D6, easing into the landing. It lasts exactly the flight and
// its reverb is faded inside it, so it ends at 0.
function glide() {
  const n = at(GLIDE_FRAMES / FPS)
  const y = new Float32Array(n)
  const from = hz('D5')
  let phase = 0
  for (let i = 0; i < n; i++) {
    const x = i / n
    phase += (2 * Math.PI * from * 2 ** (1 - (1 - x) ** 2)) / SR
    y[i] = (Math.sin(phase) + 0.25 * Math.sin(2 * phase)) * smooth(x / 0.3)
  }
  const track = stereo(n / SR)
  add(track, y, 0)
  add(track, reverb(track), 0, db(-6))
  return fadeOut(track, 0.12)
}

// The landing: a high D bell over a soft D5.
function land() {
  const notes = stereo(2.5)
  add(notes, bell(hz('D6'), 2.5, 1.6), 0)
  add(notes, bell(hz('D5'), 2.5, 2), 0, 0.35)
  return room(notes, 1.5, -6)
}

// The CTA's pop: a sine sweeping 300 → 900 Hz in 30 ms.
function pop() {
  const y = new Float32Array(at(0.2))
  let phase = 0
  for (let i = 0; i < y.length; i++) {
    const t = i / SR
    phase += (2 * Math.PI * 300 * 3 ** Math.min(1, t / 0.03)) / SR
    y[i] = Math.sin(phase) * smooth(t / 0.002) * Math.exp(-t / 0.06)
  }
  return fadeOut(y, 0.02)
}

function effects(padGain) {
  const ring = note => normalize(room(bell(hz(note), 1.5, 1), 1.5, -8), PEAK_DB.ring)
  const key = (seed, center, thump) => normalize(centered(click(mulberry32(seed), 0.004, center, thump)), PEAK_DB.key)
  return {
    glow: normalize(room(bell(hz('A4'), 1.5, 1.2, 0.2), 1.5, -6), PEAK_DB.glow),
    'ring-1': ring('D5'),
    'ring-2': ringWithThird(padGain),
    'ring-3': ring('A5'),
    card: normalize(centered(tick(mulberry32(3))), PEAK_DB.card),
    tap: normalize(centered(click(mulberry32(4), 0.002, 3000, 180)), PEAK_DB.tap),
    shimmer: normalize(shimmer(mulberry32(5)), PEAK_DB.shimmer),
    'key-1': key(6, 2500, 150),
    'key-2': key(7, 3200, 200),
    'key-3': key(8, 4000, 250),
    plim: normalize(plim(), PEAK_DB.plim),
    glide: normalize(glide(), PEAK_DB.glide),
    land: normalize(land(), PEAK_DB.land),
    pop: normalize(centered(pop()), PEAK_DB.pop)
  }
}

// ─── Output ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// The self-check. A failure throws before any file is written, which stops `studio` and `render` before they start.
function check(files) {
  const errors = []
  for (const length of LENGTHS) {
    const samples = at(TIMELINES[length].total / FPS)
    const got = files[`music-${length}`].l.length
    if (got !== samples) errors.push(`music-${length}.wav has ${got} samples, not ${samples}`)
  }
  for (const [name, track] of Object.entries(files)) {
    if (!channels(track).every(ch => ch.every(Number.isFinite))) errors.push(`${name}.wav has a NaN or infinite sample`)
    const limitDb = name.startsWith('music') ? MUSIC_PEAK_DB : PEAK_DB[name.replace(/-\d$/, '')]
    if (!(peak(track) <= db(limitDb) * 1.000001)) errors.push(`${name}.wav peaks over ${limitDb} dBFS`)
  }
  if (errors.length > 0) throw new Error(`soundtrack self-check failed:\n  ${errors.join('\n  ')}`)
}

// 16-bit stereo PCM at 48 kHz.
function wav(track) {
  const n = track.l.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVEfmt ', 8, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(2, 22) // stereo
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(n * 4, 40)
  const q = x => Math.max(-32768, Math.min(32767, Math.round(x * 32767)))
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(q(track.l[i]), 44 + i * 4)
    buf.writeInt16LE(q(track.r[i]), 46 + i * 4)
  }
  return buf
}

const started = performance.now()
const musics = Object.fromEntries(LENGTHS.map(length => [length, music(length)]))
// One set of effects for both lengths: ring-2's third sits at the 30 s pad's level.
const files = {
  ...Object.fromEntries(LENGTHS.map(length => [`music-${length}`, musics[length].track])),
  ...effects(musics['30s'].padGain)
}
check(files)
const out = join(import.meta.dirname, '..', 'public', 'audio')
mkdirSync(out, { recursive: true })
for (const [name, file] of Object.entries(files)) writeFileSync(join(out, `${name}.wav`), wav(file))
const took = ((performance.now() - started) / 1000).toFixed(1)
console.log(`soundtrack: ${Object.keys(files).length} WAVs in ${out} (${took} s)`)
