# Promotional Ad for Meta: 4:5 and 15 Seconds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four new MP4s for Meta, each a 15-second cut of the approved ad in 448 frames (14.997 s): the 4:5 for the
Facebook Feed (drawn at 1080×1350, rendered at 1440×1800) and the 9:16 for the Instagram Feed, Reels and Stories
(1080×1920), in PT and EN. The six 30 s ads and their sound stay exactly as approved.

**Architecture:** A new `video/src/timelines.ts` holds every frame the ad times, one timeline per length (`30s` and
`15s`). `Ad.tsx` passes the length's timeline to the three scenes, the gold node and the soundtrack, which stop keeping
frame constants of their own. `scripts/soundtrack.mjs` imports the same file and writes one music file per length
(`music-30s.wav`, `music-15s.wav`), and `Soundtrack.tsx` plays the length's music and fades the effects out with it.
`layouts.ts` gains a `4x5` layout and checks the node's path under every timeline; `Root.tsx` registers ten
compositions from a list of cuts (a format in a length); `render.mjs` renders the 4:5 at 4/3 and reads the ids from the
last line of `remotion compositions`. Two scratch scripts outside the repo, `$SP/meta.py` and `$SP/meta/stills.mjs`,
prove the 30 s unchanged and measure the 15 s.

**Tech Stack:** Remotion `4.0.529`, React 19, TypeScript 5.9, Node 24.19 (ESM, `node:` built-ins only; it strips the
types of an imported `.ts` file). For measuring only, outside the repo: Python 3.11 with numpy, scipy and Pillow;
`@remotion/bundler` and `@remotion/renderer` (installed with `@remotion/cli`); Remotion's bundled ffmpeg and ffprobe.

**Spec:** `docs/superpowers/specs/2026-09-29-promo-meta-design.md` (approved 2026-09-29). Read it before starting;
this plan argues from it. The ad's design is in `docs/superpowers/specs/2026-09-26-promo-video-design.md`, its sound
in `docs/superpowers/specs/2026-09-26-promo-audio-design.md` and its formats in
`docs/superpowers/specs/2026-09-28-promo-formats-design.md`; `docs/PLATFORM.md` §15A summarizes all three.

## Global Constraints

Copied from the spec; every task must meet them.

- **Output:** `video/out/ad-pt-4x5-15s.mp4` and `ad-en-4x5-15s.mp4` (1440×1800), `ad-pt-9x16-15s.mp4` and
  `ad-en-9x16-15s.mp4` (1080×1920): 30 fps, 448 frames, at most 15.0 s (14.997 s expected), H.264 plus AAC at 48 kHz
  stereo, with the 30 s flags (`--crf=18 --jpeg-quality=100 --enforce-audio-track`) plus
  `--scale=1.3333333333333333` for the 4:5.
- **Sound:** each 15 s MP4's decoded AAC measures −15 ± 1 LUFS integrated with a true peak at or below −1 dBTP; PT
  and EN are identical; an audio-only render stays below −60 dBFS in the video's last 10 ms.
- **The six 30 s ads don't change:** `ad-pt`, `ad-en`, `ad-pt-16x9`, `ad-en-16x9`, `ad-pt-9x16` and `ad-en-9x16` keep
  their ids, sizes and 900 frames; their 222 stills (37 frames each) stay pixel-identical to stills rendered before
  the first code change; their audio-only renders stay byte-identical; `music-30s.wav` is byte-identical to today's
  `music.wav`, and the 14 effect WAVs keep their sha256. Never compare MP4s: two renders of the same frames differ by
  up to 44 luma levels on edges.
- **The timelines are spec §2's numbers and the 4:5 layout is spec §3's,** value for value. A change to one goes
  through Henriko at the sheets gate (Task 6) and into the spec in the same change.
- **The check at load:** for every format and every timeline, the Opening's text box, the caption box, the end card's
  block, the mock's text area plus the stage origin, the node's home and every stop from
  `nodeStops(layout, timeline)` sit inside the zone. A failure throws
  `<format>: <element> (x <from>–<to>, y <from>–<to>) is outside the safe zone (x <from>–<to>, y <from>–<to>)`, and a
  stop is named by its frame and length, like `node stop at frame 156 of the 15s`.
- **No dark beats:** no 15 s MP4 has a run of 3 or more frames with nothing brighter than luma 100, except inside its
  own dark stretches, frames 0–5 and 60–64 (deviation 1).
- **`render.mjs`:** plain Node, no dependencies. It asks `remotion compositions src/index.ts --quiet` for the ids and
  reads them from the output's last line, so `Root.tsx` stays the only list; an unknown id stops it before any render;
  it adds `--scale=1.3333333333333333` to a `-4x5` id.
- **No new dependency,** in `video/` or anywhere, and no unit tests (the logic is timing and layout; spec §5.5).
- **Gates:** `pnpm typecheck`, `pnpm lint` and `pnpm format:check` clean; `pnpm -r test` unchanged (app 700/700,
  convex 789/789, landing 75/75).
- **Henriko approves the contact sheets before the final render.** Task 6 ends on an explicit yes.
- **Repo rules (CLAUDE.md + memory):**
  - **No git state changes at all.** No `git commit`, `git push`, `git stash`, `git checkout`, `git reset` or
    `git add`; Henriko commits everything.
  - Change files with the Edit and Write tools. Never use sed, heredocs or node scripts to edit; Bash is for
    read-only work, for running tools, and for scratch files in `$SP` (below). In the repo, the one exception is
    `cp`, `rm`, `mkdir` and output redirects for generated files under `video/out/` and `video/public/audio/` (Task 3
    deletes the orphaned `music.wav` there), plus Task 1's one-pixel change to a generated still in
    `video/out/meta-after/`.
  - Use pnpm, never npm. Never run `pnpm format` (it rewrites the whole repo); `prettier --check` and
    `pnpm format:check` only read.
  - `docs/PLATFORM.md` is updated in the same change.
- **Shell:** every command runs in Git Bash from the repo root, `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI`. Never
  `cd video` (the working directory persists between Bash calls); run the package's tools with
  `pnpm --filter video exec`, whose working directory is `video/`. Run `$SP/meta/stills.mjs` only that way, never
  with plain `node` from the repo root: Remotion looks for its Chrome under the working directory and would download
  a second copy (about 113 MB) there. Shell variables don't survive between Bash calls, so every block that uses `$SP`
  or `$PY` starts with this line:
  ```bash
  export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
  ```
- **Known noise:** every Remotion command prints a yellow "Version mismatch: zod installed 4.4.3, required 4.5.4"
  block, and after a change to its bundle's config it prints notes about its cache on stdout, even with `--quiet`.
  Both predate this work and are harmless; ignore them.

## Review Focus

The five uncovered ways this breaks for a person using the ad or the repo, most likely first. Each one is pinned to a
step in the task that owns the code.

1. **A 15 s text is gone before it's read, or the 4:5 reads worse than the square.** The holds are tight (spec §2:
   the question stays complete for 0.4 s, the posted reply for 0.5 s), and a wrap can flip. Expected: every text
   takes its format's 30 s line count, and Henriko approves the sheets before the final render, then watches the MP4s;
   a fix is numbers in `timelines.ts` or `layouts.ts`, never code. Pinned by Task 6 Steps 1 to 8.
2. **Meta shows the ad as longer than 15 s.** A 450-frame MP4 lasts 15.06 s, which Ads Manager shows as 15.1.
   Expected: each 15 s MP4 has 448 frames and lasts at most 15.0 s (14.997 s). Pinned by Task 7 Step 2.
3. **A 30 s ad changes by accident** while every scene learns to read a timeline, or when the soundtrack gains its end
   fade and its music splits in two. Expected: its 37 stills stay pixel-identical and its audio-only render
   byte-identical. Pinned by Task 1 Step 8 (the comparison fails on a one-pixel change), Task 2 Steps 15 to 17 (after
   the refactor, with a one-frame slip caught on purpose), Task 3 Steps 5 and 9 (after the music split and the fade)
   and Task 7 Step 5 (after everything).
4. **The 15 s ending clicks or cuts a bell off.** The land bell still rings when the video ends. Expected: the effects
   fade out with the music, so the audio is below −60 dBFS in the video's last 10 ms. Pinned by Task 7 Step 4.
5. **A layout typo or a stop outside the zone** in the new 4:5, or a later tweak to a timeline. Expected: the Studio,
   `remotion compositions` and every render stop before a frame is drawn, naming the format, the element and both
   rectangles, and no MP4 is touched. Pinned by Task 4 Steps 1 to 3 and Task 5 Step 7.

## Deviations from the spec (for Henriko to approve with this plan)

- **1. The dark-frame rule allows the 15 s's own dark stretches.** Spec §1 allows no run of more than 2 frames with
  nothing brighter than luma 100, but the 15 s has two by design, as the 30 s has at frames 0–5 and 86–90: frames
  0–5 (before the hook's first word) and 60–64 (from the hook's exit to the node lighting up at 64), measured on the
  dry-run MP4s. `meta.py blank` allows runs inside those two stretches and fails any other.
- **2. `clamp` is exported from `motion.tsx`.** `Soundtrack.tsx` needs the same clamped `interpolate` options for the
  end fade and the shimmer; exporting the object `motion.tsx` already has avoids a second copy.
- **3. The MP4s are probed with the bundled ffprobe, from Python.** Spec §6.2 names `remotion ffprobe`; `meta.py
  probe` runs the same binary directly, so one command checks the size, frame rate, frame count, codecs and length of
  all four files.
- **4. The 4:5 stills are 1080×1350.** Stills render at the composition's own size; only `render.mjs` passes
  `--scale`. The sheets and the line counts read frame pixels, as the layout does.
- **5. The 30 s audio is proven twice.** Spec §6.2 checks it after everything; Task 2 also checks it right after the
  refactor, with the soundtrack reading the timeline but not yet fading, so a slipped effect is caught where it
  happened. Task 3 checks it again after the fade and the music split.
- **6. The 15 s music must equal the design prototype's, and the music checks run on both lengths.** The prototype
  (`$SP/proto15/public/audio/music-15s.wav`) is the file behind spec §4's numbers, so Task 3's code must write it byte
  for byte, and `meta.py music` holds `music-30s.wav` to the same checks as the new file.
- **7. `render.mjs` reads the ids from the last line of `remotion compositions`.** Not in the spec: the dry run found
  that after a change to the bundle's config, Remotion prints "⚡️ Cached bundle. Subsequent renders will be
  faster." on stdout even with `--quiet`, so today's `render.mjs` takes those words for ids, and `pnpm render:video`
  with no ids stops with `Could not find composition with ID ⚡️`. Task 5 reproduces it (RED) before the fix (GREEN).

## File map

```
video/
  scripts/
    soundtrack.mjs      # imports timelines.ts; ARRANGEMENTS; writes music-30s.wav + music-15s.wav (Task 3)
    render.mjs          # ids from the last line; --scale for a -4x5 id; "all ten" (Task 5)
  src/
    timelines.ts        # new: FPS, LENGTHS, Length, Timeline, TIMELINES (Task 2)
    layouts.ts          # stops under every timeline (Task 2); the 4x5 layout (Task 4)
    Root.tsx            # CUTS and the id rule (Task 2: the three 30 s cuts; Task 4: ten compositions)
    Ad.tsx              # props { lang, format, length }; passes the timeline on (Task 2)
    YouNode.tsx         # flight(timeline), nodeStops(layout, timeline) (Task 2)
    Soundtrack.tsx      # the timeline's moments (Task 2); the length's music and the end fade (Task 3)
    brand.ts            # FPS and TOTAL_FRAMES move out (Task 2)
    motion.tsx          # FPS from timelines.ts; exports clamp (Task 2)
    scenes/
      Opening.tsx       # hook, rings and promise from the timeline (Task 2)
      Demo.tsx          # TAPS keeps the positions; moments(timeline); captions from the timeline (Task 2)
      EndCard.tsx       # its entrances from the timeline (Task 2)
  public/audio/         # gitignored: music.wav becomes music-30s.wav + music-15s.wav (Task 3)
  out/                  # gitignored: the ten MP4s, meta-{before,after,stills,sheets,audio}/, logs
```

Unchanged: `copy.ts`, `index.ts`, `assets.d.ts` and `video/package.json`. Modified outside `video/`:
`docs/PLATFORM.md` (Task 8). Outside the repo: `$SP/meta.py` and `$SP/meta/stills.mjs` (Task 1),
`$SP/meta/docs_check.py` and the memory notes `promo-video.md` and `MEMORY.md` (Task 8).

---

### Task 1: Baseline before any code change

**Files:**
- Create (scratchpad, not the repo): `$SP/meta.py`, and `$SP/meta/stills.mjs` if it's missing or differs
- Create (gitignored): `video/out/meta-before/` (222 stills); `video/out/meta-audio/` with `wavs-before.txt`,
  `music-before.wav`, `music-15s-prototype.wav` and `before/` (six audio-only renders)

**Interfaces:**
- Consumes: the six 30 s compositions as they are today; `video/public/audio/*.wav` (15 files, `music.wav` among
  them); the 15 s music prototype `$SP/proto15/public/audio/music-15s.wav` from the design work.
- Produces (later tasks rely on these names):
  - `$SP/meta.py` with the modes `stills [dir] [ids…]`, `audio`, `wavs`, `music`, `probe`, `blank`, `sound`,
    `lines` and `sheets`. Each prints one `PASS  …` or `FAIL  …` line per check, then `N/M checks pass`, and exits 1
    if any check fails.
  - `$SP/meta/stills.mjs <out-dir> <frames> <id…>`, run as
    `pnpm --filter video exec node "$SP/meta/stills.mjs" out/<dir> <frames> <ids…>`; it writes
    `video/out/<dir>/<id>-<frame>.png` and prints `stills: <count> in out/<dir> (<seconds> s)` last.
  - `video/out/meta-before/<id>-<frame>.png`: 37 frames of each 30 s id.
  - `video/out/meta-audio/wavs-before.txt` (the sha256 of the 15 WAVs), `music-before.wav` (today's `music.wav`),
    `music-15s-prototype.wav`, and `before/<id>.wav` for the six 30 s ids.

- [ ] **Step 1: Baseline gates**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
pnpm typecheck > "$SP/gate-typecheck.log" 2>&1; echo "exit $?"
pnpm lint > "$SP/gate-lint.log" 2>&1; echo "exit $?"
pnpm format:check > "$SP/gate-format.log" 2>&1; echo "exit $?"; tail -1 "$SP/gate-format.log"
pnpm -r test > "$SP/gate-test.log" 2>&1; echo "exit $?"; grep -aE 'Tests +[0-9]+' "$SP/gate-test.log"
```
Give the Bash call a 10-minute timeout.

Expected:
```
exit 0
exit 0
exit 0
All matched files use Prettier code style!
exit 0
landing test:       Tests  75 passed (75)
convex test:       Tests  789 passed (789)
app test:       Tests  700 passed (700)
```
The three test lines may come in another order. If a count differs, stop and tell Henriko: another session changed the
repo, and the gates at the end need the new numbers.

- [ ] **Step 2: Write the measuring script**

The file already exists from the design work: Read it first (the Write tool needs that), then Write this content over
it. Path:
```
C:\Users\henri\AppData\Local\Temp\claude\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\00ade649-c22e-4874-92b5-b97ed30d0b3b\scratchpad\meta.py
```

```python
"""Checks for the promo ad's 15 s cut for Meta (docs/superpowers/plans/2026-09-29-promo-meta.md). Scratch.

  python meta.py stills [dir] [ids…]   the 30 s stills in out/<dir>/ (meta-after) equal out/meta-before/'s
  python meta.py audio                 the six 30 s audio-only renders equal the ones from before the change
  python meta.py wavs                  the effects keep their sha256; music-30s = the old music, music-15s = prototype
  python meta.py music                 each music file: silent edges, no dropout, the bass entering on each cut
  python meta.py probe                 the four 15 s MP4s: size, 30 fps, 448 frames, H.264 + AAC, at most 15.0 s
  python meta.py blank                 the four 15 s MP4s go dark for 3+ frames only at 0-5 and 60-64
  python meta.py sound                 their AAC: loudness and true peak, PT = EN, and a silent end
  python meta.py lines                 each 15 s text wraps onto the lines of its format's 30 s
  python meta.py sheets                contact sheets of the 15 s stills with the zone, the crops and the text boxes

Run from the repo root; the files are under video/out/ and video/public/audio/. Prints one PASS or FAIL line per
check, then N/M, and exits 1 if any check fails. A missing file fails its check, not the script.
"""

import filecmp
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.io import wavfile
from scipy.signal import butter, lfilter, resample_poly, sosfilt

OUT = Path('video/out')
AUDIO = Path('video/public/audio')
BIN = Path(
    'node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.529/node_modules/@remotion/compositor-win32-x64-msvc'
)
FFMPEG, FFPROBE = BIN / 'ffmpeg.exe', BIN / 'ffprobe.exe'
SR = 48000
FRAME = SR // 30  # samples per frame
LANGS = ['pt', 'en']
OLD = ['ad-pt', 'ad-en', 'ad-pt-16x9', 'ad-en-16x9', 'ad-pt-9x16', 'ad-en-9x16']
NEW = ['ad-pt-4x5-15s', 'ad-en-4x5-15s', 'ad-pt-9x16-15s', 'ad-en-9x16-15s']
# The 30 s stills, each inside an animation (spec §6.1), and the 15 s review frames (spec §6.2).
FRAMES_30 = [10, 90, 100, 125, 150, 194, 204, 226, 240, 256, 338, 356, 366, 376, 384, 392, 412, 465, 495, 510, 531,
             540, 545, 560, 580, 590, 618, 634, 648, 699, 720, 748, 755, 762, 778, 790, 899]
FRAMES_15 = [52, 132, 226, 310, 430]
# The 15 s's own dark stretches, like the 30 s's 0-5 and 86-90: before the hook's first word, and from the hook's exit
# to the node lighting up (deviation 1).
DARK_15 = [(0, 5), (60, 64)]
EFFECTS = ['glow', 'ring-1', 'ring-2', 'ring-3', 'card', 'tap', 'shimmer', 'key-1', 'key-2', 'key-3', 'plim', 'glide',
           'land', 'pop']
LENGTHS = {'30s': (900, (210, 705)), '15s': (448, (150, 336))}  # timelines.ts: frames and cuts
# Spec §3 (4x5) and the formats spec's §3 (9x16), in frame pixels. Boxes are (x, y, w, h); `column` is the end card's
# (x, w); `fine` is (top, size, lines). `mp4` is the rendered size: the 4x5 is drawn at 1080x1350, rendered at 4/3.
LAYOUT = {
    '4x5': {'size': (1080, 1350), 'mp4': (1440, 1800), 'opening': (110, 585, 860, 450), 'hook': 88, 'promise': 96,
            'caption': (110, 145, 860, 160), 'text': 64, 'column': (110, 860), 'fine': (875, 28, 3)},
    '9x16': {'size': (1080, 1920), 'mp4': (1080, 1920), 'opening': (130, 680, 820, 450), 'hook': 88, 'promise': 96,
             'caption': (130, 330, 820, 160), 'text': 64, 'column': (170, 740), 'fine': (970, 28, 3)},
}
# The lines each 15 s text takes, frame -> (PT, EN): the question, the promise, the draft caption, the handoff's first
# sentence and the fine print, as in each format's 30 s (spec §0, detail 6).
WRAPS = {
    '4x5': {52: (3, 2), 132: (3, 4), 226: (2, 2), 310: (2, 2), 430: (3, 2)},
    '9x16': {52: (3, 2), 132: (3, 4), 226: (2, 2), 310: (2, 2), 430: (3, 3)},
}


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


GREEN, BLUE, MAGENTA, ORANGE = (40, 220, 120), (80, 160, 255), (255, 70, 200), (255, 160, 40)
# What the sheets draw on each still, in frame pixels: (legend, color, outline). BOX, the text box the line count
# measures, is drawn per frame from text_at().
READINGS = {
    '4x5': [
        ('safe zone: x 90-990, y 135-1215', GREEN, rect(90, 135, 990, 1215)),
        ('a square crop: y 135-1215', ORANGE, rect(0, 135, 1080, 1215)),
    ],
    '9x16': [
        ('safe zone: x 120-960, y 270-1248', GREEN, rect(120, 270, 960, 1248)),
        ('Meta: top 14%, bottom 35%, sides 6%, corner 40% x 300 px', BLUE,
         [(65, 269), (1015, 269), (1015, 1152), (780, 1152), (780, 1248), (65, 1248)]),
        ('Instagram Feed: the centered 4:5, y 285-1635', ORANGE, rect(0, 285, 1080, 1635)),
    ],
}
BOX = ('the text box the line count measures', MAGENTA)


def load(path):
    sr, x = wavfile.read(path)
    assert sr == SR and x.ndim == 2 and x.shape[1] == 2, path
    scale = {np.dtype('int16'): 2**15, np.dtype('int32'): 2**31}.get(x.dtype, 1)
    return x.astype(np.float64) / scale


def dbfs(v):
    return 20 * np.log10(max(v, 1e-12))


def kweight(x):
    shelf = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585])
    highpass = ([1, -2, 1], [1, -1.99004745483398, 0.99007225036621])
    return lfilter(*highpass, lfilter(*shelf, x, axis=0), axis=0)


def block_loudness(x, block, hop):
    y = kweight(x)
    c = np.concatenate([np.zeros((1, 2)), np.cumsum(y**2, axis=0)])
    starts = np.arange((len(y) - block) // hop + 1) * hop
    return -0.691 + 10 * np.log10(((c[starts + block] - c[starts]) / block).sum(axis=1) + 1e-30), starts


def integrated_lufs(x):
    l, _ = block_loudness(x, 19200, 4800)
    l = l[l > -70]
    power = lambda v: np.mean(10 ** ((v + 0.691) / 10))
    l = l[l > -0.691 + 10 * np.log10(power(l)) - 10]
    return -0.691 + 10 * np.log10(power(l))


def true_peak(x):
    return dbfs(np.abs(resample_poly(x, 4, 1, axis=0)).max())


def peaks(mp4, w, h):
    """Every frame's brightest luma. The bundled ffmpeg has no filters and no rawvideo muxer, but image2pipe carries
    raw 8-bit gray frames."""
    cmd = [str(FFMPEG), '-v', 'error', '-i', str(mp4), '-f', 'image2pipe', '-c:v', 'rawvideo', '-pix_fmt', 'gray', '-']
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    out = []
    while len(buf := proc.stdout.read(w * h)) == w * h:
        out.append(int(np.frombuffer(buf, np.uint8).max()))
    proc.wait()
    return out


def dark_runs(levels):
    """(first, last) of every run of 3 or more frames with nothing brighter than luma 100."""
    runs, start = [], None
    for i, level in enumerate(levels + [255]):
        if level <= 100 and start is None:
            start = i
        elif level > 100 and start is not None:
            if i - start > 2:
                runs.append((start, i - 1))
            start = None
    return runs


def count_lines(png, box, size, line_height):
    """Lines of text in a box: the height from the first to the last row with a pixel brighter than luma 120, in line
    pitches. Counting bands of bright rows would merge lines whose accents and descenders touch; this doesn't."""
    x, y, w, h = box
    luma = np.asarray(Image.open(png).convert('L'))[y:y + h, x:x + w]
    rows = np.flatnonzero((luma > 120).any(axis=1))
    if rows.size == 0:
        return 0
    return round((rows[-1] - rows[0] + 1 - size) / (size * line_height) + 1)


def fmt_of(id):
    return id.split('-')[2]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stills(folder='meta-after', *ids):
    results = []
    for id in ids or OLD:
        same, changed, missing = 0, [], 0
        for frame in FRAMES_30:
            a, b = OUT / 'meta-before' / f'{id}-{frame}.png', OUT / folder / f'{id}-{frame}.png'
            if not (a.exists() and b.exists()):
                missing += 1
            elif np.array_equal(np.asarray(Image.open(a)), np.asarray(Image.open(b))):
                same += 1
            else:
                changed.append(str(frame))
        text = f'stills, {id}: {same} of 37 identical to meta-before, changed: {", ".join(changed) or "none"}, '
        results.append((same == 37, text + f'missing: {missing}'))
    return results


def audio():
    results = []
    for id in OLD:
        a, b = OUT / 'meta-audio' / 'before' / f'{id}.wav', OUT / 'meta-audio' / 'after' / f'{id}.wav'
        if not (a.exists() and b.exists()):
            results.append((False, f'audio, {id}: missing {(b if a.exists() else a).as_posix()}'))
            continue
        verdict = 'identical to' if filecmp.cmp(a, b, shallow=False) else 'differs from'
        results.append((verdict == 'identical to', f'audio, {id}: after/{id}.wav {verdict} before/{id}.wav'))
    return results


def wavs():
    listing = OUT / 'meta-audio' / 'wavs-before.txt'
    lines = listing.read_text().splitlines() if listing.exists() else []
    before = {Path(name.lstrip('*')).stem: digest for digest, name in (line.split(maxsplit=1) for line in lines)}
    missing = [name for name in EFFECTS if name not in before or not (AUDIO / f'{name}.wav').exists()]
    changed = [name for name in EFFECTS if name not in missing and sha256(AUDIO / f'{name}.wav') != before[name]]
    kept = 14 - len(missing) - len(changed)
    results = [(kept == 14, f'wavs: {kept} of 14 effects keep their sha256, changed: {", ".join(changed) or "none"}, '
                            f'missing: {", ".join(missing) or "none"}')]
    for new, old in [('music-30s.wav', 'music-before.wav'), ('music-15s.wav', 'music-15s-prototype.wav')]:
        a, b = AUDIO / new, OUT / 'meta-audio' / old
        if not (a.exists() and b.exists()):
            results.append((False, f'wavs: missing {(b if a.exists() else a).as_posix()}'))
            continue
        same = filecmp.cmp(a, b, shallow=False)
        results.append((same, f'wavs: {new} {"is" if same else "is not"} byte-identical to {old}'))
    return results


def onset(e, cut, hop):
    """Frames from a cut to the first hop within 10 frames of it where the bass jumps 10 dB over the median before."""
    for h in range((cut - 10) * FRAME // hop, (cut + 10) * FRAME // hop):
        if e[h] > np.median(e[h - 100:h - 20]) + 10:
            return h * hop / FRAME - cut
    return None


def music():
    results = []
    for length, (total, cuts) in LENGTHS.items():
        path = AUDIO / f'music-{length}.wav'
        if not path.exists():
            results.append((False, f'music, {length}: missing {path.as_posix()}'))
            continue
        x = load(path)
        head, tail = dbfs(np.abs(x[:480]).max()), dbfs(np.abs(x[-480:]).max())
        loudness, starts = block_loudness(x, 19200, 4800)
        keep = (starts >= 2 * SR) & (starts + 19200 <= (total / 30 - 0.5) * SR)
        quietest = loudness[keep].min()
        low = sosfilt(butter(4, 150, 'low', fs=SR, output='sos'), x.mean(axis=1))
        hop = 240
        e = 10 * np.log10(np.add.reduceat(low**2, np.arange(0, len(low), hop)) / hop + 1e-20)
        onsets = [onset(e, cut, hop) for cut in cuts]
        ok = max(head, tail) <= -60 and quietest >= -40 and all(o is not None and abs(o) <= 1 for o in onsets)
        found = ', '.join(f'frame {c} ' + ('none' if o is None else f'{o:+.2f}') for c, o in zip(cuts, onsets))
        results.append((ok, f'music, {length}: edges {head:.0f}/{tail:.0f} dBFS (max -60), quietest 400 ms '
                            f'{quietest:.1f} LUFS (min -40), bass onsets {found} (frames, max ±1)'))
    return results


def probe():
    results = []
    entries = 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration'
    for id in NEW:
        mp4 = OUT / f'{id}.mp4'
        if not mp4.exists():
            results.append((False, f'probe, {id}: missing {mp4.as_posix()}'))
            continue
        cmd = [str(FFPROBE), '-v', 'error', '-show_entries', entries, '-of', 'json', str(mp4)]
        info = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
        video = next(s for s in info['streams'] if s['codec_type'] == 'video')
        sound = next(s for s in info['streams'] if s['codec_type'] == 'audio')
        seconds = float(info['format']['duration'])
        w, h = LAYOUT[fmt_of(id)]['mp4']
        ok = (video['codec_name'] == 'h264' and (video['width'], video['height']) == (w, h)
              and video['r_frame_rate'] == '30/1' and video['nb_frames'] == '448' and sound['codec_name'] == 'aac'
              and sound['sample_rate'] == '48000' and sound['channels'] == 2 and seconds <= 15.0)
        results.append((ok, f'probe, {id}: {video["codec_name"]} {video["width"]}x{video["height"]} '
                            f'{video["r_frame_rate"]} fps, {video["nb_frames"]} frames; {sound["codec_name"]} '
                            f'{sound["sample_rate"]} Hz, {sound["channels"]} channels; {seconds:.3f} s (max 15.0)'))
    return results


def blank():
    results = []
    for id in NEW:
        mp4 = OUT / f'{id}.mp4'
        if not mp4.exists():
            results.append((False, f'blank, {id}: missing {mp4.as_posix()}'))
            continue
        levels = peaks(mp4, *LAYOUT[fmt_of(id)]['mp4'])
        runs = dark_runs(levels)
        ok = len(levels) == 448 and all(any(a <= s and e <= b for a, b in DARK_15) for s, e in runs)
        found = ', '.join(f'{s}-{e}' for s, e in runs) or 'none'
        results.append((ok, f'blank, {id}: {len(levels)} frames, dark runs of 3+: {found} (allowed: 0-5, 60-64)'))
    return results


def sound():
    results, decoded = [], {}
    folder = OUT / 'meta-audio' / 'aac'
    folder.mkdir(parents=True, exist_ok=True)
    for id in NEW:
        mp4, wav = OUT / f'{id}.mp4', folder / f'{id}.wav'
        if not mp4.exists():
            results.append((False, f'sound, {id}: missing {mp4.as_posix()}'))
            continue
        cmd = [str(FFMPEG), '-v', 'error', '-y', '-i', str(mp4), '-vn', '-c:a', 'pcm_s24le', str(wav)]
        subprocess.run(cmd, check=True)
        x = decoded[id] = load(wav)
        lufs, tp = integrated_lufs(x), true_peak(x)
        results.append((-16 <= lufs <= -14 and tp <= -1, f'sound, {id}: {lufs:.2f} LUFS (-15 ± 1), '
                                                          f'true peak {tp:.2f} dBTP (max -1)'))
    for fmt in ['4x5', '9x16']:
        pt, en = decoded.get(f'ad-pt-{fmt}-15s'), decoded.get(f'ad-en-{fmt}-15s')
        same = pt is not None and en is not None and np.array_equal(pt, en)
        results.append((same, f'sound, {fmt}: PT and EN {"identical" if same else "differ or missing"}'))
    end = OUT / 'meta-audio' / 'after' / 'ad-pt-4x5-15s.wav'
    if not end.exists():
        return results + [(False, f'sound, end: missing {end.as_posix()}')]
    level = dbfs(np.abs(load(end)[448 * FRAME - 480:448 * FRAME]).max())
    return results + [(level <= -60, f'sound, end: the 15 s audio-only render peaks at {level:.1f} dBFS in the '
                                     f"video's last 10 ms (max -60)")]


def text_at(fmt, frame):
    """The box a review frame's text sits in, its font size and its line height (Opening, Demo, EndCard)."""
    layout = LAYOUT[fmt]
    if frame == 52:
        return layout['opening'], layout['hook'], 1.1
    if frame == 132:
        return layout['opening'], layout['promise'], 1.05
    if frame == 430:
        (x, w), (top, size, lines) = layout['column'], layout['fine']
        return (x, top, w, round((lines + 1) * size * 1.45)), size, 1.45
    return layout['caption'], layout['text'], 1.1


def lines():
    results = []
    for id in NEW:
        fmt, lang = fmt_of(id), id.split('-')[1]
        found, ok = [], True
        for frame in FRAMES_15:
            want = WRAPS[fmt][frame][LANGS.index(lang)]
            png = OUT / 'meta-stills' / f'{id}-{frame}.png'
            if not png.exists():
                found.append(f'{frame}=missing')
                ok = False
                continue
            n = count_lines(png, *text_at(fmt, frame))
            found.append(f'{frame}={n}' + ('' if n == want else f' (expected {want})'))
            ok = ok and n == want
        results.append((ok, f'lines, {id}: {", ".join(found)}'))
    return results


def sheets():
    results = []
    font = ImageFont.load_default(size=28)
    for id in NEW:
        fmt = fmt_of(id)
        pngs = [OUT / 'meta-stills' / f'{id}-{frame}.png' for frame in FRAMES_15]
        missing = [png.name for png in pngs if not png.exists()]
        if missing:
            results.append((False, f'sheets, {id}: {len(missing)} of {len(FRAMES_15)} stills missing'))
            continue
        readings = READINGS[fmt]
        legends = [(label, color) for label, color, _ in readings] + [BOX]
        w, h = (side // 2 for side in LAYOUT[fmt]['size'])
        top = 20 + 40 * len(legends)
        sheet = Image.new('RGB', (len(FRAMES_15) * w, top + h), (14, 19, 32))
        draw = ImageDraw.Draw(sheet)
        for i, (label, color) in enumerate(legends):
            draw.line([(20, 34 + 40 * i), (80, 34 + 40 * i)], fill=color, width=5)
            draw.text((96, 20 + 40 * i), label, fill=(245, 240, 232), font=font)
        for i, (frame, png) in enumerate(zip(FRAMES_15, pngs)):
            still = Image.open(png).convert('RGB')
            pen = ImageDraw.Draw(still)
            for _, color, points in readings:
                pen.line(points + points[:1], fill=color, width=5)
            (x, y, bw, bh), _, _ = text_at(fmt, frame)
            pen.rectangle([x, y, x + bw, y + bh], outline=MAGENTA, width=3)
            sheet.paste(still.resize((w, h), Image.Resampling.LANCZOS), (i * w, top))
            draw.rectangle([i * w, top, i * w + 170, top + 40], fill=(0, 0, 0))
            draw.text((i * w + 10, top + 6), f'frame {frame}', fill=(245, 240, 232), font=font)
        path = OUT / 'meta-sheets' / f'{id}.png'
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path)
        results.append((True, f'sheets, {id}: {path.as_posix()}'))
    return results


MODES = {'stills': stills, 'audio': audio, 'wavs': wavs, 'music': music, 'probe': probe, 'blank': blank,
         'sound': sound, 'lines': lines, 'sheets': sheets}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in MODES or (sys.argv[1] != 'stills' and len(sys.argv) > 2):
        sys.exit(f'usage: python meta.py stills [dir] [ids…] | {" | ".join(m for m in MODES if m != "stills")}')
    results = MODES[sys.argv[1]](*sys.argv[2:])
    for ok, text in results:
        print(f'{"PASS" if ok else "FAIL"}  {text}')
    passed = sum(ok for ok, _ in results)
    print(f'{passed}/{len(results)} checks pass')
    sys.exit(0 if passed == len(results) else 1)
```

What each mode reads: `stills` compares `video/out/<dir>/` (default `meta-after`) with `meta-before/`; `audio`
compares `video/out/meta-audio/after/` with `before/`; `wavs` reads `wavs-before.txt` and the two saved music files;
`probe`, `blank` and `sound` read the four 15 s MP4s (and `sound` also `meta-audio/after/ad-pt-4x5-15s.wav`); `lines`
and `sheets` read `video/out/meta-stills/`.

- [ ] **Step 3: Check the stills script**

Read this file. If it's missing, or its content differs from the block below, Write the block over it (Read it first
if it exists). Path:
```
C:\Users\henri\AppData\Local\Temp\claude\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\00ade649-c22e-4874-92b5-b97ed30d0b3b\scratchpad\meta\stills.mjs
```

```js
// Scratch, outside the repo (docs/superpowers/plans/2026-09-29-promo-meta.md). Renders stills of the ad, each on a
// fresh page, after bundling video/src once; the CLI's `remotion still` bundles on every call (about 7 s a still).
//
//   node stills.mjs <out-dir> <frames> <id> [<id> …]      writes <out-dir>/<id>-<frame>.png
//
// <frames> is a comma-separated list, like 10,90,100.

import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const REPO = 'D:/ERP/LinkIntoTheSSI/LinkIntoTheSSI'
// pnpm keeps @remotion/bundler and @remotion/renderer, which @remotion/cli installs, in its hidden hoisted folder.
const require = createRequire(`${REPO}/node_modules/.pnpm/node_modules/noop.js`)
const { bundle } = require('@remotion/bundler')
const { openBrowser, renderStill, selectComposition } = require('@remotion/renderer')

const [outDir, frameList, ...ids] = process.argv.slice(2)
if (!outDir || !frameList || ids.length === 0) throw new Error('usage: node stills.mjs <out-dir> <frames> <id> [<id> …]')
const frames = frameList.split(',').map(Number)
mkdirSync(outDir, { recursive: true })
const started = Date.now()
const serveUrl = await bundle({
  entryPoint: `${REPO}/video/src/index.ts`,
  rootDir: `${REPO}/video`,
  publicDir: `${REPO}/video/public`,
  // video/remotion.config.ts's override, which the CLI applies to its bundles too
  webpackOverride: config => ({ ...config, output: { ...config.output, assetModuleFilename: '[hash][ext]' } })
})
const browser = await openBrowser('chrome')
let count = 0
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser })
  for (const frame of frames) {
    const output = join(outDir, `${id}-${frame}.png`)
    await renderStill({ composition, serveUrl, frame, output, imageFormat: 'png', overwrite: true, puppeteerInstance: browser })
    count++
  }
}
await browser.close({ silent: true })
console.log(`stills: ${count} in ${outDir} (${Math.round((Date.now() - started) / 1000)} s)`)
```

Why a script instead of `remotion still`: the CLI bundles `video/src` on every call (about 7 s a still), and 222
stills would take about 26 minutes; this bundles once and renders them in about 100 s. Each still still gets a fresh
page, as with the CLI.

- [ ] **Step 4: Build today's WAVs**

Run:
```bash
pnpm --filter video audio 2>&1 | tail -1
```
Expected: `soundtrack: 15 WAVs in D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\public\audio (2.3 s)`; the time
varies. The script is seeded, so the files come out as they were; this makes sure the baseline is today's script's
output.

- [ ] **Step 5: Save the audio baseline**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
mkdir -p video/out/meta-audio
sha256sum video/public/audio/*.wav > video/out/meta-audio/wavs-before.txt; wc -l < video/out/meta-audio/wavs-before.txt
cp video/public/audio/music.wav video/out/meta-audio/music-before.wav
cp "$SP/proto15/public/audio/music-15s.wav" video/out/meta-audio/music-15s-prototype.wav
stat -c '%n %s' video/out/meta-audio/music-before.wav video/out/meta-audio/music-15s-prototype.wav
```

Expected:
```
15
video/out/meta-audio/music-before.wav 5760044
video/out/meta-audio/music-15s-prototype.wav 2867244
```
If `cp` can't find the prototype, stop and tell Henriko: it's the file spec §4 measured, and Task 3's code must write
it byte for byte.

- [ ] **Step 6: A missing file fails its check, not the script**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta.py" probe; echo "exit $?"
```

Expected:
```
FAIL  probe, ad-pt-4x5-15s: missing video/out/ad-pt-4x5-15s.mp4
FAIL  probe, ad-en-4x5-15s: missing video/out/ad-en-4x5-15s.mp4
FAIL  probe, ad-pt-9x16-15s: missing video/out/ad-pt-9x16-15s.mp4
FAIL  probe, ad-en-9x16-15s: missing video/out/ad-en-9x16-15s.mp4
0/4 checks pass
exit 1
```

- [ ] **Step 7: Render the 222 before-stills**

Run (about 2 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
F=10,90,100,125,150,194,204,226,240,256,338,356,366,376,384,392,412,465,495,510,531,540,545,560,580,590,618,634,648,699,720,748,755,762,778,790,899
IDS="ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16"
pnpm --filter video exec node "$SP/meta/stills.mjs" out/meta-before $F $IDS > "$SP/stills.log" 2>&1; echo "exit $?"; grep -a '^stills:' "$SP/stills.log"; ls video/out/meta-before | wc -l
```

Expected: `exit 0`, `stills: 222 in out/meta-before (101 s)` (the time varies), then `222`. If it fails, read the
end of `$SP/stills.log`. The 37 frames each sit inside an animation (spec §6.1), so a timing slip of one frame anywhere
changes at least one of them.

- [ ] **Step 8: Prove the still comparison can fail**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
rm -rf video/out/meta-after && cp -r video/out/meta-before video/out/meta-after
$PY "$SP/meta.py" stills; echo "exit $?"
$PY -c "import numpy as np; from PIL import Image; p='video/out/meta-after/ad-pt-10.png'; a=np.array(Image.open(p)); a[0,0,0]^=1; Image.fromarray(a).save(p)"
$PY "$SP/meta.py" stills; echo "exit $?"
rm -rf video/out/meta-after
```

Expected: first six lines like `PASS  stills, ad-pt: 37 of 37 identical to meta-before, changed: none, missing: 0`
(one per 30 s id), `6/6 checks pass` and `exit 0`; then
`FAIL  stills, ad-pt: 36 of 37 identical to meta-before, changed: 10, missing: 0`, five `PASS` lines,
`5/6 checks pass` and `exit 1`. What this proves: the comparison sees a change of one level in one channel of one
pixel.

- [ ] **Step 9: Render the six 30 s audio-only baselines**

Run (about 2.5 minutes; give the Bash call a 10-minute timeout):
```bash
mkdir -p video/out/meta-audio/before
for id in ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16; do pnpm --filter video exec remotion render src/index.ts $id out/meta-audio/before/$id.wav --codec=wav --enforce-audio-track > /dev/null 2>&1 || echo "render failed: $id"; done; ls video/out/meta-audio/before | wc -l
```

Expected: `6`, and no `render failed` line. If one fails, run it again without the redirect to see why. An
audio-only render mixes the soundtrack exactly as the MP4 does, before the AAC encoder, and comes out the same bytes
on every run, which the MP4s don't.

- [ ] **Step 10: No commit.** Henriko commits.

### Task 2: One timeline per length, the 30 s unchanged

**Files:**
- Create: `video/src/timelines.ts`
- Modify: `video/src/brand.ts`, `video/src/motion.tsx`, `video/src/scenes/Opening.tsx`,
  `video/src/scenes/EndCard.tsx`, `video/src/scenes/Demo.tsx`, `video/src/layouts.ts`
- Replace: `video/src/YouNode.tsx`, `video/src/Soundtrack.tsx` (an interim version; Task 3 writes the final one),
  `video/src/Ad.tsx`, `video/src/Root.tsx` (the three 30 s cuts; Task 4 adds the two 15 s ones)
- Create (gitignored): `video/out/meta-after/` (222 stills) and `video/out/meta-audio/after/` (six audio-only renders)

**Interfaces:**
- Consumes: Task 1's `$SP/meta.py` (`stills`, `audio`), `$SP/meta/stills.mjs`, `video/out/meta-before/` and
  `video/out/meta-audio/before/`.
- Produces (later tasks rely on these names):
  - `timelines.ts`: `FPS` (30), `LENGTHS` (`['30s', '15s'] as const`), `type Length`, `type Timeline` and
    `TIMELINES: Record<Length, Timeline>`. It imports nothing, so `scripts/soundtrack.mjs` can import it (Task 3).
  - `motion.tsx` exports `clamp`, the clamped `interpolate` options.
  - `scenes/Demo.tsx`: `TAPS` keeps each tap's stage position only (`{ x, y }`), and `moments(timeline)` returns
    `{ boxOpen, generating, dim, window, pasted, posted }`.
  - `Opening`, `Demo` and `EndCard` take `{ copy, layout, timeline }`.
  - `YouNode.tsx`: `flight(timeline)` returns `{ at, dur, arc }`; `nodeStops(layout, timeline)`;
    `YouNode({ layout, timeline })`.
  - `Soundtrack({ length }: { length: Length })`.
  - `Ad.tsx`: `AdProps = { lang: Lang; format: Format; length: Length }`.
  - `Root.tsx`: `CUTS: [Format, Length][]`, one entry per format in a length, and the id rule: `ad-<lang>`, then
    `-<format>` unless it's the square, then `-<length>` unless it's the 30 s.
  - Gone: `FPS` and `TOTAL_FRAMES` from `brand.ts`, `BRIGHTEN` and `RINGS` from `Opening.tsx`, `LANDED` and `CTA_AT`
    from `EndCard.tsx`, `T` from `Demo.tsx`, and `FLIGHT` from `YouNode.tsx`.

The 30 s timeline holds today's frames, so after this task every 30 s picture and sound lands where it did; Steps 15
to 17 prove it. The 15 s timeline is spec §2's; `layouts.ts` checks its node stops from this task on, but no
composition plays it until Task 4. The intermediate states between Steps 1 and 11 don't compile; Step 12 checks the
whole.

- [ ] **Step 1: Write the timelines**

Path: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\timelines.ts` (new)
```ts
// When things happen, one timeline per length: the 30 s the ad was designed with, and the 15 s cut for Meta
// (PLATFORM.md §15A "Lengths"). Positions live in layouts.ts and Demo.tsx, and movements (how long a rise, a tap or
// the flight takes) in the scenes. scripts/soundtrack.mjs imports this file too, so it imports nothing and keeps to
// syntax Node can strip: types, annotations and `as const`.
export const FPS = 30
export const LENGTHS = ['30s', '15s'] as const
export type Length = (typeof LENGTHS)[number]
type Span = { at: number; out: number } // a text enters at `at` and starts leaving at `out`
export type Timeline = {
  total: number // the composition's frames
  cuts: { feed: number; end: number } // Opening → Demo → end card; the next scene fades in over the 12 frames before
  // The question (hook), the gold node lighting up (brighten) and pulsing (rings), and the promise.
  opening: { hook: Span; brighten: number; rings: number[]; promise: number }
  // The node sinks as the Opening ends and jumps, hidden, beside the first tap. It leaves `lead` frames before each
  // tap and takes `travel` frames to get there.
  node: { sink: number; jump: number; lead: number; travel: number }
  demo: {
    cards: number[]
    taps: { comment: number; generate: number; submit: number; paste: number; post: number }
    typing: [number, number]
    captions: { feed?: Span; draft: Span; handoff: Span; automatic?: Span }
  }
  endCard: { reveal: number; title: number; landed: number; cta: number; url: number; finePrint: number }
}

export const TIMELINES: Record<Length, Timeline> = {
  '30s': {
    total: 900,
    cuts: { feed: 210, end: 705 },
    opening: { hook: { at: 4, out: 84 }, brighten: 90, rings: [96, 120, 144], promise: 98 },
    node: { sink: 186, jump: 330, lead: 24, travel: 18 },
    demo: {
      cards: [222, 236, 250],
      taps: { comment: 372, generate: 408, submit: 525, paste: 575, post: 605 },
      typing: [440, 490],
      // The first caption enters with the Demo's fade-in (cuts.feed − 12), so the cross-fade from the Opening never
      // goes blank; the draft's leaves on Submit, and a caption that leaves at `total` goes with the Demo.
      captions: {
        feed: { at: 198, out: 360 },
        draft: { at: 374, out: 525 },
        handoff: { at: 539, out: 628 },
        automatic: { at: 642, out: 900 }
      }
    },
    endCard: { reveal: 712, title: 742, landed: 750, cta: 758, url: 772, finePrint: 782 }
  },
  // 448 frames make a 14.997 s MP4, whose AAC runs past the video; 450 would show as 15.1 s in Meta's Ads Manager.
  '15s': {
    total: 448,
    cuts: { feed: 150, end: 336 },
    opening: { hook: { at: 4, out: 58 }, brighten: 64, rings: [70, 88, 106], promise: 72 },
    node: { sink: 126, jump: 142, lead: 12, travel: 8 },
    demo: {
      cards: [138, 144, 150],
      taps: { comment: 168, generate: 186, submit: 234, paste: 266, post: 284 },
      typing: [200, 224],
      captions: { draft: { at: 138, out: 234 }, handoff: { at: 248, out: 448 } }
    },
    endCard: { reveal: 326, title: 356, landed: 364, cta: 372, url: 380, finePrint: 386 }
  }
}
```

Every 30 s number is today's constant: the feed caption's 198 was `210 - XF`, the draft's 525 was `TAPS.submit.at`,
and the last caption's 900 was `TOTAL_FRAMES`. Every 15 s number is spec §2's.

- [ ] **Step 2: Take `FPS` and `TOTAL_FRAMES` out of the brand**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\brand.ts`: old
```
export const SIZE = 1080
export const FPS = 30
export const TOTAL_FRAMES = 900 // 30 s
export const XF = 12 // cross-fade length, in frames
```
→ new
```
export const SIZE = 1080
export const XF = 12 // cross-fade length, in frames
```

- [ ] **Step 3: `motion.tsx` takes `FPS` from the timelines and exports `clamp`**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\motion.tsx`: old
```
import { EASE, FPS, XF } from './brand'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
```
→ new
```
import { EASE, XF } from './brand'
import { FPS } from './timelines'

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
```

- [ ] **Step 4: The Opening reads its frames from the timeline**

Five edits.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Opening.tsx`: old
```
import { exitStyle, progress, STAGGER, Words } from '../motion'

// The frame the gold "you" node lights up and the frames it pulses (YouNode.tsx draws it; its home is in the layout).
export const BRIGHTEN = 90
export const RINGS = [96, 120, 144]

const RING_LIFE = 72 // frames for a ring to grow to RING_MAX
const RING_MAX = 1040 // px: past the farthest dot, so every dot lights up fully
const HOOK_AT = 4
const HOOK_OUT = 84
const PROMISE_AT = 98
```
→ new
```
import { exitStyle, progress, STAGGER, Words } from '../motion'
import type { Timeline } from '../timelines'

const RING_LIFE = 72 // frames for a ring to grow to RING_MAX
const RING_MAX = 1040 // px: past the farthest dot, so every dot lights up fully
```

Edit: old
```
export function Opening({ copy, layout }: { copy: AdCopy; layout: Layout }) {
  const frame = useCurrentFrame()
  const dots = useMemo(() => makeDots(layout), [layout])
  const { home, opening } = layout
  const reach = RING_MAX * progress(frame, RINGS[0], RING_LIFE)
  const line2At = PROMISE_AT + copy.promise[0].split(' ').length * STAGGER + 6
```
→ new
```
export function Opening({ copy, layout, timeline }: { copy: AdCopy; layout: Layout; timeline: Timeline }) {
  const frame = useCurrentFrame()
  const dots = useMemo(() => makeDots(layout), [layout])
  const { home, opening } = layout
  const { hook, rings, promise: promiseAt } = timeline.opening
  const reach = RING_MAX * progress(frame, rings[0], RING_LIFE)
  const line2At = promiseAt + copy.promise[0].split(' ').length * STAGGER + 6
```

Edit: old
```
        {RINGS.map(at => {
```
→ new
```
        {rings.map(at => {
```

Edit: old
```
        {frame < HOOK_OUT + XF ? (
          <div style={{ fontSize: opening.hook, lineHeight: 1.1, ...exitStyle(frame, HOOK_OUT) }}>
            <Words
              text={copy.hook}
              start={HOOK_AT}
```
→ new
```
        {frame < hook.out + XF ? (
          <div style={{ fontSize: opening.hook, lineHeight: 1.1, ...exitStyle(frame, hook.out) }}>
            <Words
              text={copy.hook}
              start={hook.at}
```

Edit: old
```
                start={PROMISE_AT}
```
→ new
```
                start={promiseAt}
```

- [ ] **Step 5: The end card reads its frames from the timeline**

Five edits.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\EndCard.tsx`: old
```
import { C, FPS, SANS, SERIF } from '../brand'
import type { AdCopy } from '../copy'
import type { Layout } from '../layouts'
import { enterStyle, progress, Words } from '../motion'

export const LANDED = 750
export const CTA_AT = 758 // the CTA pill pops in
export const FINE_PRINT_LINE = 1.45 // the fine print's line height (layouts.ts sizes the end card's block with it)
```
→ new
```
import { C, SANS, SERIF } from '../brand'
import type { AdCopy } from '../copy'
import type { Layout } from '../layouts'
import { enterStyle, progress, Words } from '../motion'
import { FPS, type Timeline } from '../timelines'

export const FINE_PRINT_LINE = 1.45 // the fine print's line height (layouts.ts sizes the end card's block with it)
```

Edit: old
```
export function EndCard({ copy, layout }: { copy: AdCopy; layout: Layout }) {
  const frame = useCurrentFrame()
  const { x, w, title, cta, url, finePrint } = layout.endCard
  const logo = logoBox(layout)
  const centered: CSSProperties = { position: 'absolute', left: x, width: w, textAlign: 'center' }
  // The L rises from the bottom. The clip stops 20% from the top, so the logo's own node never shows.
  const reveal = progress(frame, 712, 40)
  const pop = spring({ frame: Math.max(0, frame - CTA_AT), fps: FPS, config: { damping: 12 } })
```
→ new
```
export function EndCard({ copy, layout, timeline }: { copy: AdCopy; layout: Layout; timeline: Timeline }) {
  const frame = useCurrentFrame()
  const { x, w, title, cta, url, finePrint } = layout.endCard
  const at = timeline.endCard
  const logo = logoBox(layout)
  const centered: CSSProperties = { position: 'absolute', left: x, width: w, textAlign: 'center' }
  // The L rises from the bottom. The clip stops 20% from the top, so the logo's own node never shows.
  const reveal = progress(frame, at.reveal, 40)
  // The CTA pill pops in.
  const pop = spring({ frame: Math.max(0, frame - at.cta), fps: FPS, config: { damping: 12 } })
```

Edit: old
```
          start={742}
```
→ new
```
          start={at.title}
```

Edit: old
```
          ...enterStyle(frame, 772)
```
→ new
```
          ...enterStyle(frame, at.url)
```

Edit: old
```
          ...enterStyle(frame, 782)
```
→ new
```
          ...enterStyle(frame, at.finePrint)
```

- [ ] **Step 6: The Demo reads its frames from the timeline**

Seven edits. `TAPS` keeps the positions, and `moments()` replaces `T`.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Demo.tsx`: old
```
import { C, COL, SANS, SERIF, SIZE, TOTAL_FRAMES, XF } from '../brand'
import type { AdCopy, Post } from '../copy'
import type { Layout } from '../layouts'
import { exitStyle, progress, rise, Words } from '../motion'
```
→ new
```
import { C, COL, SANS, SERIF, SIZE, XF } from '../brand'
import type { AdCopy, Post } from '../copy'
import type { Layout } from '../layouts'
import { exitStyle, progress, rise, Words } from '../motion'
import type { Timeline } from '../timelines'
```

Edit: old
```
// Where and when the gold node taps (YouNode.tsx), computed from the same constants that place the buttons.
export const TAPS = {
  comment: { at: 372, x: LEFT + CARD.react + GAP + CARD.comment / 2, y: CARD.top + CARD.h - B - (CARD.footer - B) / 2 },
  generate: { at: 408, x: LEFT + BOX.combo + GAP + BOX.gen / 2, y: BOX.top + B + PAD + BOX.row / 2 },
  submit: { at: 525, x: RIGHT - BOX.submit / 2, y: BOX.top + BOX.h - B - PAD - BOX.submitH / 2 },
  paste: { at: 575, x: (INPUT.left + INPUT.right) / 2, y: ROW_Y },
  post: { at: 605, x: WIN_RIGHT - WIN.button / 2, y: ROW_Y }
}

// What each tap sets off. Soundtrack.tsx plays its effects on these frames too.
export const T = {
  cards: [222, 236, 250],
  boxOpen: TAPS.comment.at + 6,
  generating: TAPS.generate.at + 2,
  typing: [440, 490],
  dim: TAPS.submit.at + 7,
  window: TAPS.submit.at + 15,
  pasted: TAPS.paste.at + 2,
  posted: TAPS.post.at + 4
}
```
→ new
```
// Where the gold node taps (YouNode.tsx), computed from the same constants that place the buttons. When is in the
// timeline (timelines.ts).
export const TAPS = {
  comment: { x: LEFT + CARD.react + GAP + CARD.comment / 2, y: CARD.top + CARD.h - B - (CARD.footer - B) / 2 },
  generate: { x: LEFT + BOX.combo + GAP + BOX.gen / 2, y: BOX.top + B + PAD + BOX.row / 2 },
  submit: { x: RIGHT - BOX.submit / 2, y: BOX.top + BOX.h - B - PAD - BOX.submitH / 2 },
  paste: { x: (INPUT.left + INPUT.right) / 2, y: ROW_Y },
  post: { x: WIN_RIGHT - WIN.button / 2, y: ROW_Y }
}

// What each tap sets off, from the timeline's taps. Soundtrack.tsx plays its effects on these frames too.
export const moments = ({ demo: { taps } }: Timeline) => ({
  boxOpen: taps.comment + 6,
  generating: taps.generate + 2,
  dim: taps.submit + 7,
  window: taps.submit + 15,
  pasted: taps.paste + 2,
  posted: taps.post + 4
})
```

Edit: old
```
function CommentBox({ copy, open }: { copy: AdCopy; open: number }) {
  const f = useCurrentFrame()
  const generating = f >= T.generating && f < T.typing[0]
  const label = f < T.generating ? copy.ui.generate : generating ? copy.ui.generating : copy.ui.regenerate
  const typed = Math.round(
    interpolate(f, T.typing, [0, copy.draft.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  )
  const caret = f >= T.typing[0] && f < T.typing[1] + 6
```
→ new
```
function CommentBox({ copy, open, timeline }: { copy: AdCopy; open: number; timeline: Timeline }) {
  const f = useCurrentFrame()
  const t = moments(timeline)
  const { typing } = timeline.demo
  const generating = f >= t.generating && f < typing[0]
  const label = f < t.generating ? copy.ui.generate : generating ? copy.ui.generating : copy.ui.regenerate
  const typed = Math.round(
    interpolate(f, typing, [0, copy.draft.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  )
  const caret = f >= typing[0] && f < typing[1] + 6
```

Edit: old
```
function LinkedInWindow({ copy }: { copy: AdCopy }) {
  const f = useCurrentFrame()
  if (f < T.window) return null
  const s = rise(f, T.window)
  const posted = progress(f, T.posted, 20)
  const pasted = f >= T.pasted && f < T.posted
```
→ new
```
function LinkedInWindow({ copy, timeline }: { copy: AdCopy; timeline: Timeline }) {
  const f = useCurrentFrame()
  const t = moments(timeline)
  if (f < t.window) return null
  const s = rise(f, t.window)
  const posted = progress(f, t.posted, 20)
  const pasted = f >= t.pasted && f < t.posted
```

Edit: old
```
export function Demo({ copy, layout }: { copy: AdCopy; layout: Layout }) {
  const f = useCurrentFrame()
  const open = rise(f, T.boxOpen)
  const push = open * (BOX.h + GAP) // the open comment box pushes the cards below it down
  const dim = progress(f, T.dim, 20)
  const enter = (i: number): CSSProperties => {
    const s = rise(f, T.cards[i])
```
→ new
```
export function Demo({ copy, layout, timeline }: { copy: AdCopy; layout: Layout; timeline: Timeline }) {
  const f = useCurrentFrame()
  const t = moments(timeline)
  const { cards, captions } = timeline.demo
  const open = rise(f, t.boxOpen)
  const push = open * (BOX.h + GAP) // the open comment box pushes the cards below it down
  const dim = progress(f, t.dim, 20)
  const enter = (i: number): CSSProperties => {
    const s = rise(f, cards[i])
```

Edit: old
```
          {f >= T.boxOpen && (
            <CommentBox
              copy={copy}
              open={open}
```
→ new
```
          {f >= t.boxOpen && (
            <CommentBox
              copy={copy}
              open={open}
              timeline={timeline}
```

The captions take their frames from the timeline. The 15 s has no feed caption and no "Nothing is automated." caption
(spec §2), so those two render only when the timeline has them.

Edit: old
```
        <LinkedInWindow copy={copy} />
      </div>
      {/* Starts with the Demo's fade-in in Ad.tsx, so the cross-fade from the Opening never goes blank. */}
      <Caption
        text={copy.feedCaption}
        at={210 - XF}
        out={360}
        layout={layout}
      />
      <Caption
        text={copy.draftCaption}
        at={374}
        out={TAPS.submit.at}
        layout={layout}
      />
      <Caption
        text={copy.handoff[0]}
        at={539}
        out={628}
        layout={layout}
      />
      <Caption
        text={copy.handoff[1]}
        at={642}
        out={TOTAL_FRAMES}
        layout={layout}
      />
```
→ new
```
        <LinkedInWindow
          copy={copy}
          timeline={timeline}
        />
      </div>
      {captions.feed && (
        <Caption
          text={copy.feedCaption}
          {...captions.feed}
          layout={layout}
        />
      )}
      <Caption
        text={copy.draftCaption}
        {...captions.draft}
        layout={layout}
      />
      <Caption
        text={copy.handoff[0]}
        {...captions.handoff}
        layout={layout}
      />
      {captions.automatic && (
        <Caption
          text={copy.handoff[1]}
          {...captions.automatic}
          layout={layout}
        />
      )}
```

- [ ] **Step 7: The gold node follows the timeline**

Read the file first (the Write tool needs that), then Write this content over it.

Path: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\YouNode.tsx`
```tsx
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
```

- [ ] **Step 8: The soundtrack plays on the timeline's frames (interim)**

This version still plays `music.wav` and doesn't fade the effects out: Task 3 changes both, so Step 17 proves this
refactor on its own. Read the file first, then Write this content over it.

Path: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Soundtrack.tsx`
```tsx
import { Html5Audio, interpolate, random, Sequence, staticFile } from 'remotion'
import { clamp } from './motion'
import { moments } from './scenes/Demo'
import { type Length, TIMELINES } from './timelines'
import { flight } from './YouNode'

// Plays video/public/audio/*.wav (scripts/soundtrack.mjs writes them): the music from frame 0, and each effect on the
// frame of the moment that times its picture, so a moved tap takes its sound along. Levels are baked into the files.
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
  const { opening, demo, endCard } = timeline
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
      <Html5Audio src={audio('music')} />
      {oneShots.map(({ at, name }) => (
        <Sequence
          key={`${name}@${at}`}
          from={at}
          layout="none"
        >
          <Html5Audio src={audio(name)} />
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
```

- [ ] **Step 9: The ad passes its length's timeline on**

Read the file first, then Write this content over it.

Path: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Ad.tsx`
```tsx
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
```

- [ ] **Step 10: Register the compositions from a list of cuts**

Only the three 30 s cuts for now; Task 4 adds the two 15 s ones. Read the file first, then Write this content over it.

Path: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Root.tsx`
```tsx
import { Composition } from 'remotion'
import { Ad } from './Ad'
import { LANGS } from './copy'
import { type Format, LAYOUTS } from './layouts'
import { FPS, type Length, TIMELINES } from './timelines'

// Which length each format comes in (PLATFORM §15A "Lengths").
const CUTS: [Format, Length][] = [
  ['1x1', '30s'], // LinkedIn
  ['16x9', '30s'], // YouTube in-stream
  ['9x16', '30s'] // YouTube Shorts and TikTok
]
// One component, registered once per language and cut. The id is `ad-<lang>`, then `-<format>` unless it's the square,
// then `-<length>` unless it's the 30 s: `ad-pt`, `ad-en-9x16`, `ad-pt-4x5-15s`. The six 30 s ids keep their names.
const ADS = CUTS.flatMap(([format, length]) =>
  LANGS.map(lang => ({
    id: `ad-${lang}${format === '1x1' ? '' : `-${format}`}${length === '30s' ? '' : `-${length}`}`,
    lang,
    format,
    length
  }))
)

export function Root() {
  return (
    <>
      {ADS.map(({ id, lang, format, length }) => (
        <Composition
          key={id}
          id={id}
          component={Ad}
          width={LAYOUTS[format].width}
          height={LAYOUTS[format].height}
          fps={FPS}
          durationInFrames={TIMELINES[length].total}
          defaultProps={{ lang, format, length }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 11: Check the node's stops under every timeline**

Three edits. The check at load now walks the node's path under both timelines in every format, and names a stop by
its frame and length.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old
```
import { FINE_PRINT_LINE } from './scenes/EndCard'
import { nodeStops } from './YouNode'
```
→ new
```
import { FINE_PRINT_LINE } from './scenes/EndCard'
import { LENGTHS, TIMELINES } from './timelines'
import { nodeStops } from './YouNode'
```

Edit: old
```
// home and every stop on its path must sit inside the format's zone, or the Studio and every render stop here. It
// leaves out the camera drift, the text inside each box, the flight's arc and the gray cards.
```
→ new
```
// home and every stop on its path under every timeline must sit inside the format's zone, or the Studio and every
// render stop here. It leaves out the camera drift, the text inside each box, the flight's arc and the gray cards.
```

Edit: old
```
    ...nodeStops(layout).map((stop): [string, Box] => [`node stop at frame ${stop.at}`, point(stop)])
```
→ new
```
    ...LENGTHS.flatMap(length =>
      nodeStops(layout, TIMELINES[length]).map((stop): [string, Box] => [
        `node stop at frame ${stop.at} of the ${length}`,
        point(stop)
      ])
    )
```

- [ ] **Step 12: Types, lint and format**

Run:
```bash
pnpm --filter video exec tsc --noEmit; echo "exit $?"
pnpm exec eslint video --max-warnings 0; echo "exit $?"
pnpm exec prettier --check video/src video/scripts; echo "exit $?"
```

Expected:
```
exit 0
exit 0
Checking formatting...
All matched files use Prettier code style!
exit 0
```
If Prettier flags a file, `pnpm exec prettier video/src/<file>` prints the formatted file without writing it; copy the
difference in with Edit.

- [ ] **Step 13: No old frame constant is left**

Run:
```bash
grep -rnE 'TOTAL_FRAMES|BRIGHTEN|RINGS|HOOK_AT|HOOK_OUT|PROMISE_AT|LANDED|CTA_AT|FLIGHT|\bT\.[a-z]' video/src; echo "exit $?"
```

Expected: no match, then `exit 1` (grep's exit code when nothing matches).

- [ ] **Step 14: The six compositions still load**

Run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null | tail -1
```

Expected: `ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16`. Loading the bundle runs the check at load, so this
also proves every 15 s node stop sits inside the square's, the 16:9's and the 9:16's zones.

- [ ] **Step 15: Every 30 s still is unchanged**

Run (about 2 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
F=10,90,100,125,150,194,204,226,240,256,338,356,366,376,384,392,412,465,495,510,531,540,545,560,580,590,618,634,648,699,720,748,755,762,778,790,899
IDS="ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16"
rm -rf video/out/meta-after
pnpm --filter video exec node "$SP/meta/stills.mjs" out/meta-after $F $IDS > "$SP/stills.log" 2>&1; echo "exit $?"; grep -a '^stills:' "$SP/stills.log"
$PY "$SP/meta.py" stills; echo "exit $?"
```

Expected: `exit 0`, `stills: 222 in out/meta-after (101 s)` (the time varies), then six lines like
`PASS  stills, ad-pt: 37 of 37 identical to meta-before, changed: none, missing: 0` (one per 30 s id),
`6/6 checks pass` and `exit 0`. A `FAIL` line names the frames that changed: open
`video/out/meta-after/<id>-<frame>.png` next to the same file in `meta-before/`, find what moved, fix the edit in
Steps 1 to 11 that moved it, and run this step again. Never re-render `meta-before/`.

- [ ] **Step 16: Prove a one-frame slip is caught**

Move the Generate tap one frame later, on purpose.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\timelines.ts`: old
```
taps: { comment: 372, generate: 408, submit: 525, paste: 575, post: 605 }
```
→ new
```
taps: { comment: 372, generate: 409, submit: 525, paste: 575, post: 605 }
```

Run (under a minute):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
F=10,90,100,125,150,194,204,226,240,256,338,356,366,376,384,392,412,465,495,510,531,540,545,560,580,590,618,634,648,699,720,748,755,762,778,790,899
rm -rf video/out/meta-sens
pnpm --filter video exec node "$SP/meta/stills.mjs" out/meta-sens $F ad-pt > "$SP/stills.log" 2>&1; echo "exit $?"; grep -a '^stills:' "$SP/stills.log"
$PY "$SP/meta.py" stills meta-sens ad-pt; echo "exit $?"
```

Expected: `exit 0`, a `stills: 37 in out/meta-sens` line with the seconds it took, then
```
FAIL  stills, ad-pt: 35 of 37 identical to meta-before, changed: 392, 412, missing: 0
0/1 checks pass
exit 1
```
Frame 392 is the node's travel to the tap (it leaves 24 frames before it), and 412 the tap's ring. Now put the tap
back.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\timelines.ts`: old
```
taps: { comment: 372, generate: 409, submit: 525, paste: 575, post: 605 }
```
→ new
```
taps: { comment: 372, generate: 408, submit: 525, paste: 575, post: 605 }
```

Run the same block again. Expected: `exit 0`, the `stills: 37` line, then
`PASS  stills, ad-pt: 37 of 37 identical to meta-before, changed: none, missing: 0`, `1/1 checks pass` and `exit 0`.
Then run `rm -rf video/out/meta-sens`.

- [ ] **Step 17: Every 30 s sound is unchanged**

Run (about 2.5 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
rm -rf video/out/meta-audio/after && mkdir -p video/out/meta-audio/after
for id in ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16; do pnpm --filter video exec remotion render src/index.ts $id out/meta-audio/after/$id.wav --codec=wav --enforce-audio-track > /dev/null 2>&1 || echo "render failed: $id"; done; ls video/out/meta-audio/after | wc -l
$PY "$SP/meta.py" audio; echo "exit $?"
```

Expected: `6`, then six lines like `PASS  audio, ad-pt: after/ad-pt.wav identical to before/ad-pt.wav` (one per 30 s
id), `6/6 checks pass` and `exit 0`. A `differs from` line means an effect moved: compare the one-shot list in
`Soundtrack.tsx` and `moments()` in `Demo.tsx` with the constants the edits removed.

- [ ] **Step 18: No commit.** Henriko commits.

### Task 3: Music per length and the end fade

**Files:**
- Modify: `video/scripts/soundtrack.mjs`
- Replace: `video/src/Soundtrack.tsx` (the final version)
- Generated (gitignored): `video/public/audio/music-30s.wav` and `music-15s.wav`, which replace `music.wav` (this task
  deletes it); `video/out/meta-audio/after/` again

**Interfaces:**
- Consumes: `FPS`, `LENGTHS` and `TIMELINES` from `video/src/timelines.ts` (Task 2), which the script imports as
  `'../src/timelines.ts'` (Node strips the types); `moments` (`scenes/Demo.tsx`), `flight` (`YouNode.tsx`) and
  `clamp` (`motion.tsx`) from Task 2; Task 1's `video/out/meta-audio/` (`wavs-before.txt`, `music-before.wav`,
  `music-15s-prototype.wav`, `before/`).
- Produces:
  - `scripts/soundtrack.mjs` writes 16 WAVs: `music-30s.wav` (5,760,044 bytes, byte-identical to today's
    `music.wav`), `music-15s.wav` (2,867,244 bytes, byte-identical to the design prototype) and the 14 effects,
    unchanged. `ARRANGEMENTS` holds each length's chords, and `music(length)` renders one length.
  - `Soundtrack.tsx` plays `music-<length>.wav` and fades every one-shot effect from 1 to 0 over the composition's
    last 15 frames, with the music.

The 30 s comes out of the same arithmetic as before, down to the last bit: `at(900 / 30)` is 1,440,000 samples, as
`30 * 48000` was; `(END - FEED) / (4 * bars.length)` divides by 32, as the old `BEAT` did; `fullFrom: 4`,
`pulseBars: 2` and `driveDb: 1` are the old `k >= 4` and `e >= 32`, `2 * BAR` and `MUSIC_DRIVE_DB`. The 15 s
arrangement is the design prototype's (spec §4), so Step 5 holds the new file to it byte for byte.

- [ ] **Step 1: See the music check fail**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta.py" wavs; echo "exit $?"
```

Expected:
```
PASS  wavs: 14 of 14 effects keep their sha256, changed: none, missing: none
FAIL  wavs: missing video/public/audio/music-30s.wav
FAIL  wavs: missing video/public/audio/music-15s.wav
1/3 checks pass
exit 1
```

- [ ] **Step 2: One arrangement per length in the soundtrack script**

Fourteen edits, in file order. The script imports the timelines instead of repeating their numbers, and `music(length)`
computes the beat, the breath and the chords' segments from the length's cuts and arrangement.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\scripts\soundtrack.mjs`: old
```
// The ad's soundtrack, synthesized in code with no dependencies: music.wav plus one WAV per sound effect, written to
// video/public/audio/ (gitignored) after a self-check. Soundtrack.tsx plays them: the music from frame 0, each effect
// on the frame of its event. PLATFORM.md §15A "Sound" has the map.
```
→ new
```
// The ad's soundtrack, synthesized in code with no dependencies: a music file per length (music-30s.wav and
// music-15s.wav) plus one WAV per sound effect, written to video/public/audio/ (gitignored) after a self-check.
// Soundtrack.tsx plays them: the length's music from frame 0, each effect on the frame of its event. PLATFORM.md §15A
// "Sound" has the map.
```

Edit: old
```
import { performance } from 'node:perf_hooks'

// The one manual coupling. This script can't import brand.ts (font imports) or Ad.tsx (JSX), so the timeline's numbers
// are repeated here: move a cut, or change the length or the frame rate, and change them here too.
const FPS = 30 // brand.ts FPS
const TOTAL_FRAMES = 900 // brand.ts TOTAL_FRAMES
const FEED_CUT = 210 // Ad.tsx: the Opening hands over to the Demo, and the beat enters
const END_CUT = 705 // Ad.tsx: the Demo hands over to the EndCard, and the music resolves

// Levels in dB. The music is mastered to MUSIC_PEAK_DB, and each effect is normalized to its PEAK_DB.
const MUSIC_PEAK_DB = -3
const MUSIC_DRIVE_DB = 1 // how hard the music hits its limiter: more is louder at the same peak
const PEAK_DB = {
```
→ new
```
import { performance } from 'node:perf_hooks'
import { FPS, LENGTHS, TIMELINES } from '../src/timelines.ts'

// Levels in dB. The music is mastered to MUSIC_PEAK_DB, and each effect is normalized to its PEAK_DB.
const MUSIC_PEAK_DB = -3
const PEAK_DB = {
```

Edit: old
```
const THIRD_DB = 0 // ring-2's F#3 pad voice, against one pad voice in music.wav
```
→ new
```
const THIRD_DB = 0 // ring-2's F#3 pad voice, against one pad voice in music-30s.wav
```

Edit: old
```
const SR = 48000
const SECONDS = TOTAL_FRAMES / FPS
const LENGTH = SECONDS * SR // samples per channel in music.wav
const FEED = FEED_CUT / FPS // 7.0 s
const END = END_CUT / FPS // 23.5 s
const BEAT = (END - FEED) / 32 // 8 bars of 4 beats between the cuts: 0.515625 s, about 116.36 BPM
const BAR = 4 * BEAT
const BREATH = FEED + 7 * BAR + 2 * BEAT // bar 8, beat 3: the beat stops and A sus4 turns to A
const GLIDE_FRAMES = 50 // YouNode.tsx FLIGHT.dur: the glide lasts exactly the flight
const SHIMMER_SECONDS = 1 // Demo.tsx T.generating → T.typing[0] (30 frames); its Sequence cuts anything longer

// The loop is D, Bm, G, A, twice, the second time ending A sus4 → A; the end card resolves D, G/D, D. Each chord has
// its pad voicing, the top voice the fuller parts add, the bass root and the four notes the pluck cycles through.
```
→ new
```
const SR = 48000
// The two numbers repeated by hand; timelines.ts has the rest of the timing. The glide lasts exactly the flight
// (YouNode.tsx flight(), 50 frames in both lengths), and the shimmer's Sequence cuts it at typing[0] (Demo.tsx
// moments().generating → typing[0]: 30 frames in the 30 s, 12 in the 15 s).
const GLIDE_FRAMES = 50
const SHIMMER_SECONDS = 1

// The chords the arrangements use (ARRANGEMENTS below). Each has its pad voicing, the top voice the fuller parts add,
// the bass root and the four notes the pluck cycles through.
```

Edit: old
```
const INTRO = ['D3', 'A3', 'D4', 'E4'] // Dsus2, no third: an open question. ring-2.wav brings the F#.
const FEED_BARS = [['D'], ['Bm'], ['G'], ['A'], ['D'], ['Bm'], ['G'], ['Asus4', 'A']] // two chords split the bar
const END_BARS = [['D'], ['G/D'], ['D']]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3] // the arpeggio note each eighth plays
```
→ new
```
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
```

Edit: old
```
const SHIMMER_NOTES = ['E6', 'F#6', 'A6', 'B6', 'E7', 'F#7', 'A7', 'B7'] // they fit every chord of the loop

// Every chord with its start and end (s). `full` marks the second pass and the end card, which add the top voice.
const SEGMENTS = [
  [FEED_BARS, FEED],
  [END_BARS, END]
].flatMap(([bars, from]) =>
  bars.flatMap((chords, k) =>
    chords.map((name, j) => {
      const start = from + k * BAR + (j * BAR) / chords.length
      return { chord: CHORDS[name], start, end: start + BAR / chords.length, full: from === END || k >= 4 }
    })
  )
)
const chordAt = t => SEGMENTS.find(s => t >= s.start && t < s.end).chord
```
→ new
```
const SHIMMER_NOTES = ['E6', 'F#6', 'A6', 'B6', 'E7', 'F#7', 'A7', 'B7'] // they fit every chord of the loop
```

Edit: old
```
function music() {
  const rng = mulberry32(1)
```
→ new
```
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
```

Edit: old
```
  // The feed, in eighths: kick on 1 and 3, clap on 2 and 4, hats on every eighth (the offbeats louder), the bass
  // pulsing on the root and the pluck on the arpeggio, doubled an octave up in the second pass. At BREATH it all stops
  // for a strum on A.
```
→ new
```
  // The feed, in eighths: kick on 1 and 3, clap on 2 and 4, hats on every eighth (the offbeats louder), the bass
  // pulsing on the root and the pluck on the arpeggio, doubled an octave up from bar `fullFrom` on. At BREATH it all
  // stops for a strum on A.
```

Edit: old
```
    if (e >= 32) add(plucks, pluck(2 * hz(chord.arp[i]), 0.8, rng), t, db(MIX_DB.octave), -PANS[i])
```
→ new
```
    if (e >= 8 * fullFrom) add(plucks, pluck(2 * hz(chord.arp[i]), 0.8, rng), t, db(MIX_DB.octave), -PANS[i])
```

Edit: old
```
  // The end card: the impact lands on D. Kick and bass keep pulsing for two bars under quarter-note plucks; the last D
  // drops the kick, holds the bass and strums, ringing into the fade.
  add(fx, normalize(impact(), MIX_DB.impact), END)
  const last = END + 2 * BAR
```
→ new
```
  // The end card: the impact lands on D. Kick and bass keep pulsing for `pulseBars` bars (two in the 30 s, one in the
  // 15 s) under quarter-note plucks; the last D drops the kick, holds the bass and strums, ringing into the fade.
  add(fx, normalize(impact(), MIX_DB.impact), END)
  const last = END + pulseBars * BAR
```

Edit: old
```
  const drive = db(MUSIC_DRIVE_DB) / peak(master)
```
→ new
```
  const drive = db(driveDb) / peak(master)
```

Edit: old
```
// ring-2: the F# bell, plus the pad's third. A pad voice on F#3 swells in under the bell, holds past the cut to the
// feed (whose D chord brings its own F#3) and releases, at the level of one pad voice in music.wav.
function ringWithThird(padGain) {
  const hold = 3.4 // s: ring-2 plays at 4.0 s, so the voice ends near 7.4 s
```
→ new
```
// ring-2: the F# bell, plus the pad's third. A pad voice on F#3 swells in under the bell, holds past the cut to the
// feed (whose D chord brings its own F#3) and releases, at the level of one pad voice in music-30s.wav (0.4 dB over
// one in music-15s.wav: both lengths share the effects).
function ringWithThird(padGain) {
  const hold = 3.4 // s: ring-2 plays at 4.0 s in the 30 s and 2.9 s in the 15 s, so the voice ends near 7.4 s or 6.3 s
```

Edit: old
```
function check(files) {
  const errors = []
  if (files.music.l.length !== LENGTH) errors.push(`music.wav has ${files.music.l.length} samples, not ${LENGTH}`)
  for (const [name, track] of Object.entries(files)) {
    if (!channels(track).every(ch => ch.every(Number.isFinite))) errors.push(`${name}.wav has a NaN or infinite sample`)
    const limitDb = name === 'music' ? MUSIC_PEAK_DB : PEAK_DB[name.replace(/-\d$/, '')]
```
→ new
```
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
```

Edit: old
```
const started = performance.now()
const { track, padGain } = music()
const files = { music: track, ...effects(padGain) }
check(files)
```
→ new
```
const started = performance.now()
const musics = Object.fromEntries(LENGTHS.map(length => [length, music(length)]))
// One set of effects for both lengths: ring-2's third sits at the 30 s pad's level.
const files = {
  ...Object.fromEntries(LENGTHS.map(length => [`music-${length}`, musics[length].track])),
  ...effects(musics['30s'].padGain)
}
check(files)
```

- [ ] **Step 3: No old name is left in the script**

Run:
```bash
grep -nE 'music\.wav|MUSIC_DRIVE_DB|TOTAL_FRAMES|FEED_CUT|END_CUT|FEED_BARS|END_BARS' video/scripts/soundtrack.mjs; echo "exit $?"
```

Expected: no match, then `exit 1`.

- [ ] **Step 4: Write the WAVs**

Run:
```bash
pnpm --filter video audio 2>&1 | tail -1
```

Expected: `soundtrack: 16 WAVs in D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\public\audio (2.9 s)`; the time varies.
The script's self-check counts each music file's samples against its length before writing anything.

- [ ] **Step 5: The 30 s music is today's, and the 15 s music is the prototype's**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta.py" wavs; echo "exit $?"
$PY "$SP/meta.py" music; echo "exit $?"
```

Expected:
```
PASS  wavs: 14 of 14 effects keep their sha256, changed: none, missing: none
PASS  wavs: music-30s.wav is byte-identical to music-before.wav
PASS  wavs: music-15s.wav is byte-identical to music-15s-prototype.wav
3/3 checks pass
exit 0
PASS  music, 30s: edges -240/-90 dBFS (max -60), quietest 400 ms -26.1 LUFS (min -40), bass onsets frame 210 +0.00, frame 705 +0.00 (frames, max ±1)
PASS  music, 15s: edges -240/-84 dBFS (max -60), quietest 400 ms -25.5 LUFS (min -40), bass onsets frame 150 +0.00, frame 336 +0.00 (frames, max ±1)
2/2 checks pass
exit 0
```
An `is not byte-identical` line means an edit in Step 2 changed the arithmetic: compare each one with the block above
again. The script is seeded, so the same code always writes the same bytes.

- [ ] **Step 6: The soundtrack plays the length's music and fades the effects out with it**

Read the file first (the Write tool needs that), then Write this content over it.

Path: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Soundtrack.tsx`
```tsx
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
```

Two changes from Task 2's version: the music is `music-<length>.wav`, and each one-shot effect fades out over the
composition's last 15 frames, as the music does. In the 15 s the land bell still rings when the video ends; in the
30 s every effect is over by frame 870, before the fade starts at 885. Each effect still gets Remotion's volume filter
(it plays until the composition ends, so its callback drops below 1 there), but the filter multiplies every sample
that plays by exactly 1.0 (spec §0, detail 4; Step 9 proves it).

- [ ] **Step 7: Types, lint and format**

Run:
```bash
pnpm --filter video exec tsc --noEmit; echo "exit $?"
pnpm exec eslint video --max-warnings 0; echo "exit $?"
pnpm exec prettier --check video/src video/scripts; echo "exit $?"
```

Expected:
```
exit 0
exit 0
Checking formatting...
All matched files use Prettier code style!
exit 0
```

- [ ] **Step 8: Delete the orphaned music file**

Nothing plays `music.wav` any more, and the script no longer writes it. Run:
```bash
rm video/public/audio/music.wav; ls video/public/audio | wc -l
```

Expected: `16`.

- [ ] **Step 9: Every 30 s sound is still unchanged**

Run (about 2.5 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
rm -rf video/out/meta-audio/after && mkdir -p video/out/meta-audio/after
for id in ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16; do pnpm --filter video exec remotion render src/index.ts $id out/meta-audio/after/$id.wav --codec=wav --enforce-audio-track > /dev/null 2>&1 || echo "render failed: $id"; done; ls video/out/meta-audio/after | wc -l
$PY "$SP/meta.py" audio; echo "exit $?"
```

Expected: `6`, then six lines like `PASS  audio, ad-pt: after/ad-pt.wav identical to before/ad-pt.wav` (one per 30 s
id), `6/6 checks pass` and `exit 0`.

If a line says `differs from`, the fade reached a 30 s sound. The fallback ends each effect's Sequence with its sound,
so no callback runs past it. In `video/src/Soundtrack.tsx`, add this block after the `const audio` line, with a blank
line before it:
```tsx
// Each effect's length in frames (its WAV's samples / 1600, rounded up), so its Sequence ends with its sound: in the
// 30 s every callback then returns 1, and Remotion adds no volume filter.
const SOUND_FRAMES: Record<string, number> = {
  glow: 90,
  'ring-1': 90,
  'ring-2': 147,
  'ring-3': 90,
  card: 3,
  tap: 3,
  'key-1': 3,
  'key-2': 3,
  'key-3': 3,
  plim: 60,
  land: 120,
  pop: 6
}
```
and give the one-shot `<Sequence>` the line `durationInFrames={SOUND_FRAMES[name]}` after `from={at}`. Then run
Steps 7 and 9 again. If a line still says `differs from`, stop and tell Henriko.

- [ ] **Step 10: No commit.** Henriko commits.

### Task 4: The 4:5 layout and ten compositions

**Files:**
- Modify: `video/src/layouts.ts`, `video/src/Root.tsx`
- Create (gitignored): `video/out/check.log`

**Interfaces:**
- Consumes: `LAYOUTS`, `FORMATS` and the check at load in `layouts.ts`, which Task 2 made walk the node's stops under
  every timeline; `CUTS` and the id rule in `Root.tsx` (Task 2).
- Produces: `FORMATS = ['1x1', '16x9', '9x16', '4x5']`; `LAYOUTS['4x5']`, spec §3's layout value for value; ten
  compositions, the six 30 s ids and then `ad-pt-4x5-15s`, `ad-en-4x5-15s`, `ad-pt-9x16-15s` and `ad-en-9x16-15s`.

The check at load is this task's test. Step 1 writes the caption 20 px higher than spec §3's (y 125 instead of 145,
10 px above the zone's top at 135), Step 2 watches the check reject it, and Step 3 sets the real value.

- [ ] **Step 1: Add the 4:5 layout, with its caption too high**

Three edits.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old
```
// The ad's three shapes: the square for the LinkedIn feed, 16:9 for YouTube in-stream ads, and 9:16 for Shorts, Reels,
// Stories and TikTok. Each composition is one language in one format (Root.tsx).
export const FORMATS = ['1x1', '16x9', '9x16'] as const
```
→ new
```
// The ad's four shapes: the square for the LinkedIn feed, 16:9 for YouTube in-stream ads, 9:16 for Shorts, Reels,
// Stories and TikTok, and 4:5 for the Facebook Feed. Each composition is one language in one format and one length
// (Root.tsx).
export const FORMATS = ['1x1', '16x9', '9x16', '4x5'] as const
```

Edit: old
```
  home: Point // the gold node's home in the Opening
  opening: { box: Box; hook: number; promise: number; dots: number }
```
→ new
```
  home: Point // the gold node's home in the Opening
  // `dots`: one per ~12,580 px² of makeDots()' free area (Opening.tsx), the density of the square and the 9:16
  opening: { box: Box; hook: number; promise: number; dots: number }
```

Edit: old
```
      finePrint: { top: 970, size: 28, lines: 3 }
    }
  }
}
```
→ new
```
      finePrint: { top: 970, size: 28, lines: 3 }
    }
  },
  // 4:5 for the Facebook Feed, drawn at 1080×1350 and rendered at 4/3 (render.mjs). The texts sit in the central
  // square (y 135–1215), which a 1:1 crop keeps: the Opening and the end card are the square moved down 135 px,
  // and the mock only 45 px, so the caption sits high and the feed runs to the bottom edge.
  '4x5': {
    width: 1080,
    height: 1350,
    zone: { x: 90, y: 135, w: 900, h: 1080 },
    stage: { x: 0, y: 45 },
    home: { x: 540, y: 385 },
    opening: { box: { x: 110, y: 585, w: 860, h: 450 }, hook: 88, promise: 96, dots: 60 },
    caption: { box: { x: 110, y: 125, w: 860, h: 160 }, size: 64, align: 'center' },
    skeletons: 1,
    endCard: {
      x: 110,
      w: 860,
      logo: { top: 325, h: 200 },
      title: { top: 555, size: 60 },
      cta: { top: 663, size: 34 },
      url: { top: 795, size: 30 },
      finePrint: { top: 875, size: 28, lines: 3 }
    }
  }
}
```

- [ ] **Step 2: Watch the check at load reject the caption**

Run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet > video/out/check.log 2>&1; echo "exit $?"; grep -a -o '[0-9]*x[0-9]*: [a-z0-9 ]* ([^)]*) is outside the safe zone ([^)]*)' video/out/check.log | sort -u
```

Expected:
```
exit 1
4x5: caption (x 110–970, y 125–285) is outside the safe zone (x 90–990, y 135–1215)
```
The message comes out more than once (the error, its stack and Remotion's summary), so the grep keeps one copy. Any
other message means a number in Step 1 differs from spec §3: compare them.

- [ ] **Step 3: Put the caption where spec §3 has it**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old
```
    caption: { box: { x: 110, y: 125, w: 860, h: 160 }, size: 64, align: 'center' },
```
→ new
```
    caption: { box: { x: 110, y: 145, w: 860, h: 160 }, size: 64, align: 'center' },
```

Run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet > video/out/check.log 2>&1; echo "exit $?"; grep -a -o '[0-9]*x[0-9]*: [a-z0-9 ]* ([^)]*) is outside the safe zone ([^)]*)' video/out/check.log | sort -u
pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null | tail -1
```

Expected: `exit 0` and no message, then `ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16`. The 4:5 passes
for both timelines, although no composition uses it yet: the check walks every format.

- [ ] **Step 4: Register the two 15 s cuts**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Root.tsx`: old
```
  ['9x16', '30s'] // YouTube Shorts and TikTok
]
```
→ new
```
  ['9x16', '30s'], // YouTube Shorts and TikTok
  ['4x5', '15s'], // Facebook Feed
  ['9x16', '15s'] // Instagram Feed, Reels and Stories
]
```

Run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null | tail -1
```

Expected:
`ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16 ad-pt-4x5-15s ad-en-4x5-15s ad-pt-9x16-15s ad-en-9x16-15s`.
The six 30 s ids come first and keep their names.

- [ ] **Step 5: Types, lint and format**

Run:
```bash
pnpm --filter video exec tsc --noEmit; echo "exit $?"
pnpm exec eslint video --max-warnings 0; echo "exit $?"
pnpm exec prettier --check video/src video/scripts; echo "exit $?"
```

Expected:
```
exit 0
exit 0
Checking formatting...
All matched files use Prettier code style!
exit 0
```

- [ ] **Step 6: No commit.** Henriko commits.

### Task 5: `render.mjs` renders the 4:5 at 4/3 and reads the ids from the last line

**Files:**
- Replace: `video/scripts/render.mjs`
- Create (gitignored): `video/out/ad-pt-4x5-15s.mp4` (rendered twice here; Task 7 renders it again),
  `video/out/render-4x5.log`, `render-bogus.log` and `render-bad.log`

**Interfaces:**
- Consumes: the ten compositions (Task 4), the check at load (Tasks 2 and 4), and Root.tsx's id rule: a 4:5 id
  contains `-4x5`.
- Produces: `pnpm render:video [ids…]`, which renders every composition or only the ids given to
  `video/out/<id>.mp4`, adds `--scale=1.3333333333333333` to a `-4x5` id, and stops before any render on an unknown id
  (`Error: Unknown id: …`) or on a failed check at load.

Two failing runs first, each against today's script: the 4:5 renders at its drawn size, and a list of ids picks up
Remotion's cache note as ids (deviation 7). The fix makes both pass, and Step 7 proves a bad layout stops the script
before any MP4 is written.

- [ ] **Step 1: Snapshot the MP4s**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
stat -c '%n %Y' video/out/*.mp4 > "$SP/mp4-before.txt"; cat "$SP/mp4-before.txt"
```

Expected: one line per MP4 in `video/out/` with its modification time, the six 30 s ads among them. Later steps diff
against this file to see which MP4s a run wrote.

- [ ] **Step 2: See the 4:5 render at its drawn size**

Run (about 35 s):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
FFPROBE=node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.529/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe
pnpm render:video ad-pt-4x5-15s > video/out/render-4x5.log 2>&1; echo "exit $?"
"$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of default=nw=1 video/out/ad-pt-4x5-15s.mp4
stat -c '%n %Y' video/out/*.mp4 | diff "$SP/mp4-before.txt" -
stat -c '%n %Y' video/out/*.mp4 > "$SP/mp4-before.txt"
```

Expected: `exit 0`, `width=1080` and `height=1350` (the failure: Meta gets the drawn size, not 1440×1800), then a
diff with one added line, for `video/out/ad-pt-4x5-15s.mp4`. The last line takes a new snapshot.

- [ ] **Step 3: See a list of ids pick up Remotion's cache note**

The first command deletes Remotion's webpack cache, so the next bundle prints its cache note on stdout. Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
pnpm --filter video exec remotion compositions src/index.ts --quiet --bundle-cache=false > /dev/null 2>&1
pnpm render:video ad-bogus > video/out/render-bogus.log 2>&1; echo "exit $?"; grep -a '^Error: Unknown id' video/out/render-bogus.log; stat -c '%n %Y' video/out/*.mp4 | diff "$SP/mp4-before.txt" - && echo "no MP4 touched"
```

Expected:
```
exit 1
Error: Unknown id: ad-bogus. The compositions are ⚡️, Cached, bundle., Subsequent, renders, will, be, faster., ad-pt, ad-en, ad-pt-16x9, ad-en-16x9, ad-pt-9x16, ad-en-9x16, ad-pt-4x5-15s, ad-en-4x5-15s, ad-pt-9x16-15s, ad-en-9x16-15s.
no MP4 touched
```
The eight words before `ad-pt` are the failure: today's script takes every word of the output for an id, so
`pnpm render:video` with no ids would try to render `⚡️` first. If the note doesn't appear (the list starts at
`ad-pt`), run the block again: the note only comes on the first bundle after the cache is deleted.

- [ ] **Step 4: Write the new render script**

Read the file first (the Write tool needs that), then Write this content over it.

Path: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\scripts\render.mjs`
```js
// Renders the ad to video/out/<id>.mp4: every composition Root.tsx registers, or only the ids given. `pnpm render`
// runs it after the audio.
//
//   pnpm render:video                                all ten, one after another
//   pnpm render:video ad-pt-4x5-15s ad-en-4x5-15s    only these; an unknown id stops it before any render

import { execSync } from 'node:child_process'
import { join } from 'node:path'

const cwd = join(import.meta.dirname, '..')
// Remotion bundles src/ to list the compositions (~10 s), so Root.tsx stays the only list of ids. Loading the bundle
// also runs the safe-zone check in layouts.ts, so a bad layout stops here too.
const listed = execSync('remotion compositions src/index.ts --quiet', { cwd, encoding: 'utf8' })
// The ids are the last line: Remotion may print notes to stdout first, about its cache after a change to the bundle's
// config (such as a Remotion upgrade) or about the Chrome download on a machine's first run, and those aren't ids.
const known = listed.trim().split('\n').at(-1).split(/\s+/).filter(Boolean)
if (known.length === 0) throw new Error('remotion compositions listed no ids')
const asked = process.argv.slice(2)
const unknown = asked.filter(id => !known.includes(id))
if (unknown.length > 0) throw new Error(`Unknown id: ${unknown.join(', ')}. The compositions are ${known.join(', ')}.`)
const FLAGS = '--crf=18 --jpeg-quality=100 --enforce-audio-track'
// The 4:5 is drawn at 1080×1350 and redrawn at 4/3 as 1440×1800, not upscaled. Node can't import layouts.ts (it
// imports TSX), so the format comes from the id (Root.tsx's id rule).
const scale = id => (id.includes('-4x5') ? ' --scale=1.3333333333333333' : '')
for (const id of asked.length > 0 ? asked : known) {
  execSync(`remotion render src/index.ts ${id} out/${id}.mp4 ${FLAGS}${scale(id)}`, { cwd, stdio: 'inherit' })
}
```

`--scale` makes Remotion lay the page out at 1080×1350 and draw it at 4/3 the pixel density, so text and edges come out
sharp at 1440×1800.

- [ ] **Step 5: The 4:5 renders at 1440×1800**

Run (about 45 s):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
FFPROBE=node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.529/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe
pnpm render:video ad-pt-4x5-15s > video/out/render-4x5.log 2>&1; echo "exit $?"
"$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of default=nw=1 video/out/ad-pt-4x5-15s.mp4
stat -c '%n %Y' video/out/*.mp4 | diff "$SP/mp4-before.txt" -
stat -c '%n %Y' video/out/*.mp4 > "$SP/mp4-before.txt"
```

Expected: `exit 0`, `width=1440` and `height=1800`, then a diff in which only the `video/out/ad-pt-4x5-15s.mp4` line
changed (its time). The last line takes a new snapshot.

- [ ] **Step 6: The ids come from the last line**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
pnpm --filter video exec remotion compositions src/index.ts --quiet --bundle-cache=false > /dev/null 2>&1
pnpm render:video ad-bogus > video/out/render-bogus.log 2>&1; echo "exit $?"; grep -a '^Error: Unknown id' video/out/render-bogus.log; stat -c '%n %Y' video/out/*.mp4 | diff "$SP/mp4-before.txt" - && echo "no MP4 touched"
```

Expected:
```
exit 1
Error: Unknown id: ad-bogus. The compositions are ad-pt, ad-en, ad-pt-16x9, ad-en-16x9, ad-pt-9x16, ad-en-9x16, ad-pt-4x5-15s, ad-en-4x5-15s, ad-pt-9x16-15s, ad-en-9x16-15s.
no MP4 touched
```
The first command deleted the cache as in Step 3, so Remotion printed its note again; the new script captures that
output and reads only its last line, so the note never reaches the log.

- [ ] **Step 7: A bad layout stops the render before any frame**

Move the 4:5 caption back above the zone, on purpose.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old
```
    caption: { box: { x: 110, y: 145, w: 860, h: 160 }, size: 64, align: 'center' },
```
→ new
```
    caption: { box: { x: 110, y: 125, w: 860, h: 160 }, size: 64, align: 'center' },
```

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
pnpm render:video ad-pt-4x5-15s > video/out/render-bad.log 2>&1; echo "exit $?"; grep -a -o '[0-9]*x[0-9]*: [a-z0-9 ]* ([^)]*) is outside the safe zone ([^)]*)' video/out/render-bad.log | sort -u; stat -c '%n %Y' video/out/*.mp4 | diff "$SP/mp4-before.txt" - && echo "no MP4 touched"
```

Expected:
```
exit 1
4x5: caption (x 110–970, y 125–285) is outside the safe zone (x 90–990, y 135–1215)
no MP4 touched
```

Now put the caption back.

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old
```
    caption: { box: { x: 110, y: 125, w: 860, h: 160 }, size: 64, align: 'center' },
```
→ new
```
    caption: { box: { x: 110, y: 145, w: 860, h: 160 }, size: 64, align: 'center' },
```

Run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet > video/out/check.log 2>&1; echo "exit $?"; grep -a -o '[0-9]*x[0-9]*: [a-z0-9 ]* ([^)]*) is outside the safe zone ([^)]*)' video/out/check.log | sort -u
```

Expected: `exit 0` and no message.

- [ ] **Step 8: Types, lint and format**

Run:
```bash
pnpm --filter video exec tsc --noEmit; echo "exit $?"
pnpm exec eslint video --max-warnings 0; echo "exit $?"
pnpm exec prettier --check video/src video/scripts; echo "exit $?"
```

Expected:
```
exit 0
exit 0
Checking formatting...
All matched files use Prettier code style!
exit 0
```

- [ ] **Step 9: No commit.** Henriko commits.

### Task 6: The sheets gate

**Files:**
- Create (gitignored): `video/out/meta-stills/` (20 stills) and `video/out/meta-sheets/` (four contact sheets)
- Modify only if Henriko asks for a change: `video/src/layouts.ts` (the `4x5` layout) or `video/src/timelines.ts`
  (the `15s` timeline), and `docs/superpowers/specs/2026-09-29-promo-meta-design.md` §2 or §3 with it

**Interfaces:**
- Consumes: the four 15 s compositions (Task 4); `$SP/meta/stills.mjs` and `$SP/meta.py lines` and `sheets` (Task 1).
- Produces: Henriko's explicit approval of the 15 s layouts and timings, which Task 7 needs before it renders.

Steps 5 to 8 talk to Henriko. In subagent-driven execution the controller runs them itself; a subagent can't wait for
an answer.

- [ ] **Step 1: Render the 20 review stills**

Run (about 25 s):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
rm -rf video/out/meta-stills
pnpm --filter video exec node "$SP/meta/stills.mjs" out/meta-stills 52,132,226,310,430 ad-pt-4x5-15s ad-en-4x5-15s ad-pt-9x16-15s ad-en-9x16-15s > "$SP/stills.log" 2>&1; echo "exit $?"; grep -a '^stills:' "$SP/stills.log"
```

Expected: `exit 0`, then `stills: 20 in out/meta-stills (21 s)`; the time varies. The frames are the question (52),
the promise (132), the draft's caption (226), the handoff's first sentence (310) and the fine print (430).

- [ ] **Step 2: Every text wraps as in its format's 30 s**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta.py" lines; echo "exit $?"
```

Expected:
```
PASS  lines, ad-pt-4x5-15s: 52=3, 132=3, 226=2, 310=2, 430=3
PASS  lines, ad-en-4x5-15s: 52=2, 132=4, 226=2, 310=2, 430=2
PASS  lines, ad-pt-9x16-15s: 52=3, 132=3, 226=2, 310=2, 430=3
PASS  lines, ad-en-9x16-15s: 52=2, 132=4, 226=2, 310=2, 430=3
4/4 checks pass
exit 0
```
A count followed by `(expected N)` means that text isn't whole at that frame or wraps differently from its format's
30 s: open the still, and compare Task 2's `15s` timeline and Task 4's `4x5` layout with spec §2 and §3.

- [ ] **Step 3: Make the contact sheets**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta.py" sheets; echo "exit $?"
```

Expected:
```
PASS  sheets, ad-pt-4x5-15s: video/out/meta-sheets/ad-pt-4x5-15s.png
PASS  sheets, ad-en-4x5-15s: video/out/meta-sheets/ad-en-4x5-15s.png
PASS  sheets, ad-pt-9x16-15s: video/out/meta-sheets/ad-pt-9x16-15s.png
PASS  sheets, ad-en-9x16-15s: video/out/meta-sheets/ad-en-9x16-15s.png
4/4 checks pass
exit 0
```
Each sheet puts an id's five stills side by side at half size, under a legend: the safe zone in green, the crop in
orange (the central square in the 4:5, the centered 4:5 that Instagram's feed shows in the 9:16), Meta's own zone in
blue (9:16 only) and each measured text box in magenta.

- [ ] **Step 4: Look at the sheets yourself first**

Read the four PNGs with the Read tool. What to see:
- every text and the mock's text sit inside the green zone and inside the orange crop;
- at frame 132 the gold node is barely visible, by design: it sinks from frame 126;
- in the 4:5, the EN fine print's first line nearly fills its 860 px column, as in the square.

If a text crosses the zone or the crop, overlaps another or is cut off, don't send the sheets: tell Henriko what and
where, with the sheet, and wait.

- [ ] **Step 5: Send the sheets to Henriko**

Call SendUserFile with status `normal`, display `render`, the files `video/out/meta-sheets/ad-pt-4x5-15s.png`,
`ad-en-4x5-15s.png`, `ad-pt-9x16-15s.png` and `ad-en-9x16-15s.png`, and this caption: "Folhas de contato do corte de
15 s: 4:5 e 9:16, PT e EN, frames 52, 132, 226, 310 e 430, com a zona segura (verde), o recorte quadrado ou o 4:5 do
Instagram (laranja), a zona do Meta no 9:16 (azul) e a caixa de texto medida (magenta)."

- [ ] **Step 6: Ask for the approval**

Write in chat, in pt-BR:

> As folhas mostram os quatro vídeos de 15 s nos frames 52 (pergunta), 132 (promessa), 226 (legenda do rascunho), 310
> (primeira frase da passagem) e 430 (letras miúdas). Em todas, o texto e o mock ficam dentro da zona segura (verde) e
> do recorte laranja: o quadrado central no 4:5, o 4:5 centralizado do Instagram no 9:16. Se um feed recortar o 4:5
> para quadrado, a legenda de duas linhas começa 20 px abaixo da borda do recorte (4 px com o drift da câmera); se
> achar pouco, desço a legenda e o palco 20 px juntos. O ritmo dos textos se julga melhor nos MP4s da Tarefa 7; um
> ajuste ali é número em `timelines.ts`, não código.
>
> Aprova esses layouts para o render final? Se quiser mudar algo, diga o formato, o frame e o que mudar.

- [ ] **Step 7: Wait for an explicit yes**

Don't start Task 7 on silence, on a question or on a partial answer. A yes to the sheets approves these layouts and
timings for the render; Henriko still watches the MP4s after Task 7.

- [ ] **Step 8: For each change Henriko asks for**

Change the number in `video/src/layouts.ts` (the `4x5` layout) or `video/src/timelines.ts` (the `15s` timeline) with
Edit, and the same number in spec §3 or §2. `$SP/meta.py` repeats some of them (`LAYOUT`, `LENGTHS`, `DARK_15`, and
the review frames in `FRAMES_15` and `text_at`): change them there too. Then run Task 4 Step 3's first command (the
check at load) and Steps 1 to 4 again, send the sheets again (Step 5) and ask again (Step 6), naming what changed.

A change to the 15 s `total` or `cuts` also changes its music: run `pnpm --filter video audio`, send the new
`video/public/audio/music-15s.wav` to Henriko, and only after Henriko approves it copy it over
`video/out/meta-audio/music-15s-prototype.wav`, so the `wavs` check follows the approved file.

- [ ] **Step 9: No commit.** Henriko commits.

### Task 7: Render the four 15 s ads and check them

**Files:**
- Create (gitignored): `video/out/ad-pt-4x5-15s.mp4`, `ad-en-4x5-15s.mp4`, `ad-pt-9x16-15s.mp4` and
  `ad-en-9x16-15s.mp4`; `video/out/render.log`; `video/out/meta-audio/aac/` (`meta.py sound` decodes the AAC there)
- Regenerated (gitignored): `video/out/meta-after/` and `video/out/meta-audio/after/`; outside the repo, the gate logs
  `$SP/gate-*.log` (Task 1 Step 1)

**Interfaces:**
- Consumes: Henriko's yes from Task 6; `pnpm render:video` (Task 5); `$SP/meta.py probe`, `blank`, `sound`, `music`,
  `stills` and `audio` (Task 1).
- Produces: the four MP4s for Meta, checked, and the run time and gate numbers that Task 8 writes into
  `docs/PLATFORM.md`.

- [ ] **Step 1: Render**

Run (about 2.5 minutes; give the Bash call a 10-minute timeout):
```bash
start=$(date +%s); pnpm render:video ad-pt-4x5-15s ad-en-4x5-15s ad-pt-9x16-15s ad-en-9x16-15s > video/out/render.log 2>&1; echo "exit $? in $(( $(date +%s) - start )) s"
```

Expected: `exit 0 in 144 s`; the time varies. Note it for Task 8. On a non-zero exit, read the end of
`video/out/render.log`.

- [ ] **Step 2: Size, frame rate, frames and length**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta.py" probe; echo "exit $?"
```

Expected:
```
PASS  probe, ad-pt-4x5-15s: h264 1440x1800 30/1 fps, 448 frames; aac 48000 Hz, 2 channels; 14.997 s (max 15.0)
PASS  probe, ad-en-4x5-15s: h264 1440x1800 30/1 fps, 448 frames; aac 48000 Hz, 2 channels; 14.997 s (max 15.0)
PASS  probe, ad-pt-9x16-15s: h264 1080x1920 30/1 fps, 448 frames; aac 48000 Hz, 2 channels; 14.997 s (max 15.0)
PASS  probe, ad-en-9x16-15s: h264 1080x1920 30/1 fps, 448 frames; aac 48000 Hz, 2 channels; 14.997 s (max 15.0)
4/4 checks pass
exit 0
```
14.997 s is the file's length, set by the AAC track, which runs a little past the 448 frames' 14.933 s. Ads Manager
shows one decimal: 15.0.

- [ ] **Step 3: No dark beats**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta.py" blank; echo "exit $?"
```

Expected: four lines like `PASS  blank, ad-pt-4x5-15s: 448 frames, dark runs of 3+: 0-5, 60-64 (allowed: 0-5, 60-64)`
(one per 15 s id), `4/4 checks pass` and `exit 0`.

- [ ] **Step 4: Loudness, PT = EN, and a silent end**

Run (about 30 s):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
rm -rf video/out/meta-audio/after && mkdir -p video/out/meta-audio/after
pnpm --filter video exec remotion render src/index.ts ad-pt-4x5-15s out/meta-audio/after/ad-pt-4x5-15s.wav --codec=wav --enforce-audio-track > /dev/null 2>&1 || echo "render failed: ad-pt-4x5-15s"
$PY "$SP/meta.py" sound; echo "exit $?"
$PY "$SP/meta.py" music; echo "exit $?"
```

Expected: four lines like `PASS  sound, ad-pt-4x5-15s: -15.19 LUFS (-15 ± 1), true peak -2.48 dBTP (max -1)` (one
per 15 s id), then
```
PASS  sound, 4x5: PT and EN identical
PASS  sound, 9x16: PT and EN identical
PASS  sound, end: the 15 s audio-only render peaks at -84.3 dBFS in the video's last 10 ms (max -60)
7/7 checks pass
exit 0
```
and Task 3 Step 5's two `music` lines, `2/2 checks pass` and `exit 0`. The end check reads the WAV that the block's
`remotion render` line writes, not the AAC.

- [ ] **Step 5: The 30 s ads are still the approved ones**

Run (about 4.5 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
F=10,90,100,125,150,194,204,226,240,256,338,356,366,376,384,392,412,465,495,510,531,540,545,560,580,590,618,634,648,699,720,748,755,762,778,790,899
IDS="ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16"
rm -rf video/out/meta-after
pnpm --filter video exec node "$SP/meta/stills.mjs" out/meta-after $F $IDS > "$SP/stills.log" 2>&1; echo "exit $?"; grep -a '^stills:' "$SP/stills.log"
$PY "$SP/meta.py" stills; echo "exit $?"
rm -rf video/out/meta-audio/after && mkdir -p video/out/meta-audio/after
for id in $IDS; do pnpm --filter video exec remotion render src/index.ts $id out/meta-audio/after/$id.wav --codec=wav --enforce-audio-track > /dev/null 2>&1 || echo "render failed: $id"; done; ls video/out/meta-audio/after | wc -l
$PY "$SP/meta.py" audio; echo "exit $?"
```

Expected: `exit 0`, `stills: 222 in out/meta-after (101 s)` (the time varies), six lines like
`PASS  stills, ad-pt: 37 of 37 identical to meta-before, changed: none, missing: 0` (one per 30 s id),
`6/6 checks pass` and `exit 0`; then `6`, six lines like
`PASS  audio, ad-pt: after/ad-pt.wav identical to before/ad-pt.wav` (one per 30 s id), `6/6 checks pass` and
`exit 0`. A `FAIL` here, after Tasks 2 and 3 passed the same checks, points at a change made after them, in Task 4, 5
or 6.

- [ ] **Step 6: The repo's gates**

Run (give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
pnpm typecheck > "$SP/gate-typecheck.log" 2>&1; echo "exit $?"
pnpm lint > "$SP/gate-lint.log" 2>&1; echo "exit $?"
pnpm format:check > "$SP/gate-format.log" 2>&1; echo "exit $?"; tail -1 "$SP/gate-format.log"
pnpm -r test > "$SP/gate-test.log" 2>&1; echo "exit $?"; grep -aE 'Tests +[0-9]+' "$SP/gate-test.log"
```

Expected:
```
exit 0
exit 0
exit 0
All matched files use Prettier code style!
exit 0
landing test:       Tests  75 passed (75)
convex test:       Tests  789 passed (789)
app test:       Tests  700 passed (700)
```
The three test lines may come in another order, and their counts must match Task 1 Step 1's.

- [ ] **Step 7: No commit.** Henriko commits.

### Task 8: Docs and memory

**Files:**
- Modify: `docs/PLATFORM.md` (§3's `video/` bullet, §4's `video/` line, §15A, §18's `dev:video` / `render:video` row
  and a new "Last updated" entry)
- Create (outside the repo): `$SP/meta/PLATFORM.before.md` (a snapshot) and `$SP/meta/docs_check.py`
- Modify (outside the repo): the memory notes `promo-video.md` and `MEMORY.md` in
  `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\`

**Interfaces:**
- Consumes: Task 7 Step 1's render time, Step 4's loudness and true peak and Step 6's test counts; the names Tasks 2
  to 5 created: `timelines.ts` (`LENGTHS`, `TIMELINES`), `CUTS` in `Root.tsx`, `moments(timeline)` in `Demo.tsx`,
  `flight(timeline)` and `nodeStops(layout, timeline)` in `YouNode.tsx`, and `ARRANGEMENTS`, `GLIDE_FRAMES` and
  `SHIMMER_SECONDS` in `scripts/soundtrack.mjs`.
- Produces: `docs/PLATFORM.md` in sync with the code, the memory notes, and the list Henriko commits.

Anchor every edit on its text, never on a line number: other sessions edit `docs/PLATFORM.md` too. Read §15A in full
before Step 2. If an old string isn't found, read that passage, carry the change over by hand, and name it to Henriko
in Step 14. Every new line stays within 120 columns with no em dash, and every table stays aligned by display width;
Step 12 checks all three. The blocks hold `×`, `–` (an en dash), `−` (a minus sign), `…`, `→`, `²` and, in the dates,
`‑` (a non-breaking hyphen): copy them as they are, never as escapes.

- [ ] **Step 1: Snapshot the document**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
cp docs/PLATFORM.md "$SP/meta/PLATFORM.before.md"; echo "exit $?"
```

Expected: `exit 0`. Step 12 compares the document with this copy.

- [ ] **Step 2: The opening names the 15 s cut**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\docs\PLATFORM.md`: old
```
A 30-second ad in pt-BR and US English, with music and sound effects composed in code, in three formats: square
(1080×1080) for the LinkedIn feed, 16:9 (1920×1080) for YouTube in-stream ads, and 9:16 (1080×1920) for YouTube
Shorts, Instagram Reels, Stories and TikTok ("Formats" below). It works muted too, since LinkedIn autoplays without
sound. On Meta, the 9:16 runs in Reels, Stories and the feeds: in September 2026 Meta's ad setup accepted only 4:5
through 9:16 for Instagram, which leaves out the square. [Remotion](https://www.remotion.dev) `4.0.529` draws it with
React and renders it locally; nothing in `video/` is deployed, and the MP4s are uploaded to each platform's ad manager
by hand. Design and storyboard:
[`docs/superpowers/specs/2026-09-26-promo-video-design.md`](superpowers/specs/2026-09-26-promo-video-design.md). Sound:
[`docs/superpowers/specs/2026-09-26-promo-audio-design.md`](superpowers/specs/2026-09-26-promo-audio-design.md).
```
→ new
```
A 30-second ad in pt-BR and US English, with music and sound effects composed in code, in three formats: square
(1080×1080) for the LinkedIn feed, 16:9 (1920×1080) for YouTube in-stream ads, and 9:16 (1080×1920) for YouTube
Shorts and TikTok; plus a 15-second cut for Meta, in 4:5 (1080×1350, rendered at 1440×1800) for the Facebook Feed
and in 9:16 for the Instagram Feed, Reels and Stories ("Lengths" and "Formats" below). It works muted too, since
LinkedIn autoplays without sound. Meta gets only the 15 s files: its Ads Manager recommends at most 15 s, and in
September 2026 its ad setup accepted only 4:5 through 9:16 for Instagram, which leaves out the square.
[Remotion](https://www.remotion.dev) `4.0.529` draws it with React and renders it locally; nothing in `video/` is
deployed, and the MP4s are uploaded to each platform's ad manager by hand. Design and storyboard:
[`docs/superpowers/specs/2026-09-26-promo-video-design.md`](superpowers/specs/2026-09-26-promo-video-design.md). Sound:
[`docs/superpowers/specs/2026-09-26-promo-audio-design.md`](superpowers/specs/2026-09-26-promo-audio-design.md). The
15 s cut and the 4:5:
[`docs/superpowers/specs/2026-09-29-promo-meta-design.md`](superpowers/specs/2026-09-29-promo-meta-design.md).
```

- [ ] **Step 3: "What the ad says" gets the 15 s seconds**

Edit: old
```
| Seconds   | Scene    | Strings and their source                                                                    |
|-----------|----------|---------------------------------------------------------------------------------------------|
| 0-3       | Hook     | landing `hero.eyebrow`                                                                      |
| 3-7       | Promise  | landing `hero.headlineLine1` + `hero.headlineLine2`                                         |
| 7-12      | Feed     | `feedCaption` (new), app `feed.viewOnLinkedIn`, fictional posts                             |
| 12-17.5   | AI draft | `draftCaption` (new), app `comment.generate` / `generating` / `regenerate` / `languageAuto` |
| 17.5-23.5 | Handoff  | landing `hero.subLine2` (one sentence at a time), app `comment.submit`, `feed.comment`      |
| 23.5-30   | End card | landing `hero.cta` + `hero.ctaDisclaimer`, literal `linkintothessi.com`                     |
```
→ new
```
| 30 s      | 15 s      | Scene    | Strings and their source                                                                    |
|-----------|-----------|----------|---------------------------------------------------------------------------------------------|
| 0-3       | 0-2.3     | Hook     | landing `hero.eyebrow`                                                                      |
| 3-7       | 2.3-5     | Promise  | landing `hero.headlineLine1` + `hero.headlineLine2`                                         |
| 7-12      | none      | Feed     | `feedCaption` (new), app `feed.viewOnLinkedIn`, fictional posts                             |
| 12-17.5   | 5-7.8     | AI draft | `draftCaption` (new), app `comment.generate` / `generating` / `regenerate` / `languageAuto` |
| 17.5-23.5 | 7.8-11.2  | Handoff  | landing `hero.subLine2` (one sentence at a time), app `comment.submit`, `feed.comment`      |
| 23.5-30   | 11.2-14.9 | End card | landing `hero.cta` + `hero.ctaDisclaimer`, literal `linkintothessi.com`                     |

In the 15 s cut ("Lengths" below) the cards rise under the draft caption, so the feed caption never shows, and the
handoff shows only its first sentence.
```

- [ ] **Step 4: "How it is built": ten compositions, one clock per length**

Edit: old
```
- **One component, six compositions.** `Root.tsx` registers `Ad` once per language and format ("Formats" below):
  `ad-pt` and `ad-en` (1080×1080), `ad-pt-16x9` and `ad-en-16x9` (1920×1080), and `ad-pt-9x16` and `ad-en-9x16`
  (1080×1920), all at 30 fps and 900 frames. The language and the format are the only props. `COPY` is typed
  `Record<Lang, AdCopy>`, so a missing string fails `tsc`.
- **One clock.** Every scene reads the absolute frame (no `<Sequence>`). `Ad.tsx` cross-fades three layers (Opening
  0-210, Demo 198-705, end card 693-900) and drifts the whole frame from scale 1 to 1.03. The tap frames and pixel
  positions in `Demo.tsx` (`TAPS`) are computed from the same constants that place the buttons. The only `<Sequence>`s
  are the sound's (`Soundtrack.tsx`, `layout="none"`): they time audio and draw nothing.
```
→ new
```
- **One component, ten compositions.** `Root.tsx` registers `Ad` once per language and cut, a cut being a format in a
  length (`CUTS`; "Lengths" and "Formats" below). The id is `ad-<lang>`, then `-<format>` unless it's the square, then
  `-<length>` unless it's the 30 s. The six 30 s ids keep their names: `ad-pt` and `ad-en` (1080×1080), `ad-pt-16x9`
  and `ad-en-16x9` (1920×1080), and `ad-pt-9x16` and `ad-en-9x16` (1080×1920), at 900 frames. The four 15 s ids are
  `ad-pt-4x5-15s` and `ad-en-4x5-15s` (1080×1350) and `ad-pt-9x16-15s` and `ad-en-9x16-15s` (1080×1920), at 448
  frames. All run at 30 fps. The language, the format and the length are the only props. `COPY` is typed
  `Record<Lang, AdCopy>`, so a missing string fails `tsc`.
- **One clock per length.** Every scene reads the absolute frame (no `<Sequence>`) and takes its frames from the
  length's timeline (`video/src/timelines.ts`, "Lengths" below). `Ad.tsx` cross-fades three layers (Opening, Demo and
  end card: 0-210, 198-705 and 693-900 in the 30 s; 0-150, 138-336 and 324-448 in the 15 s) and drifts the whole frame
  from scale 1 to 1.03. The tap positions in `Demo.tsx` (`TAPS`) are computed from the same constants that place the
  buttons, and `moments(timeline)` there derives what each tap sets off, such as the reply posting 4 frames after the
  Post tap. The only `<Sequence>`s are the sound's (`Soundtrack.tsx`, `layout="none"`): they time audio and draw
  nothing.
```

- [ ] **Step 5: A new "Lengths" subsection**

It goes between "How it is built" and "Formats". Edit: old
```
  which answered with an HTML page instead of the font.

### Formats
```
→ new
```
  which answered with an HTML page instead of the font.

### Lengths

The ad comes in two lengths: the 30 s it was designed with (`30s`, 900 frames) and the 15 s cut for Meta (`15s`, 448
frames). `video/src/timelines.ts` holds a `Timeline` per length: the composition's frames, the two cuts, when each
text enters and starts leaving, when the node lights up, pulses, sinks and jumps, when it sets off for a tap and how
long it travels, the cards, the taps, the typing and the end card's entrances. Positions stay in `layouts.ts` and
`Demo.tsx`, and movements (how long a rise, a tap or the flight takes) in the scenes and the node. The 15 s cut's
design, holds and music:
[`docs/superpowers/specs/2026-09-29-promo-meta-design.md`](superpowers/specs/2026-09-29-promo-meta-design.md).

- **The same story, shorter.** The 15 s tells the same story with the same five taps and drops two texts: the feed
  caption (the cards rise under the draft caption instead) and the handoff's second sentence ("Nothing is
  automated."). Its cuts fall at frames 150 and 336 instead of 210 and 705.
- **448 frames, not 450.** An MP4 of 448 frames lasts 14.997 s, since its AAC track runs a little past the video's
  14.933 s; 450 frames would last 15.06 s, which Meta's Ads Manager shows as 15.1.
- **Faster moves.** The node leaves 12 frames before each tap and travels for 8 (24 and 18 in the 30 s), and the AI
  types its draft in 24 frames instead of 50. The flight into the logo takes 50 frames in both.
- **Tight holds.** Each text stays whole on screen for less time than in the 30 s (in parentheses), PT before EN where
  they differ: the question 0.4 s (1.3), the promise 0.6 and 0.5 s (1.7), the draft caption 1.8 and 2.0 s (3.6), the
  handoff's sentence 1.2 and 1.3 s (1.7), the posted reply 0.5 s (2.1) and the fine print 1.5 s (3.3). If one reads
  rushed, the fix is numbers in `timelines.ts`, not code.
- **One source for the sound too.** `video/scripts/soundtrack.mjs` imports `timelines.ts` for the frame rate, the
  lengths and the cuts, and Node strips its types on the way in. That is why the file imports nothing and keeps to
  syntax Node can strip (types, annotations and `as const`).

### Formats
```

- [ ] **Step 6: "Formats": the 4:5**

Seven edits in the same subsection. The intro: Edit: old
```
Each composition is one language in one format. `video/src/layouts.ts` holds a `Layout` per format: the frame, the
safe zone, the mock's stage origin, the node's home, the boxes and font sizes of the Opening, the captions and the end
card, and the number of dots and gray cards. The `1x1` entry holds the square's original numbers, and the square
renders pixel for pixel as before. Design, the numbers and the platform readings behind each zone:
[`docs/superpowers/specs/2026-09-28-promo-formats-design.md`](superpowers/specs/2026-09-28-promo-formats-design.md).
```
→ new
```
Each composition is one language in one format and one length. `video/src/layouts.ts` holds a `Layout` per format:
the frame, the safe zone, the mock's stage origin, the node's home, the boxes and font sizes of the Opening, the
captions and the end card, and the number of dots and gray cards. A layout serves both lengths: the 15 s 9:16 uses
the `9x16` entry unchanged. The `1x1` entry holds the square's original numbers, and the square renders pixel for
pixel as before. Design, the numbers and the platform readings behind each zone:
[`docs/superpowers/specs/2026-09-28-promo-formats-design.md`](superpowers/specs/2026-09-28-promo-formats-design.md);
the 4:5's are in the Meta spec (linked in "Lengths" above).
```

The table: Edit: old
```
| Format | Frame       | For                                                     | Safe zone (text and taps) |
|--------|-------------|---------------------------------------------------------|---------------------------|
| `1x1`  | 1080 × 1080 | LinkedIn feed                                           | x 90–990, y 90–990        |
| `16x9` | 1920 × 1080 | YouTube in-stream ads                                   | x 140–1780, y 90–860      |
| `9x16` | 1080 × 1920 | YouTube Shorts, TikTok, Meta (Reels, Stories and feeds) | x 120–960, y 270–1248     |
```
→ new
```
| Format | Frame       | For                                                                  | Safe zone (text and taps) |
|--------|-------------|----------------------------------------------------------------------|---------------------------|
| `1x1`  | 1080 × 1080 | LinkedIn feed (30 s)                                                 | x 90–990, y 90–990        |
| `16x9` | 1920 × 1080 | YouTube in-stream ads (30 s)                                         | x 140–1780, y 90–860      |
| `9x16` | 1080 × 1920 | YouTube Shorts, TikTok (30 s); Instagram Feed, Reels, Stories (15 s) | x 120–960, y 270–1248     |
| `4x5`  | 1080 × 1350 | Facebook Feed (15 s), rendered at 1440 × 1800                        | x 90–990, y 135–1215      |
```

The stage: Edit: old
```
  (0, 0) in the square, (790, −160) in the 16:9 (on the right, raised) and (0, 230) in the 9:16. The taps keep their
  stage coordinates and the node adds the origin, so the taps' timing, the node's path over the mock and every sound are
  the same in all six compositions.
```
→ new
```
  (0, 0) in the square, (790, −160) in the 16:9 (on the right, raised), (0, 230) in the 9:16 and (0, 45) in the 4:5.
  The taps keep their stage coordinates and the node adds the origin, so within a length the taps' timing, the node's
  path over the mock and every sound are the same in every format.
```

The text per format: Edit: old
```
  Opening and on the end card, since a phone held upright shrinks its 1920 px width more than the square's.
```
→ new
```
  Opening and on the end card, since a phone held upright shrinks its 1920 px width more than the square's. The 4:5
  keeps the square's sizes and 860 px column (x 110–970): its Opening, the node's home and the end card are the
  square's moved down 135 px, into the frame's central square, and the mock and the caption only 45 px, so the caption
  sits high (y 145–305) and the feed runs to the bottom edge. It's drawn at 1080×1350 and rendered at 4/3 as
  1440×1800 (`render.mjs` passes `--scale`), so it's redrawn rather than upscaled.
```

The dots: Edit: old
```
  one fully: 40 in the square (the same dots as before), 82 in the 16:9 and 70 in the 9:16. The far corners stay
  dark, though in the 16:9 a few dots, decoration only, fall under YouTube's "Ad" label and Skip button.
```
→ new
```
  one fully: 40 in the square (the same dots as before), 82 in the 16:9, 70 in the 9:16 and 60 in the 4:5, which
  keeps the square's and the 9:16's density of about one dot per 12,580 px² of free area. The far corners stay dark,
  though in the 16:9 a few dots, decoration only, fall under YouTube's "Ad" label and Skip button.
```

The check: Edit: old
```
- **The safe-zone check.** When `layouts.ts` loads, it checks that every text box, the mock's text area, the node's
  home and every stop on its path (`nodeStops(layout)` in `YouNode.tsx`) sit inside the format's safe zone. A failure
  throws with the format and the element, such as
  `9x16: caption (x 130–950, y 200–360) is outside the safe zone (x 120–960, y 270–1248)`, and stops the Studio,
  `remotion compositions` and every render before a frame is drawn. It leaves out the camera drift, the text inside
  each box (the stills show the wraps), the flight's arc and the gray cards.
```
→ new
```
- **The safe-zone check.** When `layouts.ts` loads, it checks that every text box, the mock's text area, the node's
  home and every stop on its path under every timeline (`nodeStops(layout, timeline)` in `YouNode.tsx`) sit inside
  the format's safe zone. A failure throws with the format and the element, such as
  `4x5: caption (x 110–970, y 125–285) is outside the safe zone (x 90–990, y 135–1215)`, and stops the Studio,
  `remotion compositions` and every render before a frame is drawn. A stop is named by its frame and length, such as
  `node stop at frame 156 of the 15s`, the frame the node sets off for it. It leaves out the camera drift, the text
  inside each box (the stills show the wraps), the flight's arc and the gray cards.
```

The zones: Edit: old
```
  second line. Once the comment box opens, it pushes the second card below the zone in all three formats. No tap point
  falls in any of them, and Henriko approved them on overlay stills that draw every reading. A Meta feed may crop the
  9:16 to its centered 4:5 (y 285–1635), which the check can't see since the zone starts at y 270; on the stills that
  cuts only dots, the Opening's rings and the gray cards.
```
→ new
```
  second line. Once the comment box opens, it pushes the second card below the zone in the square, the 16:9 and the
  9:16. No tap point falls in any of them, and Henriko approved them on overlay stills that draw every reading. The
  Instagram Feed may crop the 15 s 9:16 to its centered 4:5 (y 285–1635), which the check can't see since the zone
  starts at y 270; on the stills that cuts only dots, the Opening's rings and the gray cards. A feed that crops the 4:5
  to a square keeps y 135–1215, the zone's own height: a two-line caption starts 20 px below the crop's top edge
  (4 px with the camera drift), and the mock's text ends at y 1017.
```

The second card stays out of that list's claim for the 4:5 on purpose: with the stage only 45 px down, the open
comment box leaves the card's top 187 px inside the 4:5's zone (from y 1028), where it does no harm.

- [ ] **Step 7: "Sound": two music files, the end fade, two numbers by hand**

Six edits. The intro: Edit: old
```
`video/scripts/soundtrack.mjs`, a Node script with no dependencies, synthesizes the music and every effect into
`video/public/audio/*.wav` (48 kHz, 16-bit, stereo). The WAVs are gitignored: `pnpm dev:video` and `pnpm render:video`
rebuild them first, and `pnpm --filter video audio` runs the script alone. Before writing, it checks itself (the music
is exactly 30 s, no sample is `NaN` or infinite, no file peaks over its level), so a failure stops the Studio or the
render before it starts. Its noise is seeded, so every run writes the same bytes.
```
→ new
```
`video/scripts/soundtrack.mjs`, a Node script with no dependencies, synthesizes a music file per length and every
effect into `video/public/audio/*.wav` (48 kHz, 16-bit, stereo). Both lengths share the effects. The WAVs are
gitignored: `pnpm dev:video` and `pnpm render:video` rebuild them first, and `pnpm --filter video audio` runs the
script alone. Before writing, it checks itself (each music file is exactly its timeline's length, no sample is `NaN`
or infinite, no file peaks over its level), so a failure stops the Studio or the render before it starts. Its noise is
seeded, so every run writes the same bytes.
```

The music: Edit: old
```
- **Music** (`music.wav`): D major at about 116 BPM, so both cuts (frames 210 and 705) fall on a bar's first beat. A
  warm pad on Dsus2 rises from silence under the hook and opens up through the promise, and a riser leads into the
  feed. There the beat enters: kick, clap, hats, a pulsing bass and a pluck arpeggio on D, Bm, G and A, twice, the
  second pass fuller. The last bar breathes, and the end card resolves on D over a low impact, then fades out over
  the last 0.5 s.
```
→ new
```
- **Music** (`music-30s.wav` and `music-15s.wav`): D major at about 116 BPM, so both cuts (210 and 705 in the 30 s,
  150 and 336 in the 15 s) fall on a bar's first beat. A warm pad on Dsus2 rises from silence under the hook and opens
  up through the promise, and a riser leads into the Demo. There the beat enters: kick, clap, hats, a pulsing bass and
  a pluck arpeggio. The 30 s plays D, Bm, G and A twice, the second pass fuller; its last bar breathes, and the end
  card resolves on D over a low impact. The 15 s plays D, G and Asus4 resolving to A once, fuller from its second bar
  (at 116.13 BPM, so 12 beats fill frames 150 to 336); it breathes at frame 305, right after the plim, lands on D over
  the impact at the cut, pulses one bar and holds its final D from frame 398. Both fade out over the last 0.5 s.
  `ARRANGEMENTS` at the top of the script holds each length's chords.
```

The effects: Edit: old
```
- **Effects:** `video/src/Soundtrack.tsx` plays each file on the frame of the constant that times its picture, so a
  moved tap takes its sound along. The levels are baked into the files, so everything plays at volume 1 except the
  shimmer, which fades out over its last 4 frames. The keys' gaps and variants come from Remotion's seeded `random()`,
  so every render types the same.
```
→ new
```
- **Effects:** `video/src/Soundtrack.tsx` plays each file on the frame of the timeline moment that times its picture,
  so a moved tap takes its sound along. The levels are baked into the files, so everything plays at volume 1 except
  the shimmer, which fades out over its last 4 frames, and any effect still sounding in the ad's last 15 frames, which
  fades out with the music. In the 15 s that is the land bell. In the 30 s each effect still gets Remotion's volume
  filter (it plays until the ad ends, so its volume drops in the last 15 frames), but every effect has ended by frame
  870, before the fade starts at 885, so the filter multiplies each sample that plays by exactly 1.0 and the 30 s
  audio stays byte for byte as it was. The keys' gaps and variants come from Remotion's seeded `random()`, so every
  render types the same.
```

The table: Edit: old
```
| Frame(s)                | Effect (`<name>.wav`)                                       | Reads                      |
|-------------------------|-------------------------------------------------------------|----------------------------|
| 90                      | `glow`: a slow-attack bell on A4 as the node lights up      | `BRIGHTEN`                 |
| 96, 144                 | `ring-1`, `ring-3`: bells on D5 and A5                      | `RINGS`                    |
| 120                     | `ring-2`: a bell on F#5 over the pad's third (F#3)          | `RINGS`                    |
| 222, 236, 250           | `card`: a muffled tick per card                             | `T.cards`                  |
| 372, 408, 525, 575, 605 | `tap`: a short, trackpad-like click                         | `TAPS`                     |
| 410-440                 | `shimmer`: high bell grains (E, F#, A, B), getting denser   | `T.generating`, `T.typing` |
| 440-490                 | `key-1` to `key-3`: soft keys, 2 or 3 frames apart          | `T.typing`                 |
| 609                     | `plim`: two bells, A5 then D6                               | `T.posted`                 |
| 700-750                 | `glide`: a soft tone rising from D5 to D6, into the landing | `FLIGHT`, `LANDED`         |
| 750                     | `land`: a high D bell (D6) over a soft D5                   | `LANDED`                   |
| 758                     | `pop`: a quick upward sweep as the CTA pill appears         | `CTA_AT`                   |
```
→ new
```
| 30 s frame(s)           | 15 s frame(s)           | Effect (`<name>.wav`)                                       | Reads                                 |
|-------------------------|-------------------------|-------------------------------------------------------------|---------------------------------------|
| 90                      | 64                      | `glow`: a slow-attack bell on A4 as the node lights up      | `opening.brighten`                    |
| 96, 144                 | 70, 106                 | `ring-1`, `ring-3`: bells on D5 and A5                      | `opening.rings`                       |
| 120                     | 88                      | `ring-2`: a bell on F#5 over the pad's third (F#3)          | `opening.rings`                       |
| 222, 236, 250           | 138, 144, 150           | `card`: a muffled tick per card                             | `demo.cards`                          |
| 372, 408, 525, 575, 605 | 168, 186, 234, 266, 284 | `tap`: a short, trackpad-like click                         | `demo.taps`                           |
| 410-440                 | 188-200                 | `shimmer`: high bell grains (E, F#, A, B), getting denser   | `moments().generating`, `demo.typing` |
| 440-490                 | 200-224                 | `key-1` to `key-3`: soft keys, 2 or 3 frames apart          | `demo.typing`                         |
| 609                     | 288                     | `plim`: two bells, A5 then D6                               | `moments().posted`                    |
| 700-750                 | 314-364                 | `glide`: a soft tone rising from D5 to D6, into the landing | `flight()`, `endCard.landed`          |
| 750                     | 364                     | `land`: a high D bell (D6) over a soft D5                   | `endCard.landed`                      |
| 758                     | 372                     | `pop`: a quick upward sweep as the CTA pill appears         | `endCard.cta`                         |
```

The coupling: Edit: old
```
- **The one manual coupling.** The script can't import `brand.ts` (font imports) or `Ad.tsx` (JSX), so `FPS`,
  `TOTAL_FRAMES`, `FEED_CUT` (210) and `END_CUT` (705) are repeated at its top with their sources named, next to the
  glide's and the shimmer's lengths (`GLIDE_FRAMES` for `FLIGHT.dur`, `SHIMMER_SECONDS` for `T.generating` to
  `T.typing[0]`). Nothing checks them: a missed cut is heard as a downbeat that misses the scene change.
```
→ new
```
- **Two numbers repeated by hand.** The script takes the frame rate, the lengths and the cuts from `timelines.ts`;
  only `GLIDE_FRAMES` and `SHIMMER_SECONDS` at its top are repeated. The glide lasts exactly the flight
  (`flight()` in `YouNode.tsx`, 50 frames in both lengths), and the shimmer lasts 1 s, which its `<Sequence>` cuts
  where the typing starts (30 frames after `moments().generating` in the 30 s, 12 in the 15 s). Nothing checks them:
  a glide longer than the flight is cut off at the landing, and a shorter one ends before it.
```

The tuning: Edit: old
```
- **Tuning.** The levels, the harmony and the brightness are constants at the top of the script (`MUSIC_PEAK_DB`,
  `MUSIC_DRIVE_DB`, `PEAK_DB`, `THIRD_DB`, `MIX_DB`, `CUTOFF`, `CHORDS`). On 2026-09-26 the final MP4s measured about
  −15.5 LUFS integrated with a true peak of about −1.9 dBTP, and every effect started within 16 samples (0.3 ms) of
  its frame. After a change, re-render and hold the MP4s to the same targets (−15 ± 1 LUFS, a true peak at or below
  −1 dBTP) with any BS.1770 meter, such as a full ffmpeg's `ebur128=peak=true` filter; Remotion's bundled ffmpeg has
  no filters.
```
→ new
```
- **Tuning.** The levels, the harmony and the brightness are constants at the top of the script (`MUSIC_PEAK_DB`,
  `PEAK_DB`, `THIRD_DB`, `MIX_DB`, `CUTOFF`, `CHORDS`, and each arrangement's `driveDb`, how hard its music hits the
  limiter). On 2026-09-26 the final 30 s MP4s measured about −15.5 LUFS integrated with a true peak of about
  −1.9 dBTP, and every effect started within 16 samples (0.3 ms) of its frame; on 2026-09-30 the 15 s MP4s measured
  about −15.2 LUFS with a true peak of about −2.5 dBTP. After a change, re-render and hold the MP4s to the same targets
  (−15 ± 1 LUFS, a true peak at or below −1 dBTP) with any BS.1770 meter, such as a full ffmpeg's `ebur128=peak=true`
  filter; Remotion's bundled ffmpeg has no filters.
```

In the new tuning bullet, write the day you run Task 7 instead of 2026-09-30, and Task 7 Step 4's loudness and true
peak rounded to one decimal instead of −15.2 and −2.5 (the dry run measured −15.19 LUFS and −2.48 dBTP). Rewrap the
bullet if a line then passes 120 columns.

- [ ] **Step 8: "Commands" and the chart**

Three edits. The commands: Edit: old
```
pnpm render:video     # the WAVs, then all six to video/out/<id>.mp4: H.264 (CRF 18) + AAC, 48 kHz stereo
pnpm render:video ad-pt-9x16 ad-en-9x16                                                  # the WAVs, then only these ids
```
→ new
```
pnpm render:video     # the WAVs, then all ten to video/out/<id>.mp4: H.264 (CRF 18) + AAC, 48 kHz stereo
pnpm render:video ad-pt-9x16 ad-en-9x16                                                  # the WAVs, then only these ids
pnpm render:video ad-pt-4x5-15s ad-en-4x5-15s ad-pt-9x16-15s ad-en-9x16-15s              # the WAVs, then Meta's four
```

The paragraph under them: Edit: old
```
The first render downloads Chrome Headless Shell (~100 MB) once; later renders run offline. All six take about 6
minutes on the dev PC. `pnpm render:video` runs `video/scripts/render.mjs`, which asks Remotion for the ids
(`remotion compositions`, about 10 s, so `Root.tsx` stays the only list) and renders them one after another with the
same flags; an unknown id stops it before any render. `video/out/` and `video/public/audio/` are gitignored. `video/`
has no unit tests: the logic is timing and layout, so `tsc`, ESLint, the safe-zone check in `layouts.ts`, a review of
the stills in every format and the soundtrack's self-check are the checks.
```
→ new
```
The first render downloads Chrome Headless Shell (~100 MB) once; later renders run offline. All ten take about 9
minutes on the dev PC, the four 15 s ones about 2.5. `pnpm render:video` runs `video/scripts/render.mjs`, which asks
Remotion for the ids (`remotion compositions`, about 10 s, so `Root.tsx` stays the only list; the ids are the last
line of its output, after any note about Remotion's cache or the Chrome download) and renders them one after another
with the same flags, adding `--scale=1.3333333333333333` for a `-4x5` id; an unknown id stops it before any render.
`video/out/` and `video/public/audio/` are gitignored. `video/` has no unit tests: the logic is timing and layout, so
`tsc`, ESLint, the safe-zone check in `layouts.ts`, a review of the stills in every format and length and the
soundtrack's self-check are the checks. To prove a change left an ad unchanged, compare stills and audio-only renders
(`--codec=wav --enforce-audio-track`), never MP4s, which aren't reproducible: two renders of the same frames differed
by up to 44 luma levels on edges.
```

If Task 7 Step 1 took more than 3 minutes, write its time rounded to the half minute instead of 2.5, and 6 plus it,
rounded to the minute, instead of 9.

The chart: Edit: old
```
    C --> Ad["Ad.tsx<br/>Opening, Demo, EndCard + YouNode"]
    LY["layouts.ts<br/>1x1, 16x9, 9x16 + safe-zone check"] --> Ad
    G["landing/components/LogoMark.tsx"] --> Ad
    P["scripts/soundtrack.mjs<br/>synth + self-check"] --> W["public/audio/*.wav<br/>(gitignored)"]
    W --> ST["Soundtrack.tsx<br/>music + effects on their frames"]
    ST --> Ad
    Ad --> R["Root.tsx<br/>6 compositions: ad-{pt,en}, ad-{pt,en}-16x9, ad-{pt,en}-9x16"]
    R --> S["pnpm dev:video<br/>Studio preview"]
    R --> V["pnpm render:video → scripts/render.mjs<br/>video/out/ad-*.mp4 (six files)"]
    V --> M["LinkedIn Campaign Manager<br/>(square, manual upload)"]
    V --> YT["Google Ads for YouTube<br/>(16:9 in-stream + 9:16 Shorts, manual upload)"]
    V --> MA["Meta Ads Manager<br/>(9:16 in Reels, Stories and feeds, manual upload)"]
    V --> TT["TikTok Ads Manager<br/>(9:16, manual upload)"]
```
→ new
```
    C --> Ad["Ad.tsx<br/>Opening, Demo, EndCard + YouNode"]
    TL["timelines.ts<br/>30 s + 15 s: every frame the ad times"] --> Ad
    LY["layouts.ts<br/>1x1, 16x9, 9x16, 4x5 + safe-zone check"] --> Ad
    G["landing/components/LogoMark.tsx"] --> Ad
    P["scripts/soundtrack.mjs<br/>synth + self-check"] --> W["public/audio/*.wav<br/>(gitignored)"]
    TL --> P
    W --> ST["Soundtrack.tsx<br/>music + effects on their frames"]
    ST --> Ad
    Ad --> R["Root.tsx<br/>10 compositions: 5 cuts in pt and en"]
    R --> S["pnpm dev:video<br/>Studio preview"]
    R --> V["pnpm render:video → scripts/render.mjs<br/>video/out/ad-*.mp4 (ten files)"]
    V --> M["LinkedIn Campaign Manager<br/>(30 s square, manual upload)"]
    V --> YT["Google Ads for YouTube<br/>(30 s 16:9 in-stream + 9:16 Shorts, manual upload)"]
    V --> MA["Meta Ads Manager<br/>(15 s: 4:5 Facebook Feed, 9:16 Instagram Feed, Reels and Stories, manual upload)"]
    V --> TT["TikTok Ads Manager<br/>(30 s 9:16, manual upload)"]
```

- [ ] **Step 9: "Changing the ad"**

Two edits. The copy: Edit: old
```
- **Copy.** Nothing re-renders on its own: after a change to landing `hero.*` or app `comment.*` / `feed.*`,
  re-render and look at the stills in all three formats before uploading, since a longer string can wrap onto one
  more line, and each format wraps differently. The tight fits today: the PT feed caption in the 16:9 (663 px in
  680), the PT promise's first line in the 9:16 (802 in 820) and the EN fine print in the 9:16 (about 1,512 px, 32
  more than two 740 px lines hold, so it takes 3; 2 or 3 both fit). The PT fine print's second line in the 16:9 ends at
  x 1596 by frame 880, 4 px left of where the overlay stills draw Skip (x 1600–1920, y 800–900), and the check can't see
  it: the zone runs to x 1780 and y 860. The render throws `Expected two sentences in "…"` if `hero.subLine2` stops
  being two sentences.
```
→ new
```
- **Copy.** Nothing re-renders on its own: after a change to landing `hero.*` or app `comment.*` / `feed.*`,
  re-render and look at the stills in every format and length before uploading, since a longer string can wrap onto
  one more line, and each format wraps differently. The tight fits today: the PT feed caption in the 16:9 (663 px in
  680), the PT promise's first line in the 9:16 (802 in 820) and the EN fine print in the 9:16 (about 1,512 px, 32
  more than two 740 px lines hold, so it takes 3; 2 or 3 both fit). The PT fine print's second line in the 16:9 ends at
  x 1596 by frame 880, 4 px left of where the overlay stills draw Skip (x 1600–1920, y 800–900), and the check can't see
  it: the zone runs to x 1780 and y 860. The 4:5 wraps like the square, with the same sizes in the same 860 px column:
  on its stills every text takes the square's line count, and the EN fine print's first line nearly fills the column,
  as in the square. The render throws `Expected two sentences in "…"` if `hero.subLine2` stops being two sentences.
```

Timing, sound and another language: Edit: old
```
- **Timing.** The frame constants live next to what they time: `T` and `TAPS` in `Demo.tsx`, `RINGS`, `BRIGHTEN`,
  `HOOK_AT`, `HOOK_OUT` and `PROMISE_AT` in `Opening.tsx`, `FLIGHT` in `YouNode.tsx`, and `LANDED` and `CTA_AT` in
  `EndCard.tsx`. The node follows `TAPS`, so moving a tap moves the node with it, and every sound effect follows its
  constant the same way.
- **Sound.** The effects follow their constants on their own; the music's form doesn't. A change to a cut (210 or
  705), the length or the frame rate also goes into the constants at the top of `video/scripts/soundtrack.mjs`, and
  so does a new `FLIGHT.dur` or shimmer length, which size the glide and the shimmer ("Sound" above). To tune the
  sound, change the constants there and re-render. Keep the ad working muted: LinkedIn autoplays without sound.
- **Another language.** Add it to `LANGS` and `COPY` in `copy.ts`; `tsc` then lists every missing string, and
  `Root.tsx` registers the new language in all three formats on its own.
```
→ new
```
- **Timing.** Every frame the ad times is in `video/src/timelines.ts`, one timeline per length; the tap positions stay
  in `Demo.tsx` (`TAPS`). The node follows the taps, so moving a tap moves the node with it, and every sound effect
  follows its moment the same way; the music follows the cuts ("Sound" above). The check at load re-checks the node's
  path under every timeline, and the stills show whether a text still has time to be read.
- **Sound.** The effects follow their moments and the music its length's cuts on their own. The arrangement doesn't
  stretch, though: each length's Demo bars fill the time between its cuts, so a cut that moves a lot changes the tempo
  (`ARRANGEMENTS` in `video/scripts/soundtrack.mjs`). A new flight or shimmer length goes into `GLIDE_FRAMES` or
  `SHIMMER_SECONDS` there ("Sound" above). To tune the sound, change the constants there and re-render. Keep the ad
  working muted: LinkedIn autoplays without sound.
- **Another length.** Add its name to `LENGTHS` and its timeline to `TIMELINES` in `timelines.ts`, its arrangement to
  `ARRANGEMENTS` in `soundtrack.mjs` and its `[format, length]` pairs to `CUTS` in `Root.tsx`, which gives its ids a
  `-<length>` suffix. `tsc` names a missing timeline or field, `soundtrack.mjs` throws on a length with no arrangement
  before it writes a file, and the check at load names a node stop outside the zone.
- **Another language.** Add it to `LANGS` and `COPY` in `copy.ts`; `tsc` then lists every missing string, and
  `Root.tsx` registers the new language in every cut on its own.
```

- [ ] **Step 10: §3, §4 and §18**

Three edits outside §15A. §3: Edit: old
```
- **Promo video (`video/`):** [Remotion](https://www.remotion.dev) **4.0.529**, React **19**, TypeScript. Renders the
  ad MP4s locally in three formats (square for LinkedIn, 16:9 for YouTube, 9:16 for Shorts, Reels, Stories and TikTok);
  nothing is deployed ([§15A](#15a-promotional-video-video)).
```
→ new
```
- **Promo video (`video/`):** [Remotion](https://www.remotion.dev) **4.0.529**, React **19**, TypeScript. Renders the
  ad MP4s locally: 30 s in three formats (square for LinkedIn, 16:9 for YouTube, 9:16 for Shorts and TikTok) and a
  15 s cut for Meta in 4:5 and 9:16; nothing is deployed ([§15A](#15a-promotional-video-video)).
```

§4's tree: Edit: old
```
├── video/                       # Remotion promo ad + sound, pt + en in 1:1, 16:9 and 9:16 → video/out/*.mp4 (§15A)
```
→ new
```
├── video/                       # Remotion promo ad + sound, 30 s and 15 s, pt + en, 4 formats → video/out/*.mp4 (§15A)
```

§18's scripts table (the row keeps its width): Edit: old
```
| `dev:video` / `render:video`                   | Build the WAVs, then Studio on port 3100 / render all six MP4s or given ids (§15A). |
```
→ new
```
| `dev:video` / `render:video`                   | Build the WAVs, then Studio on port 3100 / render all ten MP4s or given ids (§15A). |
```

- [ ] **Step 11: A new "Last updated" entry**

It goes on top of the newest entry. Edit: old
```
---

_Last updated: 2026‑09‑29 (Meta placements). **On Meta, the promo ad's 9:16 now covers the feeds too, and the square
```
→ new
```
---

_Last updated: 2026‑09‑30 (Promo for Meta). **The promo ad now has a 15-second cut for Meta, in 4:5 for the Facebook
Feed and in 9:16 for the Instagram Feed, Reels and Stories, in both languages.** Meta's Ads Manager recommends at most
15 s, and 448 frames make a 14.997 s MP4 (450 would show as 15.1). The new `video/src/timelines.ts` holds every frame
the ad times, one timeline per length; the scenes, the gold node and the soundtrack read it, and
`video/scripts/soundtrack.mjs` imports it to write one music file per length (`music-30s.wav`, `music-15s.wav`). The
15 s keeps the story and drops the feed caption and "Nothing is automated.". The 4:5 layout keeps the square's sizes
and column, with its texts in the central square (drawn at 1080×1350, rendered at 1440×1800 with `--scale`).
`Root.tsx` registers ten compositions from a list of cuts, and `render.mjs` reads the ids from the last line of
`remotion compositions`, which also stops it from taking a Remotion cache note for ids. The six 30 s ads are unchanged
(222 stills pixel-identical, audio-only renders byte-identical), the four 15 s MP4s measure about −15.2 LUFS with a
true peak of about −2.5 dBTP, and no app, landing or Convex code changed. Gates: `pnpm typecheck`, `pnpm lint` and
`pnpm format:check` clean; `pnpm -r test` green and unchanged (app 700/700, convex 789/789, landing 75/75). Sections
updated: §3, §4, §15A, §18._

---

_Last updated: 2026‑09‑29 (Meta placements). **On Meta, the promo ad's 9:16 now covers the feeds too, and the square
```

Write the day you run this step instead of 2026‑09‑30, with the same `‑` characters as the entry below it; Task 7
Step 4's loudness and true peak rounded to one decimal instead of −15.2 and −2.5; and Task 7 Step 6's counts if they
differ. Rewrap the entry if a line then passes 120 columns.

- [ ] **Step 12: Check the document**

Write this file (it's new). Path:
```
C:\Users\henri\AppData\Local\Temp\claude\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\00ade649-c22e-4874-92b5-b97ed30d0b3b\scratchpad\meta\docs_check.py
```

```python
"""Scratch, outside the repo (docs/superpowers/plans/2026-09-29-promo-meta.md, Task 8). Read-only: checks
docs/PLATFORM.md after Task 8's edits against the snapshot its Step 1 took.

  python docs_check.py docs/PLATFORM.md "$SP/meta/PLATFORM.before.md"
"""

import datetime
import re
import sys
import unicodedata


def width(text):
    return sum(2 if unicodedata.east_asian_width(ch) in 'WF' else 1 for ch in text)


def cells(line):
    # Split on pipes outside code spans.
    out, cur, code = [], '', False
    for ch in line.strip()[1:-1]:
        if ch == '`':
            code = not code
        if ch == '|' and not code:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    out.append(cur.strip())
    return out


def align(rows):
    # The table as it should be: each cell padded to its column's display width, the dashes 2 wider.
    parsed = [cells(r) for r in rows]
    n = max(len(p) for p in parsed)
    parsed = [p + [''] * (n - len(p)) for p in parsed]
    body = [p for i, p in enumerate(parsed) if i != 1]
    widths = [max(width(p[c]) for p in body) for c in range(n)]
    lines = []
    for i, p in enumerate(parsed):
        if i == 1:
            lines.append('|' + '|'.join('-' * (w + 2) for w in widths) + '|')
        else:
            lines.append('|' + '|'.join(' ' + p[c] + ' ' * (widths[c] - width(p[c])) + ' ' for c in range(n)) + '|')
    return lines


L = open(sys.argv[1], encoding='utf-8').read().split('\n')
before = set(open(sys.argv[2], encoding='utf-8').read().split('\n'))
added = {i for i, line in enumerate(L) if line not in before}

# Names and counts the change retired: in §15A, the §3 bullet, the §4 line and the §18 row.
s = next(i for i, line in enumerate(L) if line.startswith('## 15A.'))
e = next(i for i, line in enumerate(L) if line.startswith('## 16.'))
b = next(i for i, line in enumerate(L) if line.startswith('- **Promo video (`video/`):**'))
scan = [*range(s, e), b, b + 1, b + 2]
scan += [i for i, line in enumerate(L) if re.match(r'\S+ video/ +#', line) or line.startswith('| `dev:video`')]
STALE = re.compile(
    r'TOTAL_FRAMES|BRIGHTEN|\bRINGS\b|HOOK_AT|HOOK_OUT|PROMISE_AT|LANDED|CTA_AT|FLIGHT|\bT\.|`T`|all six'
    r'|six compositions|music\.wav|FEED_CUT|END_CUT|MUSIC_DRIVE_DB|all three formats|nodeStops\(layout\)'
    r'|Stories and (the )?feeds|Reels, Stories and TikTok|1:1, 16:9 and 9:16'
)
print('stale:', [i + 1 for i in scan if STALE.search(L[i])])
print('new lines over 120:', [(i + 1, width(L[i])) for i in sorted(added) if L[i][:1] != '|' and width(L[i]) > 120])
print('em dashes in new lines:', sum(L[i].count(chr(0x2014)) for i in added))

# Tables outside code fences that hold a changed line. Older tables elsewhere may be misaligned; they stay as they are.
misaligned, i, fence = [], 0, False
while i < len(L):
    if L[i].lstrip().startswith(chr(96) * 3):  # a code fence
        fence = not fence
    if not fence and L[i].startswith('|'):
        start = i
        while i < len(L) and L[i].startswith('|'):
            i += 1
        if added & set(range(start, i)) and L[start:i] != align(L[start:i]):
            misaligned.append(start + 1)
        continue
    i += 1
print('misaligned tables:', misaligned)
print('sections:', [L[i][4:] for i in range(s, e) if L[i].startswith('### ')])
print('command #:', [L[i].index('#') for i in range(s, e) if L[i].startswith('pnpm ') and '#' in L[i]])
today = datetime.date.today().isoformat().replace('-', chr(0x2011))
first = next(line for line in L if line.startswith('_Last updated:'))
print('date:', first.startswith(f'_Last updated: {today} (Promo for Meta). '))
```

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/meta/docs_check.py" docs/PLATFORM.md "$SP/meta/PLATFORM.before.md"; echo "exit $?"
```

Expected:
```
stale: []
new lines over 120: []
em dashes in new lines: 0
misaligned tables: []
sections: ['What the ad says', 'How it is built', 'Lengths', 'Formats', 'Sound', 'Commands', 'Changing the ad']
command #: [22, 22, 89, 89, 89, 89, 89]
date: True
exit 0
```
A line number under `stale` points at a retired name or count left in the text: rewrite that sentence the way the
blocks above do. A number under `new lines over 120` or `misaligned tables` is a line or table to rewrap or realign.
`date: False` means the entry's date isn't today's, or its dashes aren't `‑`.

- [ ] **Step 13: The memory notes**

Read `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\promo-video.md` in full first. Leave
its other frontmatter lines and its note on the first mock post's non-breaking spaces as they are. Four edits.

The description: Edit `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\promo-video.md`: old
```
description: "video/ (Remotion 4.0.529) renders the 30 s ad in pt-BR + EN in 3 formats (square LinkedIn, 16:9 YouTube, 9:16 Shorts/Reels/Stories/TikTok) from landing hero.* and app comment.*/feed.* strings, with sound synthesized by video/scripts/soundtrack.mjs; after changing those keys, tell Henriko the ad needs a re-render and a still review in all 3 formats; a timeline change also goes into the script's literals."
```
→ new
```
description: "video/ (Remotion 4.0.529) renders the 30 s ad in pt-BR + EN in 3 formats (square LinkedIn, 16:9 YouTube, 9:16 Shorts/TikTok) plus a 15 s Meta cut in 4:5 (Facebook Feed) and 9:16 (Instagram Feed/Reels/Stories), from landing hero.* and app comment.*/feed.* strings, with sound synthesized by video/scripts/soundtrack.mjs; after changing those keys, tell Henriko the ad needs a re-render and a still review in all 4 formats and both lengths; timing lives in video/src/timelines.ts, which the script imports."
```

The sound paragraph: Edit: old
```
`render:video`), and `Soundtrack.tsx` plays each effect on its constant's frame. The one manual coupling: `FPS`,
`TOTAL_FRAMES`, the cuts 210/705, `GLIDE_FRAMES` (`FLIGHT.dur`) and `SHIMMER_SECONDS` are literals at the script's
top, so a timeline change goes there too. Henriko judges the sound by ear; every tweak is a constant. To re-measure,
```
→ new
```
`render:video`), and `Soundtrack.tsx` plays each effect on its moment's frame. Since the Meta cut the script imports
`video/src/timelines.ts` (frame rate, lengths, cuts); only `GLIDE_FRAMES` (the flight's 50 frames) and
`SHIMMER_SECONDS` stay literals at its top. Henriko judges the sound by ear; every tweak is a constant. To re-measure,
```

The render line: Edit: old
```
`pnpm render:video [ids…]` goes through `video/scripts/render.mjs` (~6 min for all six). After a copy change, review
stills in all three formats: close calls are the 16:9 PT feed caption and the 9:16 PT promise line 1 and EN fine print,
plus the 16:9 PT fine print's line 2, 4 px left of YouTube's Skip, which the check can't see (zone runs to x 1780).
```
→ new
```
`pnpm render:video [ids…]` goes through `video/scripts/render.mjs` (~6 min for the six 30 s ads). After a copy change,
review stills in every format and length: close calls are the 16:9 PT feed caption and the 9:16 PT promise line 1 and
EN fine print, plus the 16:9 PT fine print's line 2, 4 px left of YouTube's Skip, which the check can't see (zone runs
to x 1780).
```

The Meta paragraph: Edit: old
```
Meta (2026-09-29): its ad setup accepted only 4:5 to 9:16 for Instagram ("0.8:1 e 0.5625:1"), so the square and the
16:9 are Facebook-only there; the 9:16 is the Meta file for Reels, Stories and feeds. I had written that the square
"also fits the Instagram and Facebook feeds", which misled Henriko; §15A is fixed. A feed may crop the 9:16 to its
centered 4:5 (y 285–1635): today only dots, the Opening's rings and gray cards fall outside, but the zone starts at
y 270, so the check can't see it.
```
→ new
```
Meta (2026-09-29): its ad setup accepted only 4:5 to 9:16 for Instagram ("0.8:1 e 0.5625:1"), and its Ads Manager
recommends at most 15 s. I had written that the square "also fits the Instagram and Facebook feeds", which misled
Henriko; §15A is fixed. So Meta gets only a 15 s cut (plan `docs/superpowers/plans/2026-09-29-promo-meta.md`, PLATFORM
§15A "Lengths"): `ad-{pt,en}-4x5-15s` (Facebook Feed, drawn at 1080×1350, rendered at 4/3 as 1440×1800) and
`ad-{pt,en}-9x16-15s` (Instagram Feed, Reels, Stories); the 30 s 9:16 stays for Shorts and TikTok. Ten compositions
come from `CUTS` in `Root.tsx`; `video/src/timelines.ts` holds every frame per length, and `soundtrack.mjs` imports it
and writes `music-30s.wav` + `music-15s.wav`. 448 frames, not 450: the AAC runs past the video, and 450 shows as 15.1 s
in Ads Manager. Traps: MP4s aren't reproducible (edges differ by up to 44 luma between renders), so prove "unchanged"
with stills and audio-only renders; Remotion prints cache notes on stdout even with `--quiet` (render.mjs reads the
ids from the last line); a feed that crops the 4:5 to a square leaves a 2-line caption 4 px inside with the drift, and
one that crops the 9:16 to its centered 4:5 (y 285–1635) cuts only dots, rings and gray cards, which the check can't
see. To re-check, re-create the plan's Task 1 `meta.py` and `stills.mjs` in the scratchpad.
```

The index line in `MEMORY.md` must not grow. Measure it first:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
M=/c/Users/henri/.claude/projects/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/memory
$PY -c "import sys; L = open(sys.argv[1], encoding='utf-8').read().splitlines(); print('index line:', len(next(l for l in L if l.startswith('- [Promo video'))))" "$M/MEMORY.md"
```

Expected: `index line: 1189` (another session may have changed it; note the number). Then Read
`C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\MEMORY.md` and make two edits inside
that one line.

Edit `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\MEMORY.md`: old
```
Formats since 2026-09-28: `ad-{pt,en}-16x9` (YouTube in-stream) + `ad-{pt,en}-9x16` (Shorts/Reels/Stories/TikTok, and Meta's feeds: its ad setup takes only 4:5–9:16 for Instagram, so the square is NOT a Meta file, 2026-09-29); numbers + a safe-zone check that throws at load in `video/src/layouts.ts`; `pnpm render:video [ids…]` via `video/scripts/render.mjs`; review stills in all 3 formats.
```
→ new
```
Formats: `ad-{pt,en}-16x9` (YouTube in-stream) + `ad-{pt,en}-9x16` (Shorts/TikTok); Meta gets only a 15 s cut, never the square: `ad-{pt,en}-4x5-15s` (Facebook Feed) + `ad-{pt,en}-9x16-15s` (IG Feed/Reels/Stories), 448 frames; safe-zone check at load in `video/src/layouts.ts`; `pnpm render:video [ids…]` via `video/scripts/render.mjs`; review stills in all 4 formats + both lengths.
```

Edit: old
```
its top repeats FPS, 900 frames and the cuts 210/705 (the one manual coupling);
```
→ new
```
timing from `video/src/timelines.ts`, only GLIDE_FRAMES + SHIMMER_SECONDS literal;
```

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
M=/c/Users/henri/.claude/projects/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/memory
$PY -c "import sys; L = open(sys.argv[1], encoding='utf-8').read().splitlines(); print('index line:', len(next(l for l in L if l.startswith('- [Promo video'))))" "$M/MEMORY.md"
$PY -c "import sys; L = open(sys.argv[1], encoding='utf-8').read().splitlines(); print('note lines over 120:', [i + 1 for i, l in enumerate(L) if len(l) > 120 and not l.startswith('description:')])" "$M/promo-video.md"
```

Expected: `index line: 1183` (at most the number measured before the edits) and `note lines over 120: []`.

- [ ] **Step 14: Tell Henriko it's ready to commit**

Run `git status --short` (it only reads). Then write one message in chat, in pt-BR (decimal commas), with:
- the four MP4s and where each goes: `video/out/ad-pt-4x5-15s.mp4` and `ad-en-4x5-15s.mp4` in the Facebook Feed
  (4:5), `ad-pt-9x16-15s.mp4` and `ad-en-9x16-15s.mp4` in the Instagram Feed, Reels and Stories (9:16); each lasts
  14.997 s (Ads Manager shows 15.0), with Task 7 Step 4's loudness and true peak. Uploading them is Henriko's step.
  The six 30 s ads didn't change, so LinkedIn, YouTube and TikTok need no new upload.
- what to commit: the new `video/src/timelines.ts`; the changed `video/scripts/soundtrack.mjs` and `render.mjs`, and
  `layouts.ts`, `Root.tsx`, `Ad.tsx`, `YouNode.tsx`, `Soundtrack.tsx`, `brand.ts`, `motion.tsx` and the three scenes in
  `video/src/`; `docs/PLATFORM.md`; the spec and this plan. If `git status` shows `?? video/`, the folder has never
  been committed, so its commit carries all of `video/`; name any other file it lists as earlier work this plan didn't
  touch. `video/out/` and `video/public/audio/` are gitignored.
- every passage Steps 2 to 11 carried over by hand, with what differed.

- [ ] **Step 15: No commit.** Henriko commits.
