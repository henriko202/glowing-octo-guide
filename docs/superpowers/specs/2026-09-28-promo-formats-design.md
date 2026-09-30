# Promotional Ad in 16:9 and 9:16 - Design

**Date:** 2026-09-28 · **Status:** approved by Henriko 2026-09-28 (in chat section by section, then this written
spec). Plan: [`2026-09-28-promo-formats.md`](../plans/2026-09-28-promo-formats.md) · **Package:** `video/` (Remotion
`4.0.529`) · **Commits:** none - Henriko commits everything.

Builds on [`2026-09-26-promo-video-design.md`](2026-09-26-promo-video-design.md), whose §8 left other aspect ratios
out, and [`2026-09-26-promo-audio-design.md`](2026-09-26-promo-audio-design.md). The square ad and its sound don't
change.

## 0. Decisions locked before this spec

| # | Question    | Decision (Henriko, 2026-09-28)                                                                                                                                              |
|---|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Platforms   | **16:9 for YouTube in-stream ads; 9:16 for YouTube Shorts, Instagram Reels, Stories and TikTok.** The square stays the LinkedIn feed ad.                                    |
| 2 | Approach    | **B. Text per format** (§0.1). The app mock keeps the square's size and coordinates, so the taps, the node's path and the sound don't change.                               |
| 3 | 16:9 layout | Approved as in §3.1. The Opening's text band is 1280 px, not the 1200 first shown: at 1200 the longest promise line had 12 px to spare (said in chat before the 9:16 part). |
| 4 | 9:16 layout | Approved as in §3.2. Henriko judges TikTok's strictest reading, its right rail, on the overlay stills.                                                                      |
| 5 | Technical   | Approved as in §4 and §5: `layouts.ts`, the mock on a stage, six compositions, `render.mjs` and a safe-zone check at load.                                                  |

Defaults taken without asking (each is reversible):

- The same encoding as the square: CRF 18, JPEG quality 100, AAC at 48 kHz stereo and `--enforce-audio-track`.
- The review stills use the square's frames: 75, 190, 340, 500, 690 and 880.
- The overlay and contact-sheet scripts stay in my scratchpad. The check at load (§4.2) is what stays in the repo.
- No new dependency.

Details this spec adds to the chat design (for Henriko to confirm in this review):

1. **The 16:9 caption column is 680 px wide (x 160–840).** At 660 the PT draft caption came within 1% of a fourth
   line. At 680 the tightest fit is the PT feed caption (663 px). The left edge stays at 160 because of the camera
   drift (§7).
2. **82 dots in the 16:9 and 70 in the 9:16,** simulated at the square's density. The chat's 9:16 part said about 65.
3. **The stricter readings catch more than the chat said.** The chat called Meta and YouTube clear in the 9:16, and
   YouTube's center clear in the 16:9. Meta's bottom-right corner and Shorts' 380 px top reach into the 9:16,
   YouTube's "center 80%, top 70%" reaches into the 16:9, and TikTok's rail also covers the second card's right end.
   §3.3 lists each catch; Henriko judges them on the overlay stills.
4. **The 16:9 end card's sizes.** The chat said "a bit bigger". Here the logo is 220 px tall at y 120, the title 72 px,
   the CTA 40 px and the URL 36 px; the fine print is 36 px on 2 lines, as in the chat.
5. **The 16:9 caption is centered vertically on the mock** (box y 110–800).
6. **`render.mjs` asks Remotion for the ids** (`remotion compositions src/index.ts --quiet`, about 10 s), so
   `Root.tsx` stays the only list. An unknown id stops the script before any render.
7. **The check tests the layout at scale 1, without the camera drift.** The square itself would fail a check that
   included the drift: its caption box's top reaches y 89.8 before the Demo fades out. The square's zone is 90 px from
   every edge, the margin `COL` keeps.
8. **The mock's text area** is stage x 140–940, y 270–972. It includes the second card before the comment box pushes
   it down.
9. **The CTA's padding and arrow gap scale with its font size** (22, 52 and 14 px at today's 34 px).

### 0.1 Approaches considered

- **A. Same stage (recommended in chat).** The approved square becomes a 1080×1080 stage inside each format, and the
  background and the dots fill the rest. The smallest change, but on an upright phone the 16:9's text shows at about
  13 pt.
- **B. Text per format (chosen).** The app mock stays as it is, and with it the taps, the node's path and the sound.
  The captions, the Opening and the end card get a layout per format; in the 16:9 the caption moves beside the mock
  and grows. The cost: two new layouts to approve on stills in two languages, and more code to keep in step when the
  copy changes.
- **C. Redo each format.** Everything redesigned per format, the mock included. The most work, and the furthest from
  the approved ad.

## 1. Goal and success criteria

The approved 30-second ad, in both languages, in two more shapes: 16:9 for YouTube in-stream ads, and 9:16 for YouTube
Shorts, Instagram Reels, Stories and TikTok. Each keeps the square's story, timing and sound, with its text placed
where the platform's own labels and buttons don't cover it.

Done means:

- `video/out/ad-pt-16x9.mp4`, `ad-en-16x9.mp4`, `ad-pt-9x16.mp4` and `ad-en-9x16.mp4` exist: 1920×1080 or 1080×1920,
  30 fps, 30.0 s, H.264 plus AAC at 48 kHz stereo.
- Their audio is identical to the square's, sample for sample.
- The square is unchanged: its 12 stills are pixel-identical to stills rendered before the change.
- In every format, each text box, the mock's text area, each tap and each stop on the node's path sit inside the
  format's safe zone, and the check at load proves it.
- No file has a run of more than 2 frames with nothing brighter than luma 100 (2 is a normal mid-fade dip).
- Henriko has approved the overlay stills before the final render.
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` are clean, and `pnpm -r test` is unchanged.
- `docs/PLATFORM.md` §15A describes the formats.

## 2. What every format shares

- **One timeline.** No frame moves, so the approved sound fits every format as it is. YouTube lets viewers skip after
  5 s, but the hook plays from 0 to 3 s and the promise from 3 to 7 s, so the story doesn't change for it.
- **The mock sits on a stage.** It draws in the square's 1080×1080 coordinates, inside a container placed at the
  format's stage origin. The taps keep their stage coordinates, and the node adds the origin. The dim that fades the
  feed under the LinkedIn window stays inside the stage, so it scales about the same point as today.
- **Text per format.** The Opening, the captions and the end card take their boxes and sizes from the format's layout,
  in frame coordinates.
- **Font sizes.** On an upright phone the square and the 9:16 both fill the screen's width, so a pixel shows at the
  same size in both, and the 9:16 keeps the square's sizes. The 16:9 fits 1920 px into that width, so its text grows:
  its 80 px caption shows at about 16 pt, where the square's 64 px would show at about 13.
- **Background.** The two radial gradients are placed in percentages, so they fit any frame.
- **Dots.** The same seeded draw, now over the whole frame: x = 40 + r × (W − 80) and y = 40 + r × (H − 80), with
  today's `random()` keys. One new rule keeps only the dots the first ring lights fully: at most 960 px from the node
  (`RING_MAX` minus 80). The square's farthest corner is 935 px from its node, so the square keeps today's 40 dots.
  The new formats keep the square's density, about 80 dots per usable megapixel, and their far edges stay dark, near
  where the platforms draw their own buttons.
- **Safe zones.** Each format has one rectangle for text and taps (§3). The camera drift (1 → 1.03 about the frame's
  center) pushes a point outward by at most 3% of its distance from the center; §7 covers it.

## 3. Layouts

| Value                             | 1:1 (today)          | 16:9                  | 9:16                           |
|-----------------------------------|----------------------|-----------------------|--------------------------------|
| Frame                             | 1080 × 1080          | 1920 × 1080           | 1080 × 1920                    |
| Platforms                         | LinkedIn feed        | YouTube in-stream     | Shorts, Reels, Stories, TikTok |
| Safe zone                         | x 90–990, y 90–990   | x 140–1780, y 90–860  | x 120–960, y 270–1248          |
| Mock stage origin                 | (0, 0)               | (790, −160)           | (0, 230)                       |
| Node home                         | (540, 250)           | (960, 250)            | (540, 480)                     |
| Opening text box                  | x 110–970, y 450–900 | x 320–1600, y 440–860 | x 130–950, y 680–1130          |
| Hook, promise size                | 88, 96 px            | 96, 112 px            | 88, 96 px                      |
| Dots                              | 40                   | 82                    | 70                             |
| Caption box                       | x 110–970, y 100–260 | x 160–840, y 110–800  | x 130–950, y 330–490           |
| Caption size, alignment           | 64 px, centered      | 80 px, left           | 64 px, centered                |
| Skeleton cards                    | 1                    | 1                     | 2                              |
| End card column                   | x 110–970            | x 260–1660            | x 170–910                      |
| Logo top, height                  | 190, 200             | 120, 220              | 420, 200                       |
| Title top, size                   | 420, 60 px           | 370, 72 px            | 650, 60 px                     |
| CTA top, size                     | 528, 34 px           | 490, 40 px            | 758, 34 px                     |
| URL top, size                     | 660, 30 px           | 630, 36 px            | 890, 30 px                     |
| Fine print top, size, line budget | 740, 28 px, 3        | 720, 36 px, 2         | 970, 28 px, 3                  |
| Logo node (where the node lands)  | (560, 212)           | (982, 144)            | (560, 442)                     |

The taps don't move on the stage, so each one lands at the stage origin plus its square position:

| Tap      | Frame | 1:1        | 16:9        | 9:16        |
|----------|-------|------------|-------------|-------------|
| Comment  | 372   | (306, 566) | (1096, 406) | (306, 796)  |
| Generate | 408   | (676, 681) | (1466, 521) | (676, 911)  |
| Submit   | 525   | (710, 897) | (1500, 737) | (710, 1127) |
| Paste    | 575   | (454, 647) | (1244, 487) | (454, 877)  |
| Post     | 605   | (826, 647) | (1616, 487) | (826, 877)  |

Lines per text, measured in the video's own fonts with Pillow and checked against the square's stills (Cormorant within
about 1%, DM Sans about 2% low):

| Text (lines, PT / EN) | 1:1   | 16:9  | 9:16  |
|-----------------------|-------|-------|-------|
| Hook                  | 3 / 2 | 2 / 2 | 3 / 2 |
| Promise (both lines)  | 3 / 4 | 2 / 2 | 3 / 4 |
| Feed caption          | 2 / 2 | 2 / 2 | 2 / 2 |
| Draft caption         | 2 / 2 | 3 / 2 | 2 / 2 |
| Handoff, sentence 1   | 2 / 2 | 3 / 3 | 2 / 2 |
| Handoff, sentence 2   | 1 / 1 | 1 / 2 | 1 / 1 |
| Fine print            | 3 / 2 | 2 / 2 | 3 / 3 |

The 9:16's end card column is 740 px, narrower than its 820 px text column. In 820 px the EN fine print took 2 lines,
and its first line (810 px) reached x 957 with the drift, past AdCheckLab's right 140 (§3.3). In 740 px it takes 3
lines, within its 3-line budget. The other close calls are in §7.

### 3.1 16:9 (YouTube in-stream)

Zone: x 140–1780, y 90–860. The bottom 20% stays clear for the "Ad" label and the advertiser at the bottom left and
Skip at the bottom right, and the sides keep 140 px.

- **Opening:** the node sits at (960, 250). The hook and the promise are centered in a 1280 px band (x 320–1600,
  y 440–860) at 96 and 112 px, so each promise line fits on one line, as in the landing's hero. The rings and dots
  reach only as far as the ring does, so the bottom corners stay dark.
- **Demo:** two columns. The mock sits on the right (x 900–1760), raised 160 px because no caption sits above it: the
  cards start at y 110, the comment box spans y 463–799 and the LinkedIn window 110–551 (739 with the reply). The
  captions take the left column (x 160–840) at 80 px, left-aligned and centered vertically on the mock. Submit lands
  at y ~737, above Skip (~850).
- **End card:** the square's centered block, bigger, in a 1400 px column (x 260–1660). The fine print takes 2 lines at
  36 px and ends at y 824.

### 3.2 9:16 (Shorts, Reels, Stories and TikTok)

Zone: x 120–960, y 270–1248. Meta's one template for Reels and Stories keeps the top 14% and the bottom 35% for its
own interface; the 120 px sides come from TikTok's template.

The 9:16 is the square moved down 230 px, with the square's font sizes and an 820 px text column (x 130–950) instead of
860, away from the side icons; the end card's column is 740 px (x 170–910). The extra height shows more dots and more
feed.

- **Opening:** the node at (540, 480), the text box at y 680–1130, and 70 dots down to y ~1440.
- **Demo:** the caption box at y 330–490, above the mock, at 64 px. The mock starts at y 500; the comment box spans
  y 853–1189 and the LinkedIn window 500–941 (1129 with the reply). A second gray card follows the first below the
  fold, at stage y `CARD.top + 3 × (CARD.h + CARD.gap)` plus the push (frame y 1589 before the push). It enters with the
  first one (`enter(2)`, frame 250), so it needs no new sound.
- **End card:** the square's block from y 420 to ~1092, in a 740 px column (x 170–910) that keeps the fine print left
  of x 940 even with the drift. Every text wraps as in the square except the EN fine print, which takes 3 lines.

### 3.3 What the platforms cover

The platforms publish their overlays only as template images, so these are third-party readings. The zones are the
ones approved in chat, and the overlay stills draw every reading.

| Format | Reading                                               | What it covers (px)                                                                                                                                                                            | Source                                                                |
|--------|-------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| 9:16   | Meta Reels and Stories, one template since March 2026 | Top 269 (14%), bottom 672 (35%), sides 65 (6%). The bottom-right corner deepens to 40% (y > 1152) under the icons; no width is given, so the overlay draws it 300 px wide, like TikTok's rail. | Billo, Behaviour                                                      |
| 9:16   | TikTok in-feed template (April 2025)                  | Top 240, bottom 660, sides 120. Below the middle the right margin widens to 300 (x > 780, y > 960) for the icon rail.                                                                          | A web search summary, not checked against TikTok's own template files |
| 9:16   | TikTok, per AdCheckLab (2026)                         | Top 200, bottom 450 (ads), left 86, right 140.                                                                                                                                                 | AdCheckLab                                                            |
| 9:16   | YouTube Shorts                                        | Covered: top 180, bottom 350, right 120. Keep text 380 from the top and the bottom, 60 from the left and 120 from the right.                                                                   | ImageVideoFit                                                         |
| 16:9   | YouTube in-stream                                     | The "Ad" label and the advertiser bottom left (30% × 10%), Skip bottom right; the bottom 20-25% is the riskiest. Keep text in the center 80% of the width and the top 70% of the height.       | Vidsniff                                                              |

Sources: [Billo](https://billo.app/blog/meta-ads-safe-zones/) ·
[Behaviour](https://behaviour.digital/post/meta-reels-safe-zone-14-top-35-bottom-6-sides-the-2026-official-guide) ·
[AdCheckLab](https://adchecklab.com/articles/tiktok-safe-area-overlay-guide-2026) ·
[ImageVideoFit](https://imagevideofit.com/guides/youtube-shorts-safe-zone) ·
[Vidsniff](https://vidsniff.com/blog/youtube-ad-safe-zones)

What the stricter readings still catch, measured on the overlay stills with the camera drift (no tap point falls in
any of them):

- **9:16, TikTok's rail (x > 780, y > 960):** the right ends of the hook's last line (27 px in PT, 127 px in EN), of
  the EN promise's third line (10 px), of the second card before the comment box opens, of the comment box (the
  draft's line ends and Submit), of the LinkedIn reply and of the fine print's lines (up to x 886 in PT and 823 in EN).
- **9:16, AdCheckLab's right 140 (x > 940):** the mock's border and padding (x 940–970, to about 980 with the drift) and
  up to 6 px of its right-aligned buttons and links, while the mock is on screen.
- **9:16, Meta's bottom-right corner (x > 780, y > 1152):** Submit's bottom 7 px and the second card's footer.
- **9:16, Shorts' 380 px top:** the first line of a two-line caption.
- **16:9, YouTube's center 80% and top 70% (x 192–1728, y < 756):** the caption column's first 32 px (49 px of its
  text with the drift, which stays right of the zone's x 140), the mock's right 32 px (its border and padding), the
  second card's footer before the comment box opens, the comment box below y 756 (Submit included), the hook's second
  line (its descenders, down to y 759), the promise's second line (down to y 776) and the fine print (y 720–825).
- **16:9, YouTube's risky bottom 25% (y > 810):** the fine print's second line, down to y 825.
- **Both formats:** once the comment box opens (frames ~380–720), the second card sits below the zone: 16:9 y 870–1016,
  in YouTube's bottom 20%, and 9:16 y 1259–1532, under Meta's bottom 35% and TikTok's bottom 660. The square does the
  same, and §4.2 leaves it out: it reads as the feed going on. In the 16:9 none of its text falls under the "Ad" label
  or Skip.
- **Decoration:** the Opening's dots spread past the zone, and in the 16:9 a few fall under the "Ad" label and Skip.

## 4. Architecture

### 4.1 Files

```
video/
  package.json          # "render": "pnpm run audio && node scripts/render.mjs"
  scripts/
    render.mjs          # new: renders every composition, or only the ids given
  src/
    layouts.ts          # new: FORMATS, Layout, LAYOUTS and the safe-zone check at load
    Root.tsx            # one composition per language and format
    Ad.tsx              # props { lang, format }; passes the layout to the scenes and the node
    YouNode.tsx         # its path from the layout (home, taps + stage origin, logo node); exports nodeStops(layout)
    brand.ts            # comments only: SIZE is the square's and the stage's side, COL the mock's column
    scenes/
      Opening.tsx       # home, text box, sizes and dots from the layout (HOME moves into the layout)
      Demo.tsx          # the mock on a stage; captions and gray cards from the layout; exports MOCK_TEXT
      EndCard.tsx       # column, logo and sizes from the layout; logoNode(layout) replaces LOGO_NODE
```

Unchanged: `Soundtrack.tsx` (it reads only times), `copy.ts`, `motion.tsx` and `scripts/soundtrack.mjs`.

`layouts.ts` in short (the `1x1` entry holds today's numbers):

```ts
export const FORMATS = ['1x1', '16x9', '9x16'] as const
export type Format = (typeof FORMATS)[number]
type Box = { x: number; y: number; w: number; h: number }
type TextAt = { top: number; size: number }
export type Layout = {
  width: number
  height: number
  zone: Box // where text and taps may go
  stage: { x: number; y: number } // the mock's origin in the frame
  home: { x: number; y: number } // the node's home
  opening: { box: Box; hook: number; promise: number; dots: number }
  caption: { box: Box; size: number; align: 'center' | 'left' }
  skeletons: number // gray cards below the fold
  endCard: {
    x: number
    w: number
    logo: { top: number; h: number } // width = h × 125 / 200, centered on the column
    title: TextAt
    cta: TextAt
    url: TextAt
    finePrint: TextAt & { lines: number }
  }
}
export const LAYOUTS: Record<Format, Layout> = { … } // the numbers in §3's table
```

- **`Ad`** takes `{ lang, format }`, looks up the layout and passes it to the scenes and the node.
- **The Opening** draws its rings, dots and text from the layout. `HOME` leaves `Opening.tsx`: the home is in the
  layout.
- **The Demo** draws the mock in a 1080×1080 stage container at the layout's origin, with the dim inside it. The
  captions and the gray cards come from the layout. It exports `MOCK_TEXT`, the mock's text area in stage coordinates.
- **The end card** takes its column and sizes from the layout, and `logoNode(layout)` replaces `LOGO_NODE`.
- **`YouNode`** builds its path per layout: the home, the taps plus the stage origin, and the logo node. It exports
  `nodeStops(layout)`, the points where the path stops, for the check.
- **`Root.tsx`** registers one composition per language and format: `ad-pt` and `ad-en` (unchanged, 1080×1080),
  `ad-pt-16x9` and `ad-en-16x9` (1920×1080), and `ad-pt-9x16` and `ad-en-9x16` (1080×1920). Each renders to
  `video/out/<id>.mp4`.
- **`render.mjs`** (plain Node, no dependencies) runs `remotion compositions src/index.ts --quiet` and splits the ids
  it prints. It keeps the ids given as arguments, or all of them when none are given, and stops on an unknown id
  before any render. Then it renders each id in turn with
  `remotion render src/index.ts <id> out/<id>.mp4 --crf=18 --jpeg-quality=100 --enforce-audio-track`. The pnpm script
  puts `node_modules/.bin` on the PATH, so `remotion` resolves as it does today.

### 4.2 The safe-zone check

`layouts.ts` checks every format when it loads, like the existing check that `hero.subLine2` has two sentences, so a
bad layout stops the Studio and every render before a frame is drawn. For each format it tests that these sit inside
the zone:

- the Opening's text box and the caption box;
- the end card's block: its column, from the logo's top to the fine print's last line (its top plus lines × size ×
  1.45);
- the mock's text area (`MOCK_TEXT` plus the stage origin);
- the node's home and every stop from `nodeStops(layout)`: the sink below home, the jump beside the comment tap, the
  five taps and the logo node.

A failure throws with the format and the element, for example
`9x16: caption (x 130–950, y 200–360) is outside the safe zone (x 120–960, y 270–1248)`.

It leaves out the camera drift (§7), the text inside each box (the stills check the wraps), the flight's arc (its
highest point is y ~116 in the 16:9, inside the zone) and the mock outside its text area: the gray cards, and the
second card once the comment box pushes it down, mostly below the zone, where it reads as the feed going on.

`layouts.ts` imports `MOCK_TEXT` and `nodeStops`, and the scenes import only `type Layout` from it, so no import cycle
exists at run time.

### 4.3 Commands

| Command                                   | What it does                                                                 |
|-------------------------------------------|------------------------------------------------------------------------------|
| `pnpm dev:video`                          | The audio, then Remotion Studio on port 3100 with all six compositions       |
| `pnpm render:video`                       | The audio, then every composition → `video/out/<id>.mp4`, one after another  |
| `pnpm render:video ad-pt-9x16 ad-en-9x16` | The audio, then only the ids given; an unknown id stops it before any render |

pnpm appends extra arguments to the script it runs, so `pnpm render:video ad-pt-9x16` reaches `render.mjs` as
`node scripts/render.mjs ad-pt-9x16`. The plan checks this before relying on it.

### 4.4 Repo gates

- `video/out/` is already gitignored.
- ESLint already covers `**/scripts/**/*.mjs` (plain ESM with Node globals) and `video/src/**/*.{ts,tsx}`.
- Prettier formats the new and changed files only (never `pnpm format`).
- No unit tests, as in the video: the check guards the layouts, and the stills guard the look.

## 5. Verification

1. **The square.** Stills of frames 75, 190, 340, 500, 690 and 880 in both languages, rendered before the first code
   change and again at the end, are pixel-identical (compared as numpy arrays).
2. **Sound.** Audio-only renders (`--codec=wav`) of all six compositions are identical, sample for sample.
3. **The check.** A box moved out on purpose (say, the 9:16 caption's top to 200) makes
   `remotion compositions src/index.ts` fail with the format and the element (RED). With the real layouts it passes and
   lists the six ids (GREEN).
4. **Overlay stills.** The six frames × 2 formats × 2 languages (24 stills), with the zone and every §3.3 reading drawn
   on top, in Pillow contact sheets. Every text's line count matches §3's table, measured on the stills. **Henriko
   approves them before the final render.**
5. **The MP4s.** `remotion ffprobe` shows 1920×1080 or 1080×1920, 30 fps, 30.0 s, H.264 plus AAC at 48 kHz stereo. No
   file has a run of more than 2 frames with nothing brighter than luma 100.
6. **`render.mjs`.** An unknown id stops it before any render, one id renders only that file, and the final run with no
   ids writes all six.
7. **Gates.** `pnpm typecheck`, `pnpm lint` and `pnpm format:check` are clean, and `pnpm -r test` is unchanged.

## 6. Docs

`docs/PLATFORM.md`:

- **§15A.** The opening names the three formats and their platforms; the uploads stay manual. A new **Formats**
  subsection covers the layouts in short, the zones and their sources, the stage and the check. "How it is built"
  moves to six compositions, `logoNode` and the node's path per layout. The commands block adds rendering by id, and
  the Mermaid flow gains `layouts.ts`, `render.mjs`, the six MP4s and each platform's ad manager. "Changing the ad"
  adds that a copy change can wrap differently per format, names the close calls (§7) and asks for stills in all
  three formats.
- **§3** (the stack line) and **§4** (the `video/` line) name the three formats. **§18**'s `render:video` row says it
  renders the six ad MP4s, or only the ids given.
- A Last-updated entry. §21's `video/**` row already covers the new files.

Outside the repo, my memory note on the video gets the formats.

## 7. Risks and fallbacks

| Risk                                                                                                                                                                                                                                                                            | Fallback                                                                                                                                                                                                                                                                                                                                                                            |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A wrap on the render differs from the measurement (Cormorant within ~1%, DM Sans ~2% low). The close calls: the PT feed caption in the 16:9 (663 px in 680), PT promise line 1 in the 9:16 (802 px rendered in 820) and the EN fine print in the 9:16 (about 1,512 px on 3 lines, 32 px more than two 740 px lines hold). | Each close call still fits its box if it flips, so only the look changes. The stills show every wrap (§5, step 4), and a box width or a size is one number in `layouts.ts`.                                                                                                                                                                                                         |
| The approved zones don't clear the strictest readings (§3.3 lists what each one catches).                                                                                                                                                                                       | Henriko judges them on the overlay stills. A stage scale in one format's layout would clear the mock, with the taps and the node's path following it; a full-size mock can't fit YouTube's top 70% (its text area is 702 px tall, the band 666). For Shorts' top, the 9:16 content can move down up to 45 px, which puts the second card's bottom at 1247, still above Meta's 1248. |
| The square changes by accident.                                                                                                                                                                                                                                                 | Its `1x1` layout holds today's numbers, and its 12 stills must stay pixel-identical (§5, step 1). The new sampler gives its 40 dots unchanged (simulated).                                                                                                                                                                                                                          |
| A later copy change wraps differently in each format.                                                                                                                                                                                                                           | The check doesn't measure text. §15A's "Changing the ad" names the close calls and asks for stills in all three formats.                                                                                                                                                                                                                                                            |
| The camera drift moves edges outward, and the check ignores it.                                                                                                                                                                                                                 | A point moves out by at most 3% of its distance from the center, and a scene's fade-out pushes up to 2% more. The 16:9 caption's left edge reaches x 141 by the end of the Demo, inside the zone's 140; while the Demo fades out, it passes 140 only once it's less than 60% visible. The stills are real frames, so they show it.                                                  |
| Remotion changes what `compositions --quiet` prints.                                                                                                                                                                                                                            | Remotion is pinned (`4.0.529`), and `render.mjs` stops when it finds no ids.                                                                                                                                                                                                                                                                                                        |
| Six renders take longer than two.                                                                                                                                                                                                                                               | About 50 s per square file on this PC, and the new formats have 1.8× the pixels: about 8 min for all six. `pnpm render:video <id> …` renders only what changed.                                                                                                                                                                                                                     |

## 8. Out of scope

A Spanish version, 4:5 and other ratios, cuts per platform (a 6 s bumper, a 15 s non-skippable ad), caption files
(SRT), thumbnails and covers, and uploading to the platforms.
