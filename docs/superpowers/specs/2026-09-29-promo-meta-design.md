# Promotional Ad for Meta: 4:5 and 15 Seconds - Design

**Date:** 2026-09-29 · **Status:** approved in chat section by section, and the written spec approved by Henriko on
2026-09-29. Plan: [`2026-09-29-promo-meta.md`](../plans/2026-09-29-promo-meta.md) ·
**Package:** `video/` (Remotion `4.0.529`) · **Commits:** none - Henriko commits everything.

Builds on [`2026-09-26-promo-video-design.md`](2026-09-26-promo-video-design.md),
[`2026-09-26-promo-audio-design.md`](2026-09-26-promo-audio-design.md) and
[`2026-09-28-promo-formats-design.md`](2026-09-28-promo-formats-design.md), whose §8 left 4:5 and a 15 s cut out. The
six 30-second ads and their sound don't change.

## 0. Decisions locked before this spec

| # | Question   | Decision (Henriko, 2026-09-29)                                                                                                                                                                                              |
|---|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Which ads  | **Meta only.** A 15 s cut in 4:5 and 9:16, PT and EN: four new MP4s. LinkedIn (1:1), YouTube (16:9), Shorts and TikTok (9:16) keep the approved 30 s.                                                                       |
| 2 | Story      | **The same story, shorter:** the question, the promise with the rings, the demo and the end card. The demo keeps the draft caption and the handoff's first sentence; the feed caption and "Nothing is automated." drop out. |
| 3 | 4:5 layout | **B, the middle ground** (§3): the texts sit in the central square, which a 1:1 crop keeps, and the feed runs to the bottom edge, with 145 px above the caption.                                                            |
| 4 | Code       | **The timeline as data** (§0.1): one timeline per length, passed to the scenes as the layout is. Only moments change; movements keep their speed.                                                                           |
| 5 | Design     | Approved in chat as in §2–§7: the 15 s timeline, the 4:5 layout, the sound, the ids and the render, the verification, and the docs.                                                                                         |

Defaults taken without asking (each is reversible):

- The same encoding as the other ads: CRF 18, JPEG quality 100, AAC at 48 kHz stereo and `--enforce-audio-track`.
- The scratch scripts (the stills and their compare, the contact sheets, the loudness) stay in my scratchpad. The
  check at load (§5.2) is what stays in the repo.
- No new dependency. The still script uses `@remotion/bundler` and `@remotion/renderer`, which `@remotion/cli` already
  installs.
- No unit tests, as in the video: the check at load guards the layouts, the stills and the audio compare guard the
  30 s, and the contact sheets guard the 15 s.

Details this spec adds to the chat design (for Henriko to confirm in this review):

1. **Names.** `Length` is `'30s' | '15s'` (from `LENGTHS`, as `Format` comes from `FORMATS`). In `Demo.tsx`,
   `moments(timeline)` replaces `T`, and `TAPS` keeps only the positions. In `YouNode.tsx`, `flight(timeline)`
   replaces `FLIGHT`, and `nodeStops` takes `(layout, timeline)`. The arrangement's drive is `driveDb`.
2. **The node's other moments follow the timeline.** Its brightness and size steps start at `brighten`, `sink` and
   `jump + 2` (today 90, 186 and 332). The gold edge it wears on Submit runs from `submit − lead` to `paste − lead`,
   over `travel` frames. The glide sound starts at `landed − 50`, where the flight starts.
3. **The check's loop.** It tests every format under every timeline. The chat said the node's stops change in the
   15 s; they change in time, not in place, so today the loop finds no new point. It still covers every rendered pair
   without a list of pairs to keep in step with `CUTS`.
4. **The end fade in the 30 s.** Remotion leaves out an audio's volume filter only when its volume is exactly 1 on
   every frame of its `Sequence` (`@remotion/renderer`, `stringify-ffmpeg-filter.js`). The effects play until the
   composition ends, so in the 30 s each effect's callback drops below 1 in the last 15 frames, and each effect gets
   a filter. Until then the filter multiplies the 16-bit samples by exactly 1.0, and every 30 s effect has ended by
   frame 885 (the last, the land bell, at 870), so no sample changes. §6.2 proves it.
5. **ring-2's third.** The 14 effects are computed once, with the 30 s pad's gain. The 15 s pad sits 0.4 dB lower
   (−18.506 against −18.111 dB), so ring-2's F#3 ends up 0.4 dB above the 15 s pad instead of level with it. The
   effects stay shared.
6. **The 4:5 wraps are the square's.** Same column, same sizes, so each text takes the lines in the 1:1 column of
   [the formats spec](2026-09-28-promo-formats-design.md)'s §3 table.
7. **The stills.** 37 frames per 30 s id, each inside an animation (§6.1), and five review frames for the 15 s: 52,
   132, 226, 310 and 430 (§6.2).
8. **A sensitivity step.** Before the compare is trusted, `taps.generate` moves from 408 to 409 on purpose: the
   compare must fail, then pass with 408 back.
9. **The typing speeds up too.** The chat said only the node's speed changes, but the draft reveals its letters
   evenly across the typing span (`Demo.tsx`), so the approved 24 frames type it about twice as fast as the 30 s's
   50. The draft is the AI's output, so a faster reveal fits the story; if it reads rushed on the MP4s, the fix is
   the span's two numbers.

### 0.1 Approaches considered

- **A. The timeline as data (chosen).** One timeline object per length, passed to the scenes as the layout is. Only
  moments change (cuts, taps, captions); movements keep their speed, except the two §2 names, so the 15 s is short
  without looking fast-forwarded. The 30 s stays identical frame for frame, and the soundtrack script reads the same
  numbers.
- **B. Remap time.** The 15 s plays the 30 s with sped-up stretches: one function maps each 15 s frame to a 30 s
  frame. Less code, but everything speeds up together (a word per frame, 3-frame taps), and the result looks
  fast-forwarded.
- **C. Separate scenes.** Copies of the Opening, the Demo and the end card, with their own constants for the 15 s. No
  risk to the 30 s, but about 770 duplicated lines, and every later fix made twice.

The other options Henriko turned down:

- **Which ads:** 15 s and 30 s for Meta (six new MP4s), a 15 s cut in every format (eight), or the 15 s replacing the
  30 s everywhere.
- **Story:** opening on the promise (no question, room for three captions), or straight into the product (no
  Opening; the promise becomes the first caption, and the ad loses its visual signature).
- **4:5 layout:** A, the square centered (an empty dark band above the caption), or C, the feed running the full
  height (a 1:1 crop would cut the caption's first line).

## 1. Goal and success criteria

The approved ad, in both languages, cut to 15 seconds for Meta: 4:5 for the Facebook Feed (1440×1800) and 9:16 for
the Instagram Feed, Reels and Stories (1080×1920). Meta's Ads Manager flagged today's files ("Duração atual: 30.1
segundos (recomendada: até 15 segundos)"). The 15 s tells the same story with the same movements, look and sound, in
half the time.

Why 448 frames: Meta shows the file's duration, rounded to a tenth, and the file is as long as its AAC track, which
runs past the video. Today's 30 s files hold 30.000 s of video and 30.059 s of audio, hence "30.1". 448 frames
(14.933 s of video) make a 14.997 s file; 450 frames would make 15.06 s, shown as "15.1".

Sources: [Meta, Instagram Feed video](https://www.facebook.com/business/ads-guide/update/video/instagram-feed) ·
[Meta, Facebook Feed video](https://www.facebook.com/business/ads-guide/update/video/facebook-feed) ·
[Billo](https://billo.app/blog/meta-ads-safe-zones/) · [Superscale](https://superscale.ai/learn/meta-ad-sizes)

Done means:

- `video/out/ad-pt-4x5-15s.mp4`, `ad-en-4x5-15s.mp4`, `ad-pt-9x16-15s.mp4` and `ad-en-9x16-15s.mp4` exist: 1440×1800
  or 1080×1920, 30 fps, 448 frames, at most 15.0 s long (14.997 s expected), H.264 plus AAC at 48 kHz stereo.
- Their sound measures −15 ± 1 LUFS with true peaks at or below −1 dBTP on the decoded AAC, is below −60 dBFS in the
  video's last 10 ms, and is the same in PT and EN.
- The six 30 s ads are unchanged: 37 stills per id are pixel-identical to stills rendered before the change, their
  audio-only renders are identical sample for sample, `music-30s.wav` is byte-identical to today's `music.wav`, and
  the 14 effects keep their sha256.
- In every format, under every timeline, each text box, the mock's text area, each tap and each stop on the node's
  path sit inside the format's safe zone, and the check at load proves it.
- None of the four MP4s has a run of more than 2 frames with nothing brighter than luma 100.
- Henriko has approved the contact sheets before the final render.
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` are clean, and `pnpm -r test` is unchanged.
- `docs/PLATFORM.md` §15A describes the 15 s cut and the 4:5, and §3, §4 and §18 name them.

## 2. The 15 s timeline

Frames at 30 fps (30 frames = 1 s). The `'30s'` timeline holds today's numbers.

| Moment                                                                | 30 s                              | 15 s                              |
|-----------------------------------------------------------------------|-----------------------------------|-----------------------------------|
| Total                                                                 | 900                               | 448 (a 14.997 s MP4)              |
| Cuts: Opening → Demo → end card                                       | 210 · 705                         | 150 · 336 (5.0 s · 11.2 s)        |
| Question: in · out                                                    | 4 · 84                            | 4 · 58                            |
| Node brightens · rings                                                | 90 · 96, 120, 144                 | 64 · 70, 88, 106                  |
| Promise                                                               | 98                                | 72                                |
| Node: sinks · jumps to the feed                                       | 186 · 330                         | 126 · 142                         |
| Cards rise                                                            | 222, 236, 250                     | 138, 144, 150                     |
| Taps: Comment · Generate · Submit · Paste · Post                      | 372 · 408 · 525 · 575 · 605       | 168 · 186 · 234 · 266 · 284       |
| The draft types                                                       | 440–490                           | 200–224                           |
| Captions: feed · draft                                                | 198–360 · 374–525                 | none · 138–234                    |
| Captions: "You react and comment yourself…" · "Nothing is automated." | 539–628 · 642–900                 | 248–448 · none                    |
| End card: reveal · title · landing · CTA · URL · fine print           | 712 · 742 · 750 · 758 · 772 · 782 | 326 · 356 · 364 · 372 · 380 · 386 |
| Node: lead · travel between buttons                                   | 24 · 18                           | 12 · 8                            |

What the viewer sees, in seconds (the "What the ad says" table in PLATFORM §15A):

| Scene               | 30 s      | 15 s                                                            |
|---------------------|-----------|-----------------------------------------------------------------|
| Hook (the question) | 0–3       | 0–2.3                                                           |
| Promise and rings   | 3–7       | 2.3–5                                                           |
| Feed                | 7–12      | none: the cards rise as the Demo opens, under the draft caption |
| AI draft            | 12–17.5   | 5–7.8                                                           |
| Handoff             | 17.5–23.5 | 7.8–11.2, its first sentence only                               |
| End card            | 23.5–30   | 11.2–14.9                                                       |

- **The node's speed changes**, the exception the chat approved. Comment and Generate are 18 frames apart, and so
  are Paste and Post. With a 24-frame lead the node would leave a button before it taps the previous one. At 12 and 8
  it leaves 6 frames after the previous tap (the slack the 30 s already has between Paste and Post), travels 2.25×
  faster and arrives 4 frames before each tap instead of 6.
- **The typing's speed changes too** (§0, detail 9): 24 frames instead of 50 type the draft about twice as fast. The
  keys keep their rhythm (every 2 frames, sometimes 3), so 10 sound instead of 23. The "generating" state before it
  shortens from 30 to 12 frames.
- The flight to the logo keeps its 50 frames.
- Checked with Remotion's own spring and easing in a scratch script: the comment box is 75% open when the node
  reaches Generate (it opens top down, so the button on its first line already shows whole), the LinkedIn window is
  93% in place when the node arrives and 98% at the tap, and the logo's "L" is fully revealed at the landing, as in
  the 30 s.

Tight holds, the time each text stays whole and still on screen:

| Text                              | 30 s  | 15 s                               |
|-----------------------------------|-------|------------------------------------|
| Question                          | 1.3 s | 0.4 s (1.8 s since its first word) |
| Promise                           | 1.7 s | 0.6 s PT, 0.5 s EN                 |
| Draft caption                     | 3.6 s | 1.8 s PT, 2.0 s EN                 |
| "You react and comment yourself…" | 1.7 s | 1.2 s PT, 1.3 s EN                 |
| Posted reply, before the cut      | 2.1 s | 0.5 s                              |
| Fine print                        | 3.3 s | 1.5 s (the ad loops)               |

The holds come from the split: 5 s of Opening, 6.2 s of Demo and 3.7 s of end card. The 15 s keeps the 30 s tempo
(15.5 frames per beat against 15.47) with a Demo of 3 bars instead of 8, which puts the cuts at 5.0 s and 11.2 s. If
a hold reads rushed on the MP4s, the fix is numbers in `timelines.ts`; no code changes.

## 3. The 4:5 layout

The 4:5 is drawn at 1080×1350 and rendered at scale 4/3 as 1440×1800, so the mock and every number stay in the
square's coordinates. Its texts sit in the central square (y 135–1215) with the square's 90 px side margins: the
Opening and the end card are the square moved down 135 px, and the Demo moves down only 45 px, so its caption sits
high and the feed runs to the bottom edge (option B). Sizes and columns are the square's. `FORMATS` gains `'4x5'`,
and `LAYOUTS['4x5']` holds this table's numbers.

| Value                             | 1:1 (today)          | 4:5                                  |
|-----------------------------------|----------------------|--------------------------------------|
| Frame                             | 1080 × 1080          | 1080 × 1350, rendered as 1440 × 1800 |
| Placement                         | LinkedIn feed (30 s) | Facebook Feed (15 s)                 |
| Safe zone                         | x 90–990, y 90–990   | x 90–990, y 135–1215                 |
| Mock stage origin                 | (0, 0)               | (0, 45)                              |
| Node home                         | (540, 250)           | (540, 385)                           |
| Opening text box                  | x 110–970, y 450–900 | x 110–970, y 585–1035                |
| Hook, promise size                | 88, 96 px            | 88, 96 px                            |
| Dots                              | 40                   | 60                                   |
| Caption box                       | x 110–970, y 100–260 | x 110–970, y 145–305                 |
| Caption size, alignment           | 64 px, centered      | 64 px, centered                      |
| Skeleton cards                    | 1                    | 1                                    |
| End card column                   | x 110–970            | x 110–970                            |
| Logo top, height                  | 190, 200             | 325, 200                             |
| Title top, size                   | 420, 60 px           | 555, 60 px                           |
| CTA top, size                     | 528, 34 px           | 663, 34 px                           |
| URL top, size                     | 660, 30 px           | 795, 30 px                           |
| Fine print top, size, line budget | 740, 28 px, 3        | 875, 28 px, 3                        |
| Logo node (where the node lands)  | (560, 212)           | (560, 347)                           |

The node's stops sit at the stage origin plus their square positions:

| Stop                | 15 s frame | 4:5        |
|---------------------|------------|------------|
| Sink below home     | 126        | (540, 455) |
| Jump beside Comment | 142        | (396, 671) |
| Comment tap         | 168        | (306, 611) |
| Generate tap        | 186        | (676, 726) |
| Submit tap          | 234        | (710, 942) |
| Paste tap           | 266        | (454, 692) |
| Post tap            | 284        | (826, 692) |
| Logo node (landing) | 364        | (560, 347) |

Checked with the check's formulas in a scratch script: the fine print, the lowest text, ends at y 997 (875 + 3 × 28 ×
1.45); the lowest tap, Submit, is at y 942; the mock's text area is x 140–940, y 315–1017; the node lands on the logo
at (560, 347). All sit inside the zone.

- **Dots.** The square and the 9:16 share one density: a dot per ~12,580 px² of free area, simulated with
  `makeDots()` and Remotion's `random()`. 60 dots give the 4:5 12,487 px² per dot; 50 would leave it 19% emptier. The
  60 fit in 377 of the sampler's 5,000 tries. A comment in `layouts.ts` writes the rule down for the next format.
- **A square crop.** If a Meta placement shows the 4:5 cropped to its central square, a two-line caption starts 20 px
  below the crop's top edge, and the camera drift brings it to 4 px: inside, but close. On a phone, where the 4:5
  shows whole, about 140 px remain above it.
- **The 9:16 15 s** uses today's `9x16` layout unchanged. In the Instagram Feed, Meta may show its centered 4:5
  (y 285–1635), which every text box already sits inside (PLATFORM §15A notes it).

## 4. Sound

- **One music file per length.** `soundtrack.mjs` writes `music-30s.wav` and `music-15s.wav`. What differs between
  them is an arrangement per length, written as data in the script (it is music, not picture); the total and the
  cuts come from `timelines.ts`.

  ```js
  const ARRANGEMENTS = {
    '30s': {
      bars: [['D'], ['Bm'], ['G'], ['A'], ['D'], ['Bm'], ['G'], ['Asus4', 'A']], // the Demo: a bar each
      fullFrom: 4, // the bar where the top voice and the octave plucks enter
      endBars: [['D'], ['G/D'], ['D']], // the end card, ending on the final D
      pulseBars: 2, // the end bars the pulse plays through
      driveDb: 1 // how hard the music hits its limiter
    },
    '15s': {
      bars: [['D'], ['G'], ['Asus4', 'A']],
      fullFrom: 1,
      endBars: [['D', 'G/D'], ['D']],
      pulseBars: 1,
      driveDb: -0.3
    }
  }
  ```

  From these, a beat is the Demo's length over 4 × `bars.length`, the breath falls on the last bar's third beat, and
  the final D enters `pulseBars` bars after the end cut.
- **30 s:** today's arrangement. In the prototype, `music-30s.wav` came out byte-identical to today's `music.wav`.
- **15 s:** the same tempo (116.13 BPM against 116.36). The intro is the same Dsus2, now 5 s long. The Demo plays
  D, G, Asus4 → A: Bm drops out, because D, G, A is the shortest path that keeps the Asus4 → A breath. The fuller
  parts enter in bar 2, during the typing, as the second pass does in the 30 s. The breath falls on frame 305, right
  after the plim (288), the D impact on the cut at 336, then one pulse bar D → G/D, and the final D at frame 398.
- **Shared effects.** The same 14 WAVs, byte for byte; only their frames come from the 15 s timeline. ring-2's F#3
  ends at 6.3 s, inside the first D, which holds an F#3 too (its level is §0's detail 5). The shimmer is cut at 12
  frames (about 6 grains) and keeps its 4-frame fade. The typing plays 10 keys instead of 23.
- **A new rule: the effects end with the music.** The land bell rings for 4 s, but in the 15 s it starts 2.8 s before
  the end: it would stop at −29 dBFS, with a click at the end and on every loop. Every one-shot effect gets a volume
  of 1 → 0 over the composition's last 15 frames, the music's own 0.5 s fade:
  `volume={f => interpolate(at + f, [total - 15, total - 1], [1, 0], clamp)}`, where `f` counts from the effect's
  `Sequence`. The shimmer and the glide already end inside the Demo and the flight. In the 30 s no effect sounds in
  that window, so nothing changes (§0, detail 4).
- **Level.** With the 30 s drive (1 dB), the 15 s mix measured −14.21 LUFS against −15.45 for the 30 s: inside the
  target, 0.2 dB from its edge. Each bus (pad, pluck, bass) is normalized to its own peak, and those peaks move with
  the arrangement, so the same drive doesn't give the same loudness. A drive per length fixes it: 1 dB for the 30 s
  and −0.3 dB for the 15 s give the music alone the same loudness (−15.88 and −15.89 LUFS), which keeps every
  approved balance between the effects and the music. The prototype's 15 s mix then measures −15.12 LUFS and
  −2.41 dBTP, inside −15 ± 1 LUFS and ≤ −1 dBTP; the final numbers come from the MP4s.
- **A self-check per length.** The script's own check covers each music file as it covers `music.wav` today: its
  length in samples (now against its own timeline), finite samples and the peak. The three music checks from the
  prototype (silent edges, no dropout, and the bass entering on the cuts) passed on its `music-15s.wav`, with the bass
  on frames 150 and 336; §6.2 runs them again on the final file.
- **The manual coupling shrinks.** `FPS`, the total and the cuts come from `timelines.ts`. Only `GLIDE_FRAMES` (the
  flight's 50 frames, the same in both lengths) and `SHIMMER_SECONDS` stay repeated by hand.

## 5. Architecture

### 5.1 Files

```
video/
  scripts/
    soundtrack.mjs      # imports FPS and TIMELINES; an arrangement per length → music-30s.wav and music-15s.wav
    render.mjs          # adds --scale=1.3333333333333333 to the -4x5 ids; its header says "all ten"
  src/
    timelines.ts        # new: FPS, LENGTHS, Length, Timeline and TIMELINES; data only, no imports
    layouts.ts          # FORMATS gains '4x5' and its layout; the check runs every format under every timeline
    Root.tsx            # CUTS; ten compositions, each as long as its timeline
    Ad.tsx              # props { lang, format, length }; passes the timeline; crossfades and drift read the length
    YouNode.tsx         # nodeStops(layout, timeline); flight(timeline) replaces FLIGHT; the steps follow the timeline
    Soundtrack.tsx      # takes the length: music-<length>.wav, each effect on its timeline frame, the end fade
    brand.ts            # TOTAL_FRAMES goes, and FPS moves to timelines.ts
    motion.tsx          # imports FPS from timelines.ts
    scenes/
      Opening.tsx       # the question, the brightening, the rings and the promise from the timeline
      Demo.tsx          # moments(timeline) replaces T; TAPS keeps the positions; the captions from the timeline
      EndCard.tsx       # the reveal, title, landing, CTA, URL and fine print from the timeline
```

Unchanged: `copy.ts`, `index.ts`, `assets.d.ts` and `video/package.json`.

`timelines.ts` in short:

```ts
export const FPS = 30
export const LENGTHS = ['30s', '15s'] as const
export type Length = (typeof LENGTHS)[number]
type Span = { at: number; out: number } // a text enters at `at` and starts leaving at `out`
export type Timeline = {
  total: number // the composition's frames: 900 or 448
  cuts: { feed: number; end: number } // Opening → Demo → end card
  opening: { hook: Span; brighten: number; rings: number[]; promise: number }
  node: { sink: number; jump: number; lead: number; travel: number }
  demo: {
    cards: number[]
    taps: { comment: number; generate: number; submit: number; paste: number; post: number }
    typing: [number, number]
    captions: { feed?: Span; draft: Span; handoff: Span; automatic?: Span } // the 15 s has no feed or automatic
  }
  endCard: { reveal: number; title: number; landed: number; cta: number; url: number; finePrint: number }
}
export const TIMELINES: Record<Length, Timeline> = { … } // §2's numbers; '30s' holds today's
```

What stays outside the timeline:

- **Positions.** The taps' x and y stay in `Demo.tsx` (`TAPS`), and the formats in `layouts.ts`.
- **Relations between moments,** which hold for both lengths: the comment box opens 6 frames after its tap, the
  LinkedIn window 15 frames after Submit, and so on. `moments(timeline)` derives them.
- **Movements:** a tap, a rise, words entering one by one, the rings, the 12-frame crossfade and the 50-frame flight.
- **One exception enters the timeline:** `node.lead` and `node.travel`, when the node leaves for each tap and how long
  it travels (§2).

Flow:

- `AdProps` gains `length`. `Ad` looks up `TIMELINES[length]` and passes `timeline` to the Opening, the Demo, the end
  card and the node, as it passes `layout`.
- `Soundtrack` takes `length`: it plays `music-<length>.wav` and times each effect from `TIMELINES[length]`.
- The crossfades and the camera drift read the composition's length from `useVideoConfig().durationInFrames`. The
  drift still runs 1 → 1.03, so the 15 s ends on the 30 s framing.
- `nodeStops(layout, timeline)` takes the positions from the layout and the times from the timeline.
- `soundtrack.mjs` imports `FPS` and `TIMELINES` from `../src/timelines.ts`. Node 24.19 strips the types of a `.ts`
  file it imports, and a scratch script did it without a warning. So `timelines.ts` imports nothing (`brand.ts` loads
  fonts, and the scenes are TSX) and uses only erasable syntax: `type`, annotations and `as const`.
- `copy.ts` doesn't change: the 15 s only stops showing two sentences.

### 5.2 The safe-zone check

It tests every format as today, plus the node's stops under every timeline in `LENGTHS`. The other items (the text
boxes, the end card's block, the mock's text area and the node's home) don't depend on the timeline. A failure names
the format, the element and, for a stop, the length, for example
`4x5: node stop at frame 156 of the 15s (x 306, y 611) is outside the safe zone (x 90–990, y 135–1215)`. A stop's
frame is when the node sets off for it: 156 is 12 frames before the 15 s Comment tap. `timelines.ts` imports
nothing, so `layouts.ts` importing it adds no cycle.

### 5.3 Ids and the render

`Root.tsx` stays the one list of ids. A short list says which length each format comes in:

```ts
const CUTS: [Format, Length][] = [
  ['1x1', '30s'], // LinkedIn
  ['16x9', '30s'], // YouTube in-stream
  ['9x16', '30s'], // YouTube Shorts and TikTok
  ['4x5', '15s'], // Facebook Feed
  ['9x16', '15s'] // Instagram Feed, Reels and Stories
]
```

- The id is `ad-<lang>`, then `-<format>` unless the format is `1x1`, then `-<length>` unless the length is `30s`.
  Today's six ids don't change, so the files in `out/`, the uploads and the docs keep their names. The new ones are
  `ad-pt-4x5-15s`, `ad-en-4x5-15s`, `ad-pt-9x16-15s` and `ad-en-9x16-15s`.
- Each composition gets `durationInFrames = TIMELINES[length].total` (900 or 448) and
  `defaultProps = { lang, format, length }`. The Studio (`pnpm dev:video`) shows all ten.
- `render.mjs` adds `--scale=1.3333333333333333` to the ids with `-4x5`: the 1080×1350 composition is redrawn at
  1440×1800, not upscaled. It reads the format from the id because Node can't import `layouts.ts` (it imports TSX);
  a comment points at `Root.tsx`'s id rule. The flags, the unknown-id stop and `pnpm render:video [ids…]` stay.
- With no ids it renders all ten, about 10 minutes going by the last renders.

| File                      | Size        | Length   | Placement                         |
|---------------------------|-------------|----------|-----------------------------------|
| `ad-{pt,en}-4x5-15s.mp4`  | 1440 × 1800 | 14.997 s | Facebook Feed                     |
| `ad-{pt,en}-9x16-15s.mp4` | 1080 × 1920 | 14.997 s | Instagram Feed, Reels and Stories |

The 30 s 9:16 files keep serving YouTube Shorts and TikTok.

`video/public/audio/music.wav` is orphaned once the script writes `music-30s.wav`. The folder is gitignored and
nothing else reads the file, so the plan deletes it once, after saving the "before" copy that §6 compares against.

### 5.4 Commands

| Command                                                                       | What it does                                                                               |
|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `pnpm dev:video`                                                              | The audio, then Remotion Studio on port 3100 with all ten compositions                     |
| `pnpm render:video`                                                           | The audio, then every composition → `video/out/<id>.mp4`, one after another (about 10 min) |
| `pnpm render:video ad-pt-4x5-15s ad-en-4x5-15s ad-pt-9x16-15s ad-en-9x16-15s` | The audio, then only Meta's four files                                                     |

### 5.5 Repo gates

- `video/out/` and `video/public/audio/` are already gitignored.
- `pnpm typecheck` covers `video/src`, so `timelines.ts`, but not `video/scripts`; ESLint covers both, the scripts as
  plain ESM.
- Prettier formats the new and changed files only (never `pnpm format`).
- No unit tests (§0).

## 6. Verification

What a test showed before this spec: re-rendering today's `ad-pt.mp4` with no change gave the same audio, AAC packets
byte for byte, but frames 119–200 differed by up to 44 luma levels, only on the antialiased edges of letters and
dots. A long render keeps its browser tabs for hundreds of frames, and Chrome reuses drawing between them.
`remotion still` starts each frame on a fresh page: two renders of frames 150 and 198 came out identical, and today's
frame 190 matches the one from 2026-09-28. So "the 30 s is unchanged" is proven with stills and audio, never with MP4
hashes.

### 6.1 Baseline, before any code

1. **Gates.** `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm -r test`, with the counts written down.
2. **Stills.** The six 30 s ids at 37 frames each, all inside animations: 10, 90, 100, 125, 150, 194, 204, 226, 240,
   256, 338, 356, 366, 376, 384, 392, 412, 465, 495, 510, 531, 540, 545, 560, 580, 590, 618, 634, 648, 699, 720, 748,
   755, 762, 778, 790 and 899. They cover the question, the rings, the promise, the node, the cards, the taps, the
   typing, each caption entering and leaving, both cuts, the flight, the end card and the last frame. A scratch script
   bundles once and renders each still on a fresh page; the CLI would spend about 7 s per still, mostly bundling.
3. **Audio.** The sha256 of the 15 WAVs in `video/public/audio/`, and a copy of `music.wav`.
4. **Audio-only renders** (`--codec=wav`) of the six ids.

### 6.2 After the change

1. **Sensitivity.** With `taps.generate` at 409 instead of 408, the stills compare fails; with 408 back, it passes. A
   one-frame slip shows.
2. **The 30 s is unchanged.** The same stills are identical as arrays. `music-30s.wav` equals the old `music.wav`
   byte for byte, and the 14 effects keep their sha256. The six audio-only renders are identical sample for sample,
   which also proves the end fade changes nothing in the 30 s.
3. **The check.** A 4x5 box moved out on purpose makes `remotion compositions src/index.ts` fail with the format and
   the element (RED); with the real layout it passes and lists the ten ids (GREEN).
4. **The four MP4s.** `remotion ffprobe` shows 1440×1800 or 1080×1920, 30 fps, 448 frames, 14.997 s (at most 15.0),
   H.264 plus AAC at 48 kHz stereo. No run of more than 2 frames with nothing brighter than luma 100.
5. **Sound.** On the decoded AAC, −15 ± 1 LUFS and at most −1 dBTP (BS.1770). The three music checks on
   `music-15s.wav`, with the bass within a frame of 150 and 336. An audio-only render is below −60 dBFS in the video's
   last 10 ms (480 samples, the window of the music's silent-edge check), so the land bell no longer cuts. The whole
   last frame is not the measure: the music's own 0.5 s fade still reads −58.7 dBFS there in the prototype, against
   −84.3 dBFS in the last 10 ms. PT and EN are identical.
6. **Contact sheets.** Stills of the four new ids at frames 52 (the question), 132 (the promise), 226 (the typed
   draft and its caption), 310 (the posted reply and the handoff) and 430 (the end card), with the zone and the text
   boxes drawn on top and each text's line count, which must match its format's 30 s wraps. **Henriko approves them
   before the final render,** then watches the MP4s; an adjustment is data in `timelines.ts` and four renders (about
   4 min).
7. **`render.mjs`.** An unknown id stops it before any render, one id renders only that file, and a 4x5 id comes out
   at 1440×1800.
8. **Gates.** Clean, and `pnpm -r test` has the baseline's counts.

## 7. Docs and memory

`docs/PLATFORM.md`, in the same change as the code:

- **§15A:**
  - **Opening:** the 15 s cut for Meta, with a link to this spec. The Meta paragraph (2026-09-29) now says Meta takes
    the 15 s files: the 4:5 in the Facebook Feed and the 9:16 in the Instagram Feed, Reels and Stories. The 30 s 9:16
    keeps serving Shorts and TikTok.
  - **"Lengths" (new subsection):** the 30 s and the 15 s, and what the 15 s drops (the feed caption and "Nothing is
    automated."); the timeline in `timelines.ts`; why 448 frames.
  - **"What the ad says":** a column with the 15 s seconds.
  - **"How it is built":** ten compositions, `CUTS`, the `length` prop and one clock per timeline.
  - **"Formats":** a 4x5 row (1080×1350 rendered at 4/3 as 1440×1800, the stage, the sizes and the 60 dots), the
    square-crop flag, and the 9x16 row's "For" column split between the 30 s and the 15 s.
  - **"Sound":** `music-30s.wav` and `music-15s.wav` with their arrangements, a 15 s frames column in the effects
    table, the end-fade rule and the 15 s measurements. "The one manual coupling" shrinks to `GLIDE_FRAMES` and
    `SHIMMER_SECONDS`.
  - **"Commands":** "all ten", the Meta-only command and about 10 min for all. A new sentence: two renders of the same
    code can differ at the edges, so to prove that nothing changed, compare stills and audio, never MP4s.
  - **Mermaid:** `timelines.ts`, the 4x5, ten compositions, and the Meta node pointing at the 15 s files.
  - **"Changing the ad":** timing lives in `timelines.ts`; the recipe for a new length (a timeline, an arrangement and
    a `CUTS` entry); the 4x5's tight fits, measured on the stills.
- **§3 and §4:** the `video/` lines mention the 15 s.
- **§18:** "all six" becomes "all ten".
- **Last updated:** a new entry on top, with the measured numbers, the gates and "Sections updated: §3, §4, §15A,
  §18".
- **§21** already maps `video/**` to §15A, so it stays.

Outside the repo, my memory note on the video (`promo-video.md`) gets the four ids and what goes to Meta,
`timelines.ts` as the one source of timing, the rewritten Meta paragraph and two traps: MP4 renders aren't
reproducible while stills and audio are, and 448 frames, not 450. Its `MEMORY.md` line changes without growing. The
spec and the plan stay untracked; Henriko commits.

## 8. Risks and fallbacks

| Risk                                                                                             | Fallback                                                                                                                                                                                                                                                  |
|--------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A hold reads rushed on the MP4s (§2's tight holds).                                              | Timing is data: numbers in `timelines.ts` and four renders, about 4 min. Moving a cut also re-times the music: 6 frames change the Demo's tempo by about 3%.                                                                                              |
| The migration slips a 30 s moment by a frame.                                                    | The 37 stills per id sit inside animations, so a one-frame slip changes pixels (the sensitivity step in §6.2 proves the compare catches it), and the audio compare catches a slipped effect.                                                              |
| The end fade changes the 30 s audio.                                                             | The ×1.0 filter is exact on 16-bit samples (§0, detail 4), and the sample compare decides. If it differs, each effect's `Sequence` lasts only as long as its sound (the 14 WAVs are fixed), so the 30 s callbacks see only 1 and Remotion adds no filter. |
| The 15 s loudness drifts from the prototype's.                                                   | The MP4s are measured (§6.2); the drive is one number per length.                                                                                                                                                                                         |
| Two renders of the same code differ.                                                             | Compare stills and audio, never MP4 hashes (§6).                                                                                                                                                                                                          |
| A Meta placement crops the 4:5 to a square, and the caption comes within 4 px of the crop's top. | Moving the caption box and the stage down 20 px together keeps the mock's text inside the zone (down to y 1037 of 1215).                                                                                                                                  |
| A 4:5 wrap differs from the square's.                                                            | Same column, sizes and fonts, so they match; the contact sheets count the lines.                                                                                                                                                                          |
| Ten renders take longer than six.                                                                | About 10 min for all ten; `pnpm render:video <id> …` renders only what changed.                                                                                                                                                                           |

## 9. Out of scope

A Spanish version, 15 s cuts for LinkedIn, YouTube or TikTok, a 30 s 4:5, caption files (SRT), thumbnails and covers,
and uploading to Meta (Henriko's step).
