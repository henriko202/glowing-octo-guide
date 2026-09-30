# Promotional Ad Audio (music + sound effects) - Design

**Date:** 2026-09-26 · **Status:** music, sound effects and technical approach approved in chat by Henriko (section by
section); this written spec awaits Henriko's review. No code yet · **Package:** `video/` (Remotion `4.0.529`) plus a
zero-dependency Node script · **Commits:** none - Henriko commits everything.

Builds on [`2026-09-26-promo-video-design.md`](2026-09-26-promo-video-design.md), whose §8 left the music out. The
picture doesn't change.

## 0. Decisions locked before this spec

| # | Question      | Decision (Henriko, 2026-09-26)                                                                                                               |
|---|---------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Layers        | **Music + sound effects.** No voiceover: LinkedIn autoplays muted, and the captions already tell the story.                                  |
| 2 | Music source  | **Composed in code.** Free, license-free and synced to the frame. I can't hear it, so Henriko judges it by ear.                              |
| 3 | Mood          | **Calm and confident:** warm pad, soft pluck, light beat. The opening hangs, the beat enters with the feed, and it resolves on the end card. |
| 4 | Approach      | **A. Script + Remotion** (§0.1).                                                                                                             |
| 5 | Music         | Approved as in §2.                                                                                                                           |
| 6 | Sound effects | Approved as in §3.                                                                                                                           |
| 7 | Technical     | Approved as in §4, with the mix at about −15 LUFS (not −14) and the WAVs kept out of git.                                                    |

Defaults taken without asking (each is reversible):

- One soundtrack for both languages. PT and EN share every frame, so their audio is identical.
- WAV files at 48 kHz, 16-bit, stereo. Remotion mixes at 48 kHz, so nothing is resampled.
- The ad keeps working muted: nothing on screen changes.

Details this spec adds to the chat design (for Henriko to confirm in this review):

- **The pad's third lives in the F# ring's sound.** In the chat design the pad resolved inside the music. Here the F#
  ring's file carries a pad voice on F#3 that swells in with the bell, so the resolution lands on that ring wherever
  `RINGS` moves, and the cuts stay the only manual coupling (§4.1). The pad keeps its E as a color note, so Dsus2
  opens into Dadd9.
- The riser covers the last two beats before the cut. The fuller second pass adds an octave-up pluck and a higher pad
  voice; the drums stay the same. The breath: the drums stop after beat 2 of bar 8, and the chord moves A sus4 → A on
  beat 3.
- The shimmer's grains use E, F#, A and B, which fit every chord of the loop. The keys fall every 2 or 3 frames.
- The CTA's start frame is exported as `CTA_AT`, like `HOOK_AT` and `PROMISE_AT`. `FPS` and `TOTAL_FRAMES` join the
  cuts as literals in the script, which needs them to size the track.

### 0.1 Approaches considered

- **A. Script + Remotion (chosen).** A Node script with no dependencies synthesizes the music and each effect into
  WAVs. A Remotion component plays the music and puts each effect on its event's frame, reading the same constants
  that move the picture, so a moved tap takes its sound along.
- **B. One pre-mixed WAV.** The script would also place the effects and master the whole mix, with a limiter and an
  exact loudness. But Node can't import `Demo.tsx` (JSX), so the tap frames would be copied into the script, and a
  moved tap would desync its sound without any warning.
- **C. Web Audio in Node (`node-web-audio-api`).** Oscillators, reverb and a compressor come ready-made, so there is
  less audio code. But it's a native dependency (a Rust binary) for a 30 s track, and the effects are placed the same
  way as in A.

## 1. Goal and success criteria

A soundtrack for the 30-second ad in both languages: music composed in code, plus sound effects on the on-screen
events. It rewards the viewers who turn the sound on; the muted ad stays as it is.

Done means:

- `video/out/ad-pt.mp4` and `ad-en.mp4` carry the soundtrack (AAC, 48 kHz, stereo, 30.0 s), and the picture is
  unchanged: the key stills are pixel-identical to stills rendered before the change.
- Every effect starts within ±1 frame (±33 ms) of its event.
- The mix measures −15 ± 1 LUFS integrated, with a true peak ≤ −1 dBTP.
- The PT and EN audio are identical.
- `pnpm --filter video audio` writes byte-identical WAVs on every run, and its self-check passes.
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` are clean, and `pnpm -r test` is unchanged.
- Henriko has approved the sound after listening on a phone speaker and on headphones.
- `docs/PLATFORM.md` §15A describes the audio.

## 2. Music

**D major at 1280/11 ≈ 116.36 BPM.** A beat lasts 0.515625 s (15.47 frames) and a bar 2.0625 s. At this tempo both
scene cuts fall on a bar's first beat: frame 210 (7.0 s) and frame 705 (23.5 s), exactly 8 bars apart. Other bars start
between frames, which doesn't matter: the music is one WAV, accurate to the sample.

| Time      | Frames  | Scene             | What the music does                                                                                                                                                                                                   |
|-----------|---------|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0–3 s     | 0–90    | Hook (a question) | A low, warm pad on Dsus2 (D, E, A: no third) rises from silence. It sounds like an open question.                                                                                                                     |
| 3–6 s     | 90–186  | Promise           | The node lights up with a glow, and its three rings ring as rising bells (D, F#, A; §3). The F# ring brings the pad's third, and the pad's filter keeps opening.                                                      |
| 6–7 s     | 186–210 | Cut to the feed   | A riser (rising noise) over the last two beats, from 5.97 s, lands on the feed's first beat.                                                                                                                          |
| 7–23.5 s  | 210–705 | Feed + AI         | The beat enters: kick on 1 and 3, soft clap on 2 and 4, quiet hats, a pulsing bass and a pluck arpeggio. D, Bm, G, A, one chord per bar, twice; the second pass is fuller. The last bar breathes before the end card. |
| 23.5–30 s | 705–900 | End card          | Resolves on D on the end card's first beat, with a low impact. Clap and hats drop out; of the beat, only the pulse stays. Then G/D, then a final D that rings until it fades over the last 0.5 s.                     |

### 2.1 Bar map

| Bars     | Start (s)                       | Start (frame)                   | Chords               | What changes                                                                                                                                       |
|----------|---------------------------------|---------------------------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| 1–4      | 7.0, 9.0625, 11.125, 13.1875    | 210, 271.875, 333.75, 395.625   | D, Bm, G, A          | First pass.                                                                                                                                        |
| 5–8      | 15.25, 17.3125, 19.375, 21.4375 | 457.5, 519.375, 581.25, 643.125 | D, Bm, G, A sus4 → A | Fuller: an octave-up pluck and a higher pad voice. In bar 8 the drums stop after beat 2 and the chord moves to A on beat 3.                        |
| End card | 23.5, 25.5625, 27.625           | 705, 766.875, 828.75            | D, G/D, D            | Sub impact on 705. Kick and bass keep pulsing under the pad and a sparser pluck. The final D drops the kick, rings, and fades over frames 885–900. |

### 2.2 Sound

- **Timbres:** a warm synth pad, a synthesized pluck that sounds like harp or nylon string (Karplus-Strong), bells,
  soft electronic drums, a sub bass and a sub impact, with reverb on everything.
- **The intro opens up:** the pad's low-pass filter opens across the whole intro, slowly at first, and is fully open at
  the cut.
- **Fades:** the track rises from silence over its first 2 s and fades to silence over its last 0.5 s, so a feed
  player that loops the ad doesn't jolt.
- **Room for the effects:** the music sits under them. The pluck is low-passed and the hats are quiet and high, which
  keeps the 1–5 kHz band, where the clicks, keys and plim live, clear.
- **Glue:** the bass ducks under each kick, and the pluck has a dotted-eighth delay.
- **Level:** the script masters the track to a −3 dBFS peak, about −17 LUFS on its own. It's a starting point, tuned by
  measurement (§5).

## 3. Sound effects

Every effect reads the same constant that times its picture, so a timing change moves the sound with it.

| Frame                   | Time            | Event                      | Sound                                                                                              | Reads                      |
|-------------------------|-----------------|----------------------------|----------------------------------------------------------------------------------------------------|----------------------------|
| 90                      | 3.0 s           | The node lights up         | Glow: a slow-attack bell on A4                                                                     | `BRIGHTEN`                 |
| 96, 120, 144            | 3.2, 4.0, 4.8 s | Three rings                | Three rising bells, D5, F#5 and A5. The F# one also swells in a pad voice on F#3, the pad's third. | `RINGS`                    |
| 222, 236, 250           | 7.4–8.3 s       | Cards enter                | A muffled tick, very quiet, one per card                                                           | `T.cards`                  |
| 372, 408, 525, 575, 605 | 12.4–20.2 s     | The five taps              | A short click, like a trackpad tap                                                                 | `TAPS`                     |
| 410 → 440               | 13.7–14.7 s     | AI generating              | Shimmer: random high bell grains on E, F#, A and B, getting denser; it stops where typing starts   | `T.generating`, `T.typing` |
| 440 → 490               | 14.7–16.3 s     | AI typing                  | Soft keys at an irregular pace (≈ 14 per second), each drawn from 3 variants                       | `T.typing`                 |
| 609                     | 20.3 s          | Posted                     | A two-note plim, rising A5 → D6                                                                    | `T.posted`                 |
| 700 → 750               | 23.3–25.0 s     | The node flies to the logo | A soft glide rising an octave, D5 → D6, into the landing                                           | `FLIGHT`                   |
| 750                     | 25.0 s          | The node lands             | A high D bell (D6), with the end card's D chord                                                    | `LANDED`                   |
| 758                     | 25.3 s          | The CTA pill appears       | A soft pop                                                                                         | `CTA_AT`                   |

- **Silent on purpose:** the comment box opening, the LinkedIn window, the paste result, the captions and the URL. The
  tap's click already marks each action, and more sound would crowd it. The cuts get no whoosh: the riser and the glide
  do that job.
- **In key:** the bells, the plim and the landing use notes of D major, so they sound like part of the music. The
  landing on D is the final chord's root: the node comes home.
- **Typing:** the first key falls on `T.typing[0]`. Each next gap is 2 frames, or 3 frames with probability 0.2, up to
  `T.typing[1]` (about 23 keys). Gaps and variants come from Remotion's seeded `random()`, so the typing sounds human
  but every render is the same.
- **Sustained effects** (shimmer, glide) are sized for today's timing, and their `<Sequence>` ends at the next event
  (typing starts, the node lands). A timing change can shorten them but never make them overrun. The shimmer fades out
  over its last 4 frames.

Starting levels, as peaks in dBFS. Measurement tunes them first (§5), then Henriko's ears; each is one constant in the
script.

| Sound               | Peak            | Sound          | Peak |
|---------------------|-----------------|----------------|------|
| Music (whole track) | −3 (≈ −17 LUFS) | Plim           | −10  |
| Taps                | −12             | Landing bell   | −12  |
| Ring bells          | −14             | Pop            | −14  |
| Glow                | −16             | Glide          | −18  |
| Keys                | −22             | Cards, shimmer | −24  |

## 4. Architecture

### 4.1 Files

```
video/
  package.json          # + "audio": "node scripts/soundtrack.mjs"; studio and render run it first
  scripts/
    soundtrack.mjs      # new: Node 24, no dependencies. Synth, composition and effects → public/audio/*.wav + self-check
  public/
    audio/              # generated and gitignored: music.wav + one WAV per effect
  src/
    Soundtrack.tsx      # new: <Html5Audio> for the music + one <Sequence from> per effect
    Ad.tsx              # mounts <Soundtrack /> (one line)
    YouNode.tsx         # exports FLIGHT (was module-private)
    scenes/
      Demo.tsx          # exports T (was module-private)
      EndCard.tsx       # the pop's literal 758 becomes `export const CTA_AT = 758`
```

- **The script** is a small synth: sine and anti-aliased saw oscillators, seeded noise, a Karplus-Strong pluck,
  additive bells (partials at about 1, 2, 3.01, 4.2 and 5.4 times the pitch, each with its own decay), envelopes,
  biquad filters, a Freeverb-style stereo reverb, the pluck's delay, the bass ducking and a peak limiter. It writes
  `music.wav` and `glow`, `ring-1` to `ring-3`, `card`, `tap`, `shimmer`, `key-1` to `key-3`, `plim`, `glide`, `land`
  and `pop` (`.wav`), each leveled to its peak in §3. Then it checks itself: the music is exactly 30 s × 48 000
  samples, no sample is `NaN` or infinite, and no file peaks over its limit. A failure throws, which stops `studio`
  and `render` before they start. Its noise comes from a seeded generator, so every run writes the same bytes. Budget:
  under 10 s on this PC.
- **The one manual coupling.** The music's form follows the timeline, but the script can't import `brand.ts` (font
  imports) or `Ad.tsx` (JSX). So `FPS = 30`, `TOTAL_FRAMES = 900` and the cuts `210` and `705` are repeated at the top
  of the script with a comment naming their sources, and §15A says: move a cut, change it there too. Every effect
  follows its constant on its own.
- **`Soundtrack.tsx`** plays `<Html5Audio src={staticFile('audio/music.wav')} />` (Remotion's current name for
  `<Audio>`) from frame 0, and each effect in a `<Sequence from={frame} layout="none">`, which adds nothing to the
  picture. Every file plays at volume 1, since its level is baked in, except for the shimmer's fade-out. `Ad.tsx`
  mounts it once, outside the camera drift.
- **Exports only.** `T`, `FLIGHT` and `CTA_AT` become exports and no value changes, so the picture can't change.

### 4.2 Commands

| Command                     | What it does                                                                                |
|-----------------------------|---------------------------------------------------------------------------------------------|
| `pnpm --filter video audio` | Writes `video/public/audio/*.wav` and runs the self-check                                   |
| `pnpm dev:video`            | The audio, then Remotion Studio on port 3100                                                |
| `pnpm render:video`         | The audio, then `ad-pt` and `ad-en` → `video/out/*.mp4`, still with `--enforce-audio-track` |

### 4.3 Repo gates

- `.gitignore` gains `video/public/audio/`. The WAVs are rebuilt before every Studio run and every render, so the code
  is their only source.
- ESLint already covers `**/scripts/**/*.mjs` (plain ESM with Node globals) and `video/src/**/*.{ts,tsx}`.
- Prettier formats the new and changed files only (never `pnpm format`).
- No unit tests, as in the video: the self-check guards the synthesis, and the measurements in §5 guard the sync and
  the levels.

## 5. Verification

A measurement script in my scratchpad (Python with numpy and scipy, not part of the repo) reads the rendered audio. It
must fail on today's silent renders first (RED), then pass (GREEN).

1. **Audio-only render.** `remotion render … --codec=wav` gives the mix without loss. Remotion sums the tracks as they
   are (`amix` with `normalize=0`), and the music plays at volume 1, which adds no filter, so the render minus
   `music.wav` leaves only the effects.
2. **Sync.** Each effect's WAV is matched against that residual by cross-correlation. Every match sits within ±1 frame
   of its constant, and each effect is found as many times as §3 lists it. All keys fall inside `T.typing`, 2 or 3
   frames apart.
3. **Music.** It plays for the whole 30 s: it rises from silence, never drops out between 2 s and 29.5 s (its 400 ms
   loudness stays above −40 LUFS), ends in silence, and its band below 150 Hz jumps at frames 210 and 705 (the first
   kick and the impact), each within ±1 frame.
4. **Levels,** measured on the AAC decoded from the final MP4s: −15 ± 1 LUFS integrated (ITU-R BS.1770, gated) and a
   true peak ≤ −1 dBTP (4× oversampled).
5. **Languages.** The PT and EN audio-only renders are identical, sample for sample.
6. **Determinism.** Two runs of `pnpm --filter video audio` write byte-identical files.
7. **Picture.** Stills of frames 75, 190, 340, 500, 690 and 880 in both languages, rendered before the first code
   change and again at the end, are pixel-identical.
8. **Gates.** `pnpm typecheck`, `pnpm lint` and `pnpm format:check` are clean, `pnpm -r test` is unchanged, and
   `remotion ffprobe` shows H.264 plus AAC at 48 kHz stereo, 30.0 s.
9. **Taste.** I send both MP4s. Henriko listens on a phone speaker and on headphones. Each adjustment is a constant in
   the script, and steps 2–8 run again after it.

## 6. Docs

`docs/PLATFORM.md` §15A:

- The opening line stops calling the ad silent. A new **Sound** subsection covers what plays when (§2 and §3 in
  short), the files, `pnpm --filter video audio`, the one manual coupling (`FPS`, `TOTAL_FRAMES` and the cuts in
  `soundtrack.mjs`), how to tune it (the constants at the top of the script), and that the WAVs are generated and
  gitignored.
- In "Changing the ad", the **Music** recipe becomes a **Sound** bullet: the effects follow their constants, and a
  change to a cut, the length or the frame rate also goes into the script.
- The commands block adds `pnpm --filter video audio`, and `render:video` loses "silent AAC track".
- The Mermaid flow gains `soundtrack.mjs` → `public/audio/*.wav` → `Soundtrack.tsx` → `Ad.tsx`.
- §4 Repository Layout (the `video/` line), §18 Tooling (`dev:video` and `render:video` generate the audio first) and a
  Last-updated entry. §21's `video/**` row already covers the new files.

## 7. Risks and fallbacks

| Risk                                                                                       | Fallback                                                                                                                                                                                                                                       |
|--------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| I can't hear: the music may sound cheap, harsh or off                                      | Henriko's listening is the gate (§5, step 9), and every musical choice is a named constant at the top of the script. If the synth can't get there, a licensed track can take `music.wav`'s place (Pixabay Music is free) and the effects stay. |
| Remotion sums the tracks without a limiter, so an effect on a kick can clip                | The music peaks at −3 dBFS and the effects below it. The true peak is measured on the final MP4, and the level of whatever clips comes down.                                                                                                   |
| A later timeline change (a cut, the length, the frame rate) leaves the music's form behind | The literals sit together at the top of the script, named after their sources, and §15A repeats the warning. Nothing checks it after this work: a missed cut is heard as a downbeat that misses the scene change.                              |
| The keys sound mechanical                                                                  | Gaps and variants are already seeded-random. A fourth variant or a small level jitter is one constant away.                                                                                                                                    |
| Synthesis in plain JavaScript is slow and delays every Studio start                        | Budget under 10 s. Past it, the script skips the rebuild when the WAVs are newer than the script.                                                                                                                                              |

## 8. Out of scope

Voiceover, a licensed or AI-generated track, versioning the WAVs (declined: they are rebuilt before every render),
separate audio per language, a limiter or other mastering inside Remotion, sound for the events kept silent in §3,
and, as in the video spec, a Spanish version and other aspect ratios.
