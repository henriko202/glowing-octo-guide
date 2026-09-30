# Promotional Ad in 16:9 and 9:16 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the approved 30 s ad, in pt-BR and US English, in two more formats, 16:9 (1920×1080) for YouTube in-stream ads and 9:16 (1080×1920) for YouTube Shorts, Instagram Reels, Stories and TikTok, as four new MP4s in `video/out/`, while the square and the sound stay exactly as approved.

**Architecture:** A new `video/src/layouts.ts` holds one `Layout` per format (frame, safe zone, the mock's stage origin, the node's home, text boxes and font sizes, dots and gray cards) and checks at load that every text box, the mock's text area, the node's home and every stop on its path sit inside the format's safe zone. The app mock keeps drawing in the square's 1080×1080 coordinates on a stage placed at the layout's origin, so the taps, the node's path and the sound don't change; the Opening, the captions and the end card read their boxes and sizes from the layout. `Root.tsx` registers six compositions, and a new `video/scripts/render.mjs` renders all of them or only the ids given. A scratch Python script outside the repo (`$SP/formats.py`) measures the results: the square's pixel identity, the audio's byte identity, dark frames, line counts, and contact sheets with every platform overlay drawn on top.

**Tech Stack:** Remotion `4.0.529`, React 19, TypeScript 5.9, Node 24 (ESM, `node:` built-ins only). For measuring only, outside the repo: Python 3.11 with numpy and Pillow, and Remotion's bundled ffmpeg.

**Spec:** `docs/superpowers/specs/2026-09-28-promo-formats-design.md` (approved 2026-09-28). Read it before starting; this plan argues from it. The square's design is in `docs/superpowers/specs/2026-09-26-promo-video-design.md` and its sound in `docs/superpowers/specs/2026-09-26-promo-audio-design.md`; `docs/PLATFORM.md` §15A summarizes both.

## Global Constraints

Copied from the spec; every task must meet them.

- **Output:** `video/out/ad-pt-16x9.mp4`, `ad-en-16x9.mp4`, `ad-pt-9x16.mp4` and `ad-en-9x16.mp4`: 1920×1080 or 1080×1920, 30 fps, 30.0 s, H.264 plus AAC at 48 kHz stereo, with the square's flags (`--crf=18 --jpeg-quality=100 --enforce-audio-track`).
- **The square doesn't change:** `ad-pt` and `ad-en` keep their ids, size and output paths, and their 12 stills (frames 75, 190, 340, 500, 690 and 880 in both languages) stay pixel-identical to stills rendered before the first code change.
- **The sound doesn't change:** audio-only renders (`--codec=wav`) of all six compositions are byte-identical to the square's. `Soundtrack.tsx`, `copy.ts`, `motion.tsx` and `scripts/soundtrack.mjs` don't change, and no frame constant moves.
- **The layouts are spec §3's numbers,** value for value. A change to one goes through Henriko at the stills gate (Task 5) and into the spec's §3 in the same change.
- **The check at load:** for every format, the Opening's text box, the caption box, the end card's block (column, logo top to the fine print's last line), the mock's text area plus the stage origin, the node's home and every stop from `nodeStops(layout)` sit inside the zone. A failure throws `<format>: <element> (x <from>–<to>, y <from>–<to>) is outside the safe zone (x <from>–<to>, y <from>–<to>)`, which stops the Studio, `remotion compositions` and every render. It leaves out the camera drift, the text inside each box, the flight's arc and the gray cards.
- **No dark beats:** no MP4 has a run of 3 or more frames with nothing brighter than luma 100, except inside the square's own dark stretches, frames 0–5 and 86–90 (deviation 1).
- **`render.mjs`:** plain Node, no dependencies. It asks `remotion compositions src/index.ts --quiet` for the ids, so `Root.tsx` stays the only list; an unknown id stops it before any render; it renders one id after another with the square's flags.
- **No new dependency,** in `video/` or anywhere.
- **Gates:** `pnpm typecheck`, `pnpm lint` and `pnpm format:check` clean; `pnpm -r test` unchanged (app 700/700, convex 789/789, landing 75/75).
- **Henriko approves the overlay stills before the final render.** Task 5 ends on an explicit yes.
- **Repo rules (CLAUDE.md + memory):**
  - **No git state changes at all.** No `git commit`, `git push`, `git stash`, `git checkout`, `git reset` or `git add`; Henriko commits everything.
  - Change files with the Edit and Write tools. Never use sed, heredocs or node scripts to edit; Bash is for read-only work, for running tools, and for scratch files in `$SP` (below). In the repo, the one exception is `cp`, `rm` and output redirects for generated files under `video/out/` and `video/public/audio/`, plus Task 1's one-pixel change to a generated still in `video/out/formats-after/`.
  - Use pnpm, never npm. Never run `pnpm format` (it rewrites the whole repo); `prettier --check` and `pnpm format:check` only read.
  - `docs/PLATFORM.md` is updated in the same change.
- **Shell:** every command runs in Git Bash from the repo root, `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI`. Never `cd video` (the working directory persists between Bash calls); run the package's tools with `pnpm --filter video exec`. Shell variables don't survive between Bash calls, so every block that uses `$SP` or `$PY` starts with this line:
  ```bash
  export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
  ```
- **Known noise:** every Remotion command prints a yellow "Version mismatch: zod installed 4.4.3, required 4.5.4" block. It predates this work and is harmless; ignore it.

## Review Focus

The five uncovered ways this breaks for a person using the ad or the repo, most likely first. Each one is pinned to a step in the task that owns the code.

1. **A layout leaves its safe zone,** from a typo in `layouts.ts` or a later tweak to one number. Expected: the Studio, `remotion compositions` and every render stop before a frame is drawn, naming the format, the element and both rectangles. Pinned by Task 3 Steps 2 and 5 (a caption moved out on purpose goes unnoticed, then the check names it), Task 3 Step 7 (the end card and the node's home, the other two kinds of item), and Task 4 Step 5 (`pnpm render:video` stops on it and writes no MP4).
2. **The square changes by accident** while every scene learns to read a layout. Expected: its 12 stills stay pixel-identical. Pinned by Task 1 Step 6 (the comparison fails on a one-pixel change), Task 2 Step 13 (after the refactor) and Task 6 Step 5 (after everything).
3. **A typo'd id** in `pnpm render:video ad-pt-9x61`. Expected: it stops before any render, names the id, lists the six real ones and leaves every MP4 alone. Pinned by Task 4 Step 4.
4. **A text wraps differently from spec §3** (the fonts measure a little off, or a close call flips). Expected: `formats.py lines` names the frame and the count, and the mismatch goes to Henriko with the still, not into a quick fix. First check that the counter's box isn't clipping the text. Pinned by Task 5 Step 3.
5. **The sound drifts or a new dark beat appears** in a new format (a scene that starts late, a fade that goes blank). Expected: all six audio renders are byte-identical, and no MP4 goes dark for 3+ frames outside frames 0–5 and 86–90. Pinned by Task 6 Steps 3 and 4.

## Deviations from the spec (for Henriko to approve with this plan)

- **1. The dark-frame rule allows the square's own dark stretches.** Spec §1 and §5.5 allow no run of more than 2 frames with nothing brighter than luma 100, but the approved square already has two: frames 0–5 (before the hook's first word) and 86–90 (after the hook leaves, before the node lights up), measured on its MP4s of 2026-09-26. The check allows runs inside those two stretches and fails any other, so the new formats meet the square's own standard.
- **2. Frame 600 joins the review frames: 28 stills, not 24.** None of the square's six frames shows the handoff's first sentence (frames 539–628), and spec §3 gives it 3 lines in the 16:9. The square's own before/after comparison keeps its six frames.
- **3. The line counter measures height.** `formats.py lines` takes the height from the first to the last bright row in the text's box and divides it into line pitches; counting bands of bright rows would merge lines whose accents and descenders touch. Task 1 runs it on the square's stills first, where it must reproduce spec §3's 1:1 column. The 9:16's EN fine print may count 2 or 3 (spec §3: either fits its 3-line budget), so the check accepts both.
- **4. `FINE_PRINT_LINE` is exported from `EndCard.tsx`.** The spec's end-card block ends at "lines × size × 1.45"; the plan names the 1.45 once, in `EndCard.tsx`, and `layouts.ts` imports it, so the check and the drawing can't drift apart.
- **5. `FORMATS` grows in two steps.** Task 2 moves the square onto a layout with `FORMATS = ['1x1']` only and proves it pixel-identical before Task 3 adds `'16x9'` and `'9x16'`. The spec shows the three-entry form, which is where Task 3 ends.
- **6. The message's shape for points.** The spec's example covers a box. A point (the node's home, a stop) prints as `x 960, y 60`, and a stop is named by its frame, like `node stop at frame 348`.
- **7. The dots are computed inside the Opening, memoized per layout.** Today they're a module-level constant. Computing them at module level per format would need a value import of `LAYOUTS` in `Opening.tsx`, which closes an import cycle (`layouts.ts` → `YouNode.tsx` → `Opening.tsx` → `layouts.ts`). `useMemo(() => makeDots(layout), [layout])` avoids it, and the seeded `random()` gives the same dots on every call.
- **8. Task 4 renders `ad-pt-9x16` once before the stills gate,** to prove that one id renders only that file (spec §5.6). Task 6's full render overwrites it; if Henriko asks for a change in Task 5, that early MP4 is stale until then.
- **9. The §4 tree line drops "not deployed"** to fit the three formats in 120 columns. §3 and §15A still say nothing in `video/` is deployed.

## File map

```
video/
  package.json          # "render" runs scripts/render.mjs after the audio (Task 4)
  scripts/
    render.mjs          # new: renders every composition, or only the ids given (Task 4)
  src/
    layouts.ts          # new: FORMATS, Layout, LAYOUTS (Task 2: 1x1; Task 3: 16x9, 9x16 + the check)
    Root.tsx            # one composition per language and format (Task 2)
    Ad.tsx              # props { lang, format }; passes the layout on (Task 2)
    YouNode.tsx         # its path per layout; exports nodeStops(layout) (Task 2)
    brand.ts            # comments on SIZE and COL only (Task 2)
    scenes/
      Opening.tsx       # home, text box, sizes and dots from the layout (Task 2)
      Demo.tsx          # the mock on a stage; captions and gray cards from the layout (Task 2); MOCK_TEXT (Task 3)
      EndCard.tsx       # column and sizes from the layout; logoNode(layout) (Task 2); FINE_PRINT_LINE (Task 3)
  out/                  # gitignored: the six MP4s, formats-{before,after,stills,sheets,audio}/, logs
```

Modified outside `video/`: `docs/PLATFORM.md` (Task 7). Outside the repo: `$SP/formats.py` (Task 1) and the memory notes `promo-video.md` and `MEMORY.md` (Task 7).

---

### Task 1: Baseline before any code change

**Files:**
- Create (scratchpad, not the repo): `C:\Users\henri\AppData\Local\Temp\claude\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\00ade649-c22e-4874-92b5-b97ed30d0b3b\scratchpad\formats.py`
- Create (gitignored): `video/out/formats-before/` (12 stills), `video/out/formats-audio/before.wav` and `ad-en.wav`

**Interfaces:**
- Consumes: the square as it is today (`ad-pt`, `ad-en`) and its approved MP4s in `video/out/`.
- Produces: `$SP/formats.py` with the modes `square`, `audio`, `blank`, `lines` and `sheets`; the 12 before-stills `video/out/formats-before/ad-{pt,en}-{75,190,340,500,690,880}.png`; the baseline audio `video/out/formats-audio/before.wav` (from `ad-pt`).

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
The three test lines may come in another order. If a count differs, stop and tell Henriko: another session changed the repo, and the gates at the end need the new numbers.

- [ ] **Step 2: Render the square's 12 before-stills**

Run (about 2 minutes; give the Bash call a 10-minute timeout):
```bash
mkdir -p video/out/formats-before && for l in pt en; do for f in 75 190 340 500 690 880; do pnpm --filter video exec remotion still src/index.ts ad-$l out/formats-before/ad-$l-$f.png --frame=$f > /dev/null 2>&1 || echo "still failed: ad-$l $f"; done; done; ls video/out/formats-before | wc -l
```
Expected: `12`, and no `still failed` line. If one fails, run that still again without the redirect to see why.

- [ ] **Step 3: Write the measuring script**

The file may already exist from the design work: Read it first (the Write tool needs that), then Write this content over it. Path: `C:\Users\henri\AppData\Local\Temp\claude\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\00ade649-c22e-4874-92b5-b97ed30d0b3b\scratchpad\formats.py`

```python
"""Checks for the promo ad's 16:9 and 9:16 formats (docs/superpowers/plans/2026-09-28-promo-formats.md). Scratch.

  python formats.py square   the square's 12 stills in out/formats-after/ match out/formats-before/ pixel for pixel
  python formats.py audio    the six audio-only renders in out/formats-audio/ match before.wav byte for byte
  python formats.py blank    each MP4 goes dark (nothing above luma 100) for 3+ frames only where the square does
  python formats.py lines    each text wraps onto the lines the spec's §3 lists, counted on the stills
  python formats.py sheets   contact sheets of the new stills with the safe zone and the §3.3 readings drawn on top

Run from the repo root; the files are under video/out/. Prints one PASS or FAIL line per check, then N/M, and exits 1
if any check fails. A missing file fails its check, not the script.
"""

import filecmp
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path('video/out')
FFMPEG = Path(
    'node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.529/node_modules/@remotion/compositor-win32-x64-msvc/'
    'ffmpeg.exe'
)
LANGS = ['pt', 'en']
NEW = ['ad-pt-16x9', 'ad-en-16x9', 'ad-pt-9x16', 'ad-en-9x16']
IDS = ['ad-pt', 'ad-en'] + NEW
SQUARE_FRAMES = [75, 190, 340, 500, 690, 880]
FRAMES = [75, 190, 340, 500, 600, 690, 880]  # + 600: handoff sentence 1, which no square review frame shows
# The approved square's dark stretches: before the hook's first word, and from the hook's exit to the node lighting up.
SQUARE_DARK = [(0, 5), (86, 90)]

# Spec §3 in frame pixels. Boxes are (x, y, w, h); `column` is the end card's (x, w); `fine` is (top, size, lines).
LAYOUT = {
    '1x1': {'size': (1080, 1080), 'opening': (110, 450, 860, 450), 'hook': 88, 'promise': 96,
            'caption': (110, 100, 860, 160), 'text': 64, 'column': (110, 860), 'fine': (740, 28, 3)},
    '16x9': {'size': (1920, 1080), 'opening': (320, 440, 1280, 420), 'hook': 96, 'promise': 112,
             'caption': (160, 110, 680, 690), 'text': 80, 'column': (260, 1400), 'fine': (720, 36, 2)},
    '9x16': {'size': (1080, 1920), 'opening': (130, 680, 820, 450), 'hook': 88, 'promise': 96,
             'caption': (130, 330, 820, 160), 'text': 64, 'column': (130, 820), 'fine': (970, 28, 3)},
}
# Spec §3's line counts, frame -> (PT, EN). A set allows either count: the 9:16's EN fine print measures 819 px in 820.
WRAPS = {
    '1x1': {75: (3, 2), 190: (3, 4), 340: (2, 2), 500: (2, 2), 690: (1, 1), 880: (3, 2)},
    '16x9': {75: (2, 2), 190: (2, 2), 340: (2, 2), 500: (3, 2), 600: (3, 3), 690: (1, 2), 880: (2, 2)},
    '9x16': {75: (3, 2), 190: (3, 4), 340: (2, 2), 500: (2, 2), 600: (2, 2), 690: (1, 1), 880: (3, {2, 3})},
}


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


GREEN, BLUE, MAGENTA, ORANGE, RED = (40, 220, 120), (80, 160, 255), (255, 70, 200), (255, 160, 40), (255, 70, 70)
# The safe zone and spec §3.3's readings, in frame pixels: (legend, color, outline). Two points draw a line; an empty
# legend shares the entry above it.
READINGS = {
    '16x9': [
        ('safe zone: x 140-1780, y 90-860', GREEN, rect(140, 90, 1780, 860)),
        ('YouTube: keep text in the center 80% and the top 70%', BLUE, rect(192, 0, 1728, 756)),
        ('YouTube: the bottom 25% is the riskiest (y 810)', ORANGE, [(0, 810), (1920, 810)]),
        ('YouTube: "Ad" label and advertiser (30% x 10%), Skip (approximate)', RED, rect(0, 972, 576, 1080)),
        ('', RED, rect(1600, 800, 1920, 900)),
    ],
    '9x16': [
        ('safe zone: x 120-960, y 270-1248', GREEN, rect(120, 270, 960, 1248)),
        ('Meta: top 14%, bottom 35%, sides 6%, corner 40% x 300 px', BLUE,
         [(65, 269), (1015, 269), (1015, 1152), (780, 1152), (780, 1248), (65, 1248)]),
        ('TikTok template: top 240, bottom 660, sides 120, rail x > 780 below y 960', MAGENTA,
         [(120, 240), (960, 240), (960, 960), (780, 960), (780, 1260), (120, 1260)]),
        ('TikTok per AdCheckLab: top 200, bottom 450, left 86, right 140', ORANGE, rect(86, 200, 940, 1470)),
        ('Shorts text: 380 from the top and the bottom, 60 left, 120 right', RED, rect(60, 380, 960, 1540)),
    ],
}


def fmt_of(id):
    return id.split('-')[2] if id.count('-') == 2 else '1x1'


def square():
    same, changed, missing = 0, [], []
    for lang in LANGS:
        for frame in SQUARE_FRAMES:
            name = f'ad-{lang}-{frame}.png'
            a, b = OUT / 'formats-before' / name, OUT / 'formats-after' / name
            if not (a.exists() and b.exists()):
                missing.append(name)
            elif np.array_equal(np.asarray(Image.open(a)), np.asarray(Image.open(b))):
                same += 1
            else:
                changed.append(name)
    text = f'square: {same} of 12 stills identical, changed: {", ".join(changed) or "none"}, missing: {len(missing)}'
    return [(same == 12, text)]


def audio():
    before = OUT / 'formats-audio' / 'before.wav'
    same, differ, missing = [], [], []
    for id in IDS:
        wav = OUT / 'formats-audio' / f'{id}.wav'
        if not (before.exists() and wav.exists()):
            missing.append(id)
        elif filecmp.cmp(before, wav, shallow=False):
            same.append(id)
        else:
            differ.append(id)
    text = f'audio: {len(same)} of 6 renders byte-identical to before.wav, differ: {", ".join(differ) or "none"}, '
    return [(len(same) == 6, text + f'missing: {", ".join(missing) or "none"}')]


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


def blank():
    results = []
    for id in IDS:
        mp4 = OUT / f'{id}.mp4'
        if not mp4.exists():
            results.append((False, f'blank, {id}: missing {mp4.as_posix()}'))
            continue
        levels = peaks(mp4, *LAYOUT[fmt_of(id)]['size'])
        runs = dark_runs(levels)
        ok = len(levels) == 900 and all(any(a <= s and e <= b for a, b in SQUARE_DARK) for s, e in runs)
        found = ', '.join(f'{s}-{e}' for s, e in runs) or 'none'
        results.append((ok, f'blank, {id}: {len(levels)} frames, dark runs of 3+: {found} (allowed: 0-5, 86-90)'))
    return results


def text_at(fmt, frame):
    """The box a review frame's text sits in, its font size and its line height (Opening, Demo, EndCard)."""
    layout = LAYOUT[fmt]
    if frame == 75:
        return layout['opening'], layout['hook'], 1.1
    if frame == 190:
        return layout['opening'], layout['promise'], 1.05
    if frame == 880:
        (x, w), (top, size, lines) = layout['column'], layout['fine']
        return (x, top, w, round((lines + 1) * size * 1.45)), size, 1.45
    return layout['caption'], layout['text'], 1.1


def count_lines(png, box, size, line_height):
    """Lines of text in a box: the height from the first to the last row with a pixel brighter than luma 120, in line
    pitches. Counting bands of bright rows would merge lines whose accents and descenders touch; this doesn't."""
    x, y, w, h = box
    luma = np.asarray(Image.open(png).convert('L'))[y:y + h, x:x + w]
    rows = np.flatnonzero((luma > 120).any(axis=1))
    if rows.size == 0:
        return 0
    return round((rows[-1] - rows[0] + 1 - size) / (size * line_height) + 1)


def lines():
    results = []
    for id in IDS:
        fmt, lang = fmt_of(id), id.split('-')[1]
        folder, frames = ('formats-before', SQUARE_FRAMES) if fmt == '1x1' else ('formats-stills', FRAMES)
        found, ok = [], True
        for frame in frames:
            want = WRAPS[fmt][frame][LANGS.index(lang)]
            want = want if isinstance(want, set) else {want}
            png = OUT / folder / f'{id}-{frame}.png'
            if not png.exists():
                found.append(f'{frame}=missing')
                ok = False
                continue
            n = count_lines(png, *text_at(fmt, frame))
            found.append(f'{frame}={n}' + ('' if n in want else f' (expected {" or ".join(map(str, sorted(want)))})'))
            ok = ok and n in want
        results.append((ok, f'lines, {id}: {", ".join(found)}'))
    return results


def sheets():
    results = []
    font = ImageFont.load_default(size=28)
    for id in NEW:
        fmt = fmt_of(id)
        pngs = [OUT / 'formats-stills' / f'{id}-{frame}.png' for frame in FRAMES]
        missing = [png.name for png in pngs if not png.exists()]
        if missing:
            results.append((False, f'sheets, {id}: {len(missing)} of {len(FRAMES)} stills missing'))
            continue
        readings = READINGS[fmt]
        legends = [(label, color) for label, color, _ in readings if label]
        w, h = (side // 2 for side in LAYOUT[fmt]['size'])
        cols = 2 if fmt == '16x9' else 4
        top = 20 + 40 * len(legends)
        sheet = Image.new('RGB', (cols * w, top + -(-len(FRAMES) // cols) * h), (14, 19, 32))
        draw = ImageDraw.Draw(sheet)
        for i, (label, color) in enumerate(legends):
            draw.line([(20, 34 + 40 * i), (80, 34 + 40 * i)], fill=color, width=5)
            draw.text((96, 20 + 40 * i), label, fill=(245, 240, 232), font=font)
        for i, (frame, png) in enumerate(zip(FRAMES, pngs)):
            still = Image.open(png).convert('RGB')
            pen = ImageDraw.Draw(still)
            for _, color, points in readings:
                pen.line(points + (points[:1] if len(points) > 2 else []), fill=color, width=5)
            x, y = i % cols * w, top + i // cols * h
            sheet.paste(still.resize((w, h), Image.Resampling.LANCZOS), (x, y))
            draw.rectangle([x, y, x + 170, y + 40], fill=(0, 0, 0))
            draw.text((x + 10, y + 6), f'frame {frame}', fill=(245, 240, 232), font=font)
        path = OUT / 'formats-sheets' / f'{id}.png'
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path)
        results.append((True, f'sheets, {id}: {path.as_posix()}'))
    return results


MODES = {'square': square, 'audio': audio, 'blank': blank, 'lines': lines, 'sheets': sheets}

if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in MODES:
        sys.exit(f'usage: python formats.py {"|".join(MODES)}')
    results = MODES[sys.argv[1]]()
    for ok, text in results:
        print(f'{"PASS" if ok else "FAIL"}  {text}')
    passed = sum(ok for ok, _ in results)
    print(f'{passed}/{len(results)} checks pass')
    sys.exit(0 if passed == len(results) else 1)
```

- [ ] **Step 4: Run the checks that can run now**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/formats.py" square; echo "exit $?"
$PY "$SP/formats.py" lines; echo "exit $?"
$PY "$SP/formats.py" blank; echo "exit $?"
```

Expected:
```
FAIL  square: 0 of 12 stills identical, changed: none, missing: 12
0/1 checks pass
exit 1
PASS  lines, ad-pt: 75=3, 190=3, 340=2, 500=2, 690=1, 880=3
PASS  lines, ad-en: 75=2, 190=4, 340=2, 500=2, 690=1, 880=2
FAIL  lines, ad-pt-16x9: 75=missing, 190=missing, 340=missing, 500=missing, 600=missing, 690=missing, 880=missing
FAIL  lines, ad-en-16x9: 75=missing, 190=missing, 340=missing, 500=missing, 600=missing, 690=missing, 880=missing
FAIL  lines, ad-pt-9x16: 75=missing, 190=missing, 340=missing, 500=missing, 600=missing, 690=missing, 880=missing
FAIL  lines, ad-en-9x16: 75=missing, 190=missing, 340=missing, 500=missing, 600=missing, 690=missing, 880=missing
2/6 checks pass
exit 1
PASS  blank, ad-pt: 900 frames, dark runs of 3+: 0-5, 86-90 (allowed: 0-5, 86-90)
PASS  blank, ad-en: 900 frames, dark runs of 3+: 0-5, 86-90 (allowed: 0-5, 86-90)
FAIL  blank, ad-pt-16x9: missing video/out/ad-pt-16x9.mp4
FAIL  blank, ad-en-16x9: missing video/out/ad-en-16x9.mp4
FAIL  blank, ad-pt-9x16: missing video/out/ad-pt-9x16.mp4
FAIL  blank, ad-en-9x16: missing video/out/ad-en-9x16.mp4
2/6 checks pass
exit 1
```
What this proves: `square` reports missing files instead of crashing; `lines` reproduces spec §3's 1:1 column on the square's real stills, so the counter works (deviation 3); `blank` finds exactly the square's own two dark stretches in its approved MP4s (deviation 1).

- [ ] **Step 5: Render the baseline audio**

Run (about 90 s; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
pnpm --filter video audio && mkdir -p video/out/formats-audio && pnpm --filter video exec remotion render src/index.ts ad-pt out/formats-audio/before.wav --codec=wav --enforce-audio-track > video/out/formats-audio/render.log 2>&1 && pnpm --filter video exec remotion render src/index.ts ad-en out/formats-audio/ad-en.wav --codec=wav --enforce-audio-track >> video/out/formats-audio/render.log 2>&1; echo "exit $?"
stat -c '%n %s' video/out/formats-audio/*.wav
$PY "$SP/formats.py" audio; echo "exit $?"
```

Expected (the first line comes from the soundtrack script, which rebuilds the WAVs the renders play):
```
soundtrack: 15 WAVs in D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\public\audio (… s)
exit 0
video/out/formats-audio/ad-en.wav 5760142
video/out/formats-audio/before.wav 5760142
FAIL  audio: 1 of 6 renders byte-identical to before.wav, differ: none, missing: ad-pt, ad-pt-16x9, ad-en-16x9, ad-pt-9x16, ad-en-9x16
0/1 checks pass
exit 1
```
The one match is `ad-en`: the PT and EN audio are the same bytes, which is why a byte comparison is a fair test of "sample for sample".

- [ ] **Step 6: Prove the square check can fail**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
cp -r video/out/formats-before video/out/formats-after && $PY "$SP/formats.py" square; echo "exit $?"
$PY -c "from PIL import Image; p='video/out/formats-after/ad-pt-75.png'; im=Image.open(p).convert('RGB'); im.putpixel((0,0),(255,0,0)); im.save(p)" && $PY "$SP/formats.py" square; echo "exit $?"
rm -rf video/out/formats-after; ls video/out | grep -c formats-after
```

Expected:
```
PASS  square: 12 of 12 stills identical, changed: none, missing: 0
1/1 checks pass
exit 0
FAIL  square: 11 of 12 stills identical, changed: ad-pt-75.png, missing: 0
0/1 checks pass
exit 1
0
```
The copy passes, one red pixel fails and is named, and the copies are gone before Task 2 renders the real after-stills.

- [ ] **Step 7: No commit.** Henriko commits.

---

### Task 2: The square on a layout (a pure refactor)

**Files:**
- Create: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Opening.tsx` (whole file)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\EndCard.tsx` (whole file)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\YouNode.tsx` (whole file)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Demo.tsx` (five edits)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Ad.tsx` (seven edits)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Root.tsx` (whole file)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\brand.ts` (two comments)
- Create (gitignored): `video/out/formats-after/` (12 stills)

**Interfaces:**
- Consumes: Task 1's `video/out/formats-before/` and `formats.py square`.
- Produces (later tasks rely on these names and types):
  - `layouts.ts`: `FORMATS` (`['1x1']` until Task 3), `type Format`, `type Layout` (fields below), `LAYOUTS: Record<Format, Layout>`.
  - `Opening({ copy, layout }: { copy: AdCopy; layout: Layout })`, and the same props for `Demo` and `EndCard`; `YouNode({ layout }: { layout: Layout })`.
  - `logoNode(layout: Layout): { x: number; y: number; r: number }` in `EndCard.tsx`, the logo's node in frame coordinates.
  - `nodeStops(layout: Layout): { at: number; dur: number; x: number; y: number }[]` in `YouNode.tsx`, every stop on the node's path in frame coordinates.
  - `AdProps = { lang: Lang; format: Format }`; composition ids `ad-<lang>` for `1x1` and `ad-<lang>-<format>` for the others.
  - Removed: `HOME` (`Opening.tsx`) and `LOGO_NODE` (`EndCard.tsx`). Unchanged exports: `BRIGHTEN`, `RINGS`, `LANDED`, `CTA_AT`, `FLIGHT`, `T`, `TAPS`.
  - Every scene and `YouNode` imports only `type Layout` from `layouts.ts`, never a value, so Task 3 can make `layouts.ts` import from them without a cycle.

- [ ] **Step 1: Create `layouts.ts` with the square's numbers**

Write `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`:

```ts
import { SIZE } from './brand'

// Each composition is one language in one format (Root.tsx).
export const FORMATS = ['1x1'] as const
export type Format = (typeof FORMATS)[number]
type Box = { x: number; y: number; w: number; h: number }
type Point = { x: number; y: number }
type TextAt = { top: number; size: number }
export type Layout = {
  width: number
  height: number
  zone: Box // where text and taps may go: clear of each platform's own labels and buttons
  stage: Point // the mock's origin: it draws in the square's 1080×1080 coordinates (Demo.tsx)
  home: Point // the gold node's home in the Opening
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

export const LAYOUTS: Record<Format, Layout> = {
  // The square, for the LinkedIn feed: the numbers the ad was designed with.
  '1x1': {
    width: SIZE,
    height: SIZE,
    zone: { x: 90, y: 90, w: 900, h: 900 },
    stage: { x: 0, y: 0 },
    home: { x: 540, y: 250 },
    opening: { box: { x: 110, y: 450, w: 860, h: 450 }, hook: 88, promise: 96, dots: 40 },
    caption: { box: { x: 110, y: 100, w: 860, h: 160 }, size: 64, align: 'center' },
    skeletons: 1,
    endCard: {
      x: 110,
      w: 860,
      logo: { top: 190, h: 200 },
      title: { top: 420, size: 60 },
      cta: { top: 528, size: 34 },
      url: { top: 660, size: 30 },
      finePrint: { top: 740, size: 28, lines: 3 }
    }
  }
}
```

- [ ] **Step 2: Rewrite `Opening.tsx` to read the layout**

Read `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Opening.tsx` first, then Write this over it. What changes: `HOME`, `TEXT` and the literal sizes 88 and 96 come from the layout; the dots are drawn over the whole frame and memoized per layout (deviation 7); one new rule keeps only the dots within the first ring's full reach (`d > RING_MAX - 80` skips a dot; it never fires in the square, whose farthest dot is 935 px away, so the square keeps its 40 dots).

```tsx
import { useMemo } from 'react'
import { AbsoluteFill, random, useCurrentFrame } from 'remotion'
import { C, SERIF, XF } from '../brand'
import type { AdCopy } from '../copy'
import type { Layout } from '../layouts'
import { exitStyle, progress, STAGGER, Words } from '../motion'

// The frame the gold "you" node lights up and the frames it pulses (YouNode.tsx draws it; its home is in the layout).
export const BRIGHTEN = 90
export const RINGS = [96, 120, 144]

const RING_LIFE = 72 // frames for a ring to grow to RING_MAX
const RING_MAX = 1040 // px: past the farthest dot, so every dot lights up fully
const HOOK_AT = 4
const HOOK_OUT = 84
const PROMISE_AT = 98

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

export function Opening({ copy, layout }: { copy: AdCopy; layout: Layout }) {
  const frame = useCurrentFrame()
  const dots = useMemo(() => makeDots(layout), [layout])
  const { home, opening } = layout
  const reach = RING_MAX * progress(frame, RINGS[0], RING_LIFE)
  const line2At = PROMISE_AT + copy.promise[0].split(' ').length * STAGGER + 6
  return (
    <AbsoluteFill>
      <svg
        width={layout.width}
        height={layout.height}
      >
        {RINGS.map(at => {
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
        {frame < HOOK_OUT + XF ? (
          <div style={{ fontSize: opening.hook, lineHeight: 1.1, ...exitStyle(frame, HOOK_OUT) }}>
            <Words
              text={copy.hook}
              start={HOOK_AT}
            />
          </div>
        ) : (
          <>
            <div style={{ fontSize: opening.promise, lineHeight: 1.05 }}>
              <Words
                text={copy.promise[0]}
                start={PROMISE_AT}
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
```

Before writing, compare the current file's JSX with this one: apart from the names above (`HOME` → `home`, `TEXT` → `opening.box`, `DOTS` → `dots`, 88/96 → `opening.hook`/`opening.promise`, the svg's size), every element, attribute and style must be the same. If the current file differs somewhere else, keep the current version of that part: the square must stay pixel-identical.

- [ ] **Step 3: Rewrite `EndCard.tsx` to read the layout**

Read `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\EndCard.tsx` first, then Write this over it. What changes: the column, the logo's box and the four text sizes come from the layout; `LOGO_NODE` becomes `logoNode(layout)`; the CTA's padding and arrow gap scale with its font size (22, 52 and 14 px at the square's 34 px, spec §0 detail 9). The same comparison rule as Step 2 applies.

```tsx
import type { CSSProperties } from 'react'
import { AbsoluteFill, spring, useCurrentFrame } from 'remotion'
import LogoMark from '../../../landing/components/LogoMark'
import { C, FPS, SANS, SERIF } from '../brand'
import type { AdCopy } from '../copy'
import type { Layout } from '../layouts'
import { enterStyle, progress, Words } from '../motion'

export const LANDED = 750
export const CTA_AT = 758 // the CTA pill pops in

// The logo's box, centered on the column: landing/components/LogoMark.tsx is 125 wide for every 200 tall.
function logoBox({ endCard }: Layout) {
  const w = (endCard.logo.h * 125) / 200
  return { left: endCard.x + endCard.w / 2 - w / 2, top: endCard.logo.top, w, h: endCard.logo.h }
}

// Where the gold "you" node lands (YouNode.tsx): on the logo's own node, which the reveal below never uncovers.
// Geometry of LogoMark.tsx: viewBox 11.5 3.2 25.5 40.8, node at (28.4, 7.6), r 2.4.
export function logoNode(layout: Layout) {
  const logo = logoBox(layout)
  const unit = logo.w / 25.5 // px per viewBox unit
  return { x: logo.left + (28.4 - 11.5) * unit, y: logo.top + (7.6 - 3.2) * unit, r: 2.4 * unit }
}

export function EndCard({ copy, layout }: { copy: AdCopy; layout: Layout }) {
  const frame = useCurrentFrame()
  const { x, w, title, cta, url, finePrint } = layout.endCard
  const logo = logoBox(layout)
  const centered: CSSProperties = { position: 'absolute', left: x, width: w, textAlign: 'center' }
  // The L rises from the bottom. The clip stops 20% from the top, so the logo's own node never shows.
  const reveal = progress(frame, 712, 40)
  const pop = spring({ frame: Math.max(0, frame - CTA_AT), fps: FPS, config: { damping: 12 } })
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: logo.left,
          top: logo.top,
          width: logo.w,
          height: logo.h,
          lineHeight: 0,
          color: C.gold,
          clipPath: `inset(${100 - 80 * reveal}% 0 0 0)`
        }}
      >
        <LogoMark />
      </div>
      <div
        style={{
          ...centered,
          top: title.top,
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: title.size,
          letterSpacing: '0.025em',
          color: C.cream
        }}
      >
        <Words
          text="Link Into The SSI"
          start={742}
        />
      </div>
      <div style={{ ...centered, top: cta.top, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            opacity: Math.min(1, pop * 1.5),
            transform: `scale(${0.6 + 0.4 * pop})`,
            // 22, 52 and 14 px at the square's 34 px
            padding: `${(cta.size * 22) / 34}px ${(cta.size * 52) / 34}px`,
            borderRadius: 999,
            background: C.gold,
            color: C.onGold,
            fontFamily: SANS,
            fontSize: cta.size,
            fontWeight: 600
          }}
        >
          {copy.cta}
          <span style={{ marginLeft: (cta.size * 14) / 34 }}>→</span>
        </div>
      </div>
      <div
        style={{
          ...centered,
          top: url.top,
          fontFamily: SANS,
          fontSize: url.size,
          fontWeight: 500,
          color: C.goldText,
          ...enterStyle(frame, 772)
        }}
      >
        linkintothessi.com
      </div>
      <div
        style={{
          ...centered,
          top: finePrint.top,
          fontFamily: SANS,
          fontSize: finePrint.size,
          lineHeight: 1.45,
          color: C.muted,
          textWrap: 'balance',
          ...enterStyle(frame, 782)
        }}
      >
        {copy.finePrint}
      </div>
    </AbsoluteFill>
  )
}
```

In the square this gives the logo box 125 × 200 at left 477.5 and the node at (560.3, 211.6), the numbers `LOGO_NODE` held.

- [ ] **Step 4: Rewrite `YouNode.tsx` to build its path per layout**

Read `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\YouNode.tsx` first, then Write this over it. What changes: the path is built per layout from the home, the taps plus the stage origin and `logoNode(layout)`, and `nodeStops(layout)` exports its stops for Task 3's check. The timing (`at`, `dur`), the opacity, the radius steps, the presses, the tap rings and the node's look are the current file's; the same comparison rule as Step 2 applies.

```tsx
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C } from './brand'
import type { Layout } from './layouts'
import { progress, type Step, tapScale, track } from './motion'
import { TAPS } from './scenes/Demo'
import { LANDED, logoNode } from './scenes/EndCard'
import { BRIGHTEN, RINGS } from './scenes/Opening'

// The gold "you" node, one layer above every scene. It lights up in the Opening, taps through the Demo and flies
// into the logo's node on the end card.
const UI_TAPS = Object.values(TAPS)
export const FLIGHT = { at: LANDED - 50, dur: 50, arc: 160 } // scripts/soundtrack.mjs sizes the glide to `dur`

// Where the node's path stops, in frame coordinates. The taps are in the mock's stage coordinates (Demo.tsx), so each
// one moves by the layout's stage origin. layouts.ts checks every stop against the safe zone.
export function nodeStops(layout: Layout) {
  const { home, stage } = layout
  const node = logoNode(layout)
  return [
    // sinks as the Opening ends
    { at: 186, dur: 16, x: home.x, y: home.y + 70 },
    // jumps while hidden, next to the first tap
    { at: 330, dur: 1, x: stage.x + TAPS.comment.x + 90, y: stage.y + TAPS.comment.y + 60 },
    // arrives 6 frames before each tap
    ...UI_TAPS.map(tap => ({ at: tap.at - 24, dur: 18, x: stage.x + tap.x, y: stage.y + tap.y })),
    { at: FLIGHT.at, dur: FLIGHT.dur, x: node.x, y: node.y }
  ]
}
const OPACITY: Step[] = [
  { at: BRIGHTEN, dur: 18, to: 1 },
  { at: 186, dur: 16, to: 0 },
  { at: 332, dur: 16, to: 1 }
]
// The radius's last step, into the logo's node, depends on the layout (YouNode below).
const RADIUS: Step[] = [
  { at: BRIGHTEN, dur: 18, to: 18 },
  { at: 186, dur: 16, to: 8 },
  { at: 332, dur: 16, to: 18 }
]
const PRESSES = [...RINGS, ...UI_TAPS.map(tap => tap.at)]

export function YouNode({ layout }: { layout: Layout }) {
  const f = useCurrentFrame()
  const { home, stage } = layout
  const stops = nodeStops(layout)
  const pathX: Step[] = stops.map(stop => ({ at: stop.at, dur: stop.dur, to: stop.x }))
  const pathY: Step[] = stops.map(stop => ({ at: stop.at, dur: stop.dur, to: stop.y }))
  const x = track(f, home.x, pathX)
  const y = track(f, home.y, pathY) - FLIGHT.arc * Math.sin(Math.PI * progress(f, FLIGHT.at, FLIGHT.dur))
  // ends the size of the logo's node
  const r = track(f, 14, [...RADIUS, { at: FLIGHT.at, dur: FLIGHT.dur, to: logoNode(layout).r }])
  const glow = 1 - progress(f, LANDED, 20) // the halo goes once the node is part of the logo
  // The submit button is as gold as the node: on it the node gets a dark edge and its tap ring turns dark.
  const edge = progress(f, TAPS.submit.at - 24, 18) - progress(f, TAPS.paste.at - 24, 18)
  return (
    <AbsoluteFill>
      {UI_TAPS.map(tap => {
        const p = progress(f, tap.at, 16)
        if (p <= 0 || p >= 1) return null
        return (
          <div
            key={tap.at}
            style={{
              position: 'absolute',
              left: stage.x + tap.x - 60 * p,
              top: stage.y + tap.y - 60 * p,
              width: 120 * p,
              height: 120 * p,
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: `3px solid ${tap === TAPS.submit ? C.onGold : C.gold}`,
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
          opacity: track(f, 0.35, OPACITY),
          transform: `scale(${tapScale(f, PRESSES)})`,
          boxShadow: `0 0 0 ${3 * edge}px ${C.onGold}, 0 0 ${28 * glow}px ${8 * glow}px rgba(216, 169, 78, ${0.55 * glow})`
        }}
      />
    </AbsoluteFill>
  )
}
```
The `boxShadow` line is 123 characters; it is the current file's line, unchanged, and Prettier leaves template literals alone.

- [ ] **Step 5: Put the Demo's mock on a stage**

Five edits to `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Demo.tsx` (read it first).

(a) Edit the imports: old

```
import { C, COL, SANS, SERIF, TOTAL_FRAMES, XF } from '../brand'
import type { AdCopy, Post } from '../copy'
import { exitStyle, progress, rise, Words } from '../motion'
```

→ new

```
import { C, COL, SANS, SERIF, SIZE, TOTAL_FRAMES, XF } from '../brand'
import type { AdCopy, Post } from '../copy'
import type { Layout } from '../layouts'
import { exitStyle, progress, rise, Words } from '../motion'
```

(b) Edit the gray card's comment: old

```
// The third card, half below the fold: grey bars and no text, so the feed reads as a list that keeps going.
```

→ new

```
// The cards after the two posts, half below the fold or further (the layout sets how many): grey bars and no text,
// so the feed reads as a list that keeps going.
```

(c) Edit the caption's header and box: old

```
// A serif caption in the band above the mock (y 100–260), revealed word by word, gone XF frames after `out`.
function Caption({ text, at, out }: { text: string; at: number; out: number }) {
  const frame = useCurrentFrame()
  if (frame < at || frame >= out + XF) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: COL.x,
        width: COL.w,
        top: 100,
        height: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: SERIF,
        fontWeight: 600,
        fontSize: 64,
```

→ new

```
// A serif caption in the layout's caption box, revealed word by word, gone XF frames after `out`.
function Caption({ text, at, out, layout }: { text: string; at: number; out: number; layout: Layout }) {
  const frame = useCurrentFrame()
  if (frame < at || frame >= out + XF) return null
  const { box, size, align } = layout.caption
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        width: box.w,
        top: box.y,
        height: box.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        textAlign: align,
        fontFamily: SERIF,
        fontWeight: 600,
        fontSize: size,
```

(d) Edit the signature: old

```
export function Demo({ copy }: { copy: AdCopy }) {
```

→ new

```
export function Demo({ copy, layout }: { copy: AdCopy; layout: Layout }) {
```

(e) Edit the returned tree: old

```
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ opacity: 1 - 0.7 * dim, transform: `scale(${1 - 0.03 * dim})`, transformOrigin: '50% 40%' }}
      >
        <Card
          post={copy.posts[0]}
          link={copy.ui.viewOnLinkedIn}
          top={CARD.top}
          style={enter(0)}
        />
        {f >= T.boxOpen && (
          <CommentBox
            copy={copy}
            open={open}
          />
        )}
        <Card
          post={copy.posts[1]}
          link={copy.ui.viewOnLinkedIn}
          top={CARD.top + CARD.h + CARD.gap + push}
          style={enter(1)}
        />
        <Skeleton
          top={CARD.top + 2 * (CARD.h + CARD.gap) + push}
          style={enter(2)}
        />
      </AbsoluteFill>
      <LinkedInWindow copy={copy} />
      {/* Starts with the Demo's fade-in in Ad.tsx, so the cross-fade from the Opening never goes blank. */}
      <Caption
        text={copy.feedCaption}
        at={210 - XF}
        out={360}
      />
      <Caption
        text={copy.draftCaption}
        at={374}
        out={TAPS.submit.at}
      />
      <Caption
        text={copy.handoff[0]}
        at={539}
        out={628}
      />
      <Caption
        text={copy.handoff[1]}
        at={642}
        out={TOTAL_FRAMES}
      />
    </AbsoluteFill>
  )
```

→ new

```
  return (
    <AbsoluteFill>
      {/* The mock draws in the square's coordinates, on a 1080×1080 stage at the layout's origin. */}
      <div style={{ position: 'absolute', left: layout.stage.x, top: layout.stage.y, width: SIZE, height: SIZE }}>
        <AbsoluteFill
          style={{ opacity: 1 - 0.7 * dim, transform: `scale(${1 - 0.03 * dim})`, transformOrigin: '50% 40%' }}
        >
          <Card
            post={copy.posts[0]}
            link={copy.ui.viewOnLinkedIn}
            top={CARD.top}
            style={enter(0)}
          />
          {f >= T.boxOpen && (
            <CommentBox
              copy={copy}
              open={open}
            />
          )}
          <Card
            post={copy.posts[1]}
            link={copy.ui.viewOnLinkedIn}
            top={CARD.top + CARD.h + CARD.gap + push}
            style={enter(1)}
          />
          {Array.from({ length: layout.skeletons }, (_, i) => (
            <Skeleton
              key={i}
              top={CARD.top + (2 + i) * (CARD.h + CARD.gap) + push}
              style={enter(2)}
            />
          ))}
        </AbsoluteFill>
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
    </AbsoluteFill>
  )
```

Why the square can't change: the stage div sits at (0, 0) and is 1080×1080, the frame's own size; it has no z-index, opacity or transform, so it adds no stacking context, and the dim's `50% 40%` origin is the same point. The captions stay outside it, in frame coordinates. `COL` stays imported: the comment panel still uses it.

- [ ] **Step 6: Pass the layout from `Ad.tsx`**

Seven edits to `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Ad.tsx` (read it first).

Edit: old

```
import { COPY, type Lang } from './copy'
```

→ new

```
import { COPY, type Lang } from './copy'
import { type Format, LAYOUTS } from './layouts'
```

Edit: old

```
export type AdProps = { lang: Lang }
```

→ new

```
export type AdProps = { lang: Lang; format: Format }
```

Edit: old

```
export function Ad({ lang }: AdProps) {
  const frame = useCurrentFrame()
  const copy = COPY[lang]
```

→ new

```
export function Ad({ lang, format }: AdProps) {
  const frame = useCurrentFrame()
  const copy = COPY[lang]
  const layout = LAYOUTS[format]
```

Edit: old

```
          <Opening copy={copy} />
```

→ new

```
          <Opening
            copy={copy}
            layout={layout}
          />
```

Edit: old

```
          <Demo copy={copy} />
```

→ new

```
          <Demo
            copy={copy}
            layout={layout}
          />
```

Edit: old

```
          <EndCard copy={copy} />
```

→ new

```
          <EndCard
            copy={copy}
            layout={layout}
          />
```

Edit: old

```
        <YouNode />
```

→ new

```
        <YouNode layout={layout} />
```

`<Soundtrack />` stays where it is, outside the camera drift, with no props. The background's two radial gradients are placed in percentages, so they already fit any frame.

- [ ] **Step 7: Register one composition per language and format**

Read `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\Root.tsx` first, then Write this over it:

```tsx
import { Composition } from 'remotion'
import { Ad } from './Ad'
import { FPS, TOTAL_FRAMES } from './brand'
import { LANGS } from './copy'
import { FORMATS, LAYOUTS } from './layouts'

// One component, registered once per language and format (layouts.ts). The square keeps its ids, `ad-pt` and
// `ad-en`; the other formats add theirs, like `ad-pt-16x9` and `ad-en-9x16`.
const ADS = FORMATS.flatMap(format =>
  LANGS.map(lang => ({ id: format === '1x1' ? `ad-${lang}` : `ad-${lang}-${format}`, lang, format }))
)

export function Root() {
  return (
    <>
      {ADS.map(({ id, lang, format }) => (
        <Composition
          key={id}
          id={id}
          component={Ad}
          width={LAYOUTS[format].width}
          height={LAYOUTS[format].height}
          fps={FPS}
          durationInFrames={TOTAL_FRAMES}
          defaultProps={{ lang, format }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 8: Update the two comments in `brand.ts`**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\brand.ts`: old

```
export const SIZE = 1080
export const FPS = 30
```

→ new

```
// The square's side, and the side of the stage the mock draws on in every format (layouts.ts).
export const SIZE = 1080
export const FPS = 30
```

Edit: old

```
// The content column. 110px side margins keep text 90px from the edges even at the end of the 1.03 camera drift.
```

→ new

```
// The mock's column on its stage. In the square, 110px side margins keep text 90px from the edges even at the end of
// the 1.03 camera drift.
```

- [ ] **Step 9: Typecheck**

Run:
```bash
pnpm --filter video exec tsc --noEmit; echo "exit $?"
```
Expected: `exit 0`, with no other output. A type error here usually means a missed `layout` prop or a leftover `HOME` or `LOGO_NODE`.

- [ ] **Step 10: Lint and format check**

Run:
```bash
pnpm exec eslint video --max-warnings 0; echo "exit $?"
pnpm exec prettier --check video/src; echo "exit $?"
```
Expected: `exit 0`, then `All matched files use Prettier code style!` and `exit 0`. If Prettier flags a file, `pnpm exec prettier video/src/<file>` prints the formatted text without writing anything; copy the flagged lines from it with Edit.

- [ ] **Step 11: No stale names**

Run:
```bash
grep -rnE '\bHOME\b|LOGO_NODE|\bDOTS\b|\bTEXT\b' video/src; echo "exit $?"
```
Expected: no matches, then `exit 1`.

- [ ] **Step 12: Still two compositions**

Run (about 10 s):
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null; echo "exit $?"
```
Expected: a few blank lines, then `ad-pt ad-en`, then `exit 0`.

- [ ] **Step 13: The square is pixel-identical (GREEN)**

Run (about 2 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
mkdir -p video/out/formats-after && for l in pt en; do for f in 75 190 340 500 690 880; do pnpm --filter video exec remotion still src/index.ts ad-$l out/formats-after/ad-$l-$f.png --frame=$f > /dev/null 2>&1 || echo "still failed: ad-$l $f"; done; done; $PY "$SP/formats.py" square; echo "exit $?"
```
Expected:
```
PASS  square: 12 of 12 stills identical, changed: none, missing: 0
1/1 checks pass
exit 0
```
If a still differs, compare it with its before-still (open both with Read) and find the element that moved; the cause is a value in Steps 2–8 that isn't the square's. Don't move on until all 12 match.

- [ ] **Step 14: No commit.** Henriko commits.

---

### Task 3: The two new layouts and the safe-zone check

**Files:**
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts` (the formats, two entries, the imports and the check)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Demo.tsx` (`MOCK_TEXT`)
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\EndCard.tsx` (`FINE_PRINT_LINE`)
- Create (gitignored): `video/out/check.log`

**Interfaces:**
- Consumes: Task 2's `Layout`, `LAYOUTS`, `nodeStops(layout)` (which uses `logoNode(layout)`), and `TAPS`, `CARD`, `LEFT` and `RIGHT` inside `Demo.tsx`.
- Produces:
  - `FORMATS = ['1x1', '16x9', '9x16']`, so `Root.tsx` registers `ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16`, in that order.
  - `MOCK_TEXT = { x: 140, y: 270, w: 800, h: 702 }` (`Demo.tsx`), the mock's text area in stage coordinates.
  - `FINE_PRINT_LINE = 1.45` (`EndCard.tsx`), the fine print's line height.
  - The check at load and its message: `<format>: <element> (x <a>–<b>, y <c>–<d>) is outside the safe zone (x <a>–<b>, y <c>–<d>)`, where the element is `opening text`, `caption`, `end card`, `mock text`, `node home` or `node stop at frame <n>`, and a point prints as `x <a>, y <c>`.

- [ ] **Step 1: Add the 16:9 and 9:16 layouts, with one caption out of its zone on purpose**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old

```
// Each composition is one language in one format (Root.tsx).
export const FORMATS = ['1x1'] as const
```

→ new

```
// The ad's three shapes: the square for the LinkedIn feed, 16:9 for YouTube in-stream ads, and 9:16 for Shorts, Reels,
// Stories and TikTok. Each composition is one language in one format (Root.tsx).
export const FORMATS = ['1x1', '16x9', '9x16'] as const
```

Edit: old

```
      finePrint: { top: 740, size: 28, lines: 3 }
    }
  }
}
```

→ new (the 9:16 caption's `y: 200` is deliberately outside its zone; Step 6 restores the real 330)

```
      finePrint: { top: 740, size: 28, lines: 3 }
    }
  },
  // 16:9 for YouTube in-stream ads. The bottom 20% stays clear for the "Ad" label and Skip; the mock sits on the
  // right, raised because no caption sits above it, and the captions take the left column.
  '16x9': {
    width: 1920,
    height: 1080,
    zone: { x: 140, y: 90, w: 1640, h: 770 },
    stage: { x: 790, y: -160 },
    home: { x: 960, y: 250 },
    opening: { box: { x: 320, y: 440, w: 1280, h: 420 }, hook: 96, promise: 112, dots: 82 },
    caption: { box: { x: 160, y: 110, w: 680, h: 690 }, size: 80, align: 'left' },
    skeletons: 1,
    endCard: {
      x: 260,
      w: 1400,
      logo: { top: 120, h: 220 },
      title: { top: 370, size: 72 },
      cta: { top: 490, size: 40 },
      url: { top: 630, size: 36 },
      finePrint: { top: 720, size: 36, lines: 2 }
    }
  },
  // 9:16 for YouTube Shorts, Instagram Reels and Stories, and TikTok: the square moved down 230 px, with an 820 px
  // text column away from the side icons. Meta keeps the top 14% and the bottom 35%; the sides come from TikTok.
  '9x16': {
    width: 1080,
    height: 1920,
    zone: { x: 120, y: 270, w: 840, h: 978 },
    stage: { x: 0, y: 230 },
    home: { x: 540, y: 480 },
    opening: { box: { x: 130, y: 680, w: 820, h: 450 }, hook: 88, promise: 96, dots: 70 },
    caption: { box: { x: 130, y: 200, w: 820, h: 160 }, size: 64, align: 'center' },
    skeletons: 2,
    endCard: {
      x: 130,
      w: 820,
      logo: { top: 420, h: 200 },
      title: { top: 650, size: 60 },
      cta: { top: 758, size: 34 },
      url: { top: 890, size: 30 },
      finePrint: { top: 970, size: 28, lines: 3 }
    }
  }
}
```

Every other number is spec §3's: the zone, the stage origin, the home, the Opening's box and sizes, the dots, the caption's box, size and alignment, the gray cards and the end card's column and texts.

- [ ] **Step 2: Nothing catches the bad caption yet (RED)**

Run (about 10 s):
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null; echo "exit $?"
```
Expected: a few blank lines, then `ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16`, then `exit 0`. The 9:16's caption sits 70 px into the platforms' top band, and nothing says so: that's the gap the check closes.

- [ ] **Step 3: Name the mock's text area and the fine print's line height**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\Demo.tsx`: old

```
  posted: TAPS.post.at + 4
}
```

→ new

```
  posted: TAPS.post.at + 4
}

// The mock's text area on its stage: both post cards, before the comment box pushes the second one down. layouts.ts
// checks it against each format's safe zone.
export const MOCK_TEXT = { x: LEFT, y: CARD.top, w: RIGHT - LEFT, h: 2 * CARD.h + CARD.gap }
```

(`LEFT`, `RIGHT` and `CARD` are defined at the top of `Demo.tsx`; this evaluates to `{ x: 140, y: 270, w: 800, h: 702 }`, spec §0 detail 8.)

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\scenes\EndCard.tsx`: old

```
export const CTA_AT = 758 // the CTA pill pops in
```

→ new

```
export const CTA_AT = 758 // the CTA pill pops in
export const FINE_PRINT_LINE = 1.45 // the fine print's line height (layouts.ts sizes the end card's block with it)
```

Edit (same file): old

```
          lineHeight: 1.45,
```

→ new

```
          lineHeight: FINE_PRINT_LINE,
```

- [ ] **Step 4: Add the check to `layouts.ts`**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old

```
import { SIZE } from './brand'
```

→ new

```
import { SIZE } from './brand'
import { MOCK_TEXT } from './scenes/Demo'
import { FINE_PRINT_LINE } from './scenes/EndCard'
import { nodeStops } from './YouNode'
```

Edit (same file): old

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
  }
}

// The safe-zone check, at load like copy.ts's two-sentence check: every text box, the mock's text area, the node's
// home and every stop on its path must sit inside the format's zone, or the Studio and every render stop here. It
// leaves out the camera drift, the text inside each box, the flight's arc and the gray cards.
const inside = (box: Box, zone: Box) =>
  box.x >= zone.x && box.y >= zone.y && box.x + box.w <= zone.x + zone.w && box.y + box.h <= zone.y + zone.h
function span(from: number, size: number) {
  const start = Math.round(from)
  return size === 0 ? `${start}` : `${start}–${Math.round(from + size)}`
}
const describe = (box: Box) => `x ${span(box.x, box.w)}, y ${span(box.y, box.h)}`
const point = ({ x, y }: Point): Box => ({ x, y, w: 0, h: 0 })
for (const format of FORMATS) {
  const layout = LAYOUTS[format]
  const { zone, stage, opening, caption, endCard } = layout
  const { logo, finePrint } = endCard
  const endCardBottom = finePrint.top + finePrint.lines * finePrint.size * FINE_PRINT_LINE
  const items: [string, Box][] = [
    ['opening text', opening.box],
    ['caption', caption.box],
    ['end card', { x: endCard.x, y: logo.top, w: endCard.w, h: endCardBottom - logo.top }],
    ['mock text', { ...MOCK_TEXT, x: stage.x + MOCK_TEXT.x, y: stage.y + MOCK_TEXT.y }],
    ['node home', point(layout.home)],
    ...nodeStops(layout).map((stop): [string, Box] => [`node stop at frame ${stop.at}`, point(stop)])
  ]
  for (const [name, box] of items) {
    if (!inside(box, zone)) {
      throw new Error(`${format}: ${name} (${describe(box)}) is outside the safe zone (${describe(zone)})`)
    }
  }
}
```

No import cycle at run time: `Demo.tsx`, `EndCard.tsx`, `YouNode.tsx` and `Opening.tsx` import only `type Layout` from `layouts.ts` (Task 2), which TypeScript erases. With the real layouts, the end card's block ends at y 861.8 (1:1), 824.4 (16:9) and 1091.8 (9:16), and the mock's text area lands at x 930–1730, y 110–812 in the 16:9 and x 140–940, y 500–1202 in the 9:16, all inside their zones.

- [ ] **Step 5: The check names the bad caption**

Run (about 10 s):
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet > video/out/check.log 2>&1; echo "exit $?"; grep -a -o '[0-9]*x[0-9]*: [a-z0-9 ]* ([^)]*) is outside the safe zone ([^)]*)' video/out/check.log | sort -u
```
Expected:
```
exit 1
9x16: caption (x 130–950, y 200–360) is outside the safe zone (x 120–960, y 270–1248)
```

- [ ] **Step 6: Restore the caption (GREEN)**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old

```
    caption: { box: { x: 130, y: 200, w: 820, h: 160 }, size: 64, align: 'center' },
```

→ new

```
    caption: { box: { x: 130, y: 330, w: 820, h: 160 }, size: 64, align: 'center' },
```

Run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null; echo "exit $?"
```
Expected: `ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16`, then `exit 0`.

- [ ] **Step 7: The check's other two kinds of item**

Probe B, the end card. Edit `layouts.ts`: old `      finePrint: { top: 970, size: 28, lines: 3 }` → new `      finePrint: { top: 970, size: 28, lines: 8 }`. Run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet > video/out/check.log 2>&1; echo "exit $?"; grep -a -o '[0-9]*x[0-9]*: [a-z0-9 ]* ([^)]*) is outside the safe zone ([^)]*)' video/out/check.log | sort -u
```
Expected:
```
exit 1
9x16: end card (x 130–950, y 420–1295) is outside the safe zone (x 120–960, y 270–1248)
```
Revert: old `      finePrint: { top: 970, size: 28, lines: 8 }` → new `      finePrint: { top: 970, size: 28, lines: 3 }`.

Probe C, a point. Edit `layouts.ts`: old `    home: { x: 960, y: 250 },` → new `    home: { x: 960, y: 60 },`. Run the same command.
Expected:
```
exit 1
16x9: node home (x 960, y 60) is outside the safe zone (x 140–1780, y 90–860)
```
Revert: old `    home: { x: 960, y: 60 },` → new `    home: { x: 960, y: 250 },`.

Then run:
```bash
pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null; echo "exit $?"
```
Expected: the six ids and `exit 0`.

- [ ] **Step 8: Typecheck, lint and format check**

Run:
```bash
pnpm --filter video exec tsc --noEmit; echo "exit $?"
pnpm exec eslint video --max-warnings 0; echo "exit $?"
pnpm exec prettier --check video/src; echo "exit $?"
```
Expected: `exit 0` three times, and Prettier's `All matched files use Prettier code style!`.

- [ ] **Step 9: No commit.** Henriko commits.

---

### Task 4: `render.mjs`, rendering all six or the ids given

**Files:**
- Create: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\scripts\render.mjs`
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\package.json` (the `render` script)
- Create (gitignored): `video/out/ad-pt-9x16.mp4` and logs

**Interfaces:**
- Consumes: the six ids `remotion compositions src/index.ts --quiet` prints (Task 3) and the check at load (Task 3).
- Produces: `pnpm render:video [ids…]` (root) → `pnpm --filter video render` → `pnpm run audio && node scripts/render.mjs [ids…]`, writing `video/out/<id>.mp4`.

- [ ] **Step 1: Point the `render` script at `render.mjs`**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\package.json`: old

```
    "render": "pnpm run audio && remotion render src/index.ts ad-pt out/ad-pt.mp4 --crf=18 --jpeg-quality=100 --enforce-audio-track && remotion render src/index.ts ad-en out/ad-en.mp4 --crf=18 --jpeg-quality=100 --enforce-audio-track"
```

→ new

```
    "render": "pnpm run audio && node scripts/render.mjs"
```

It's the last script, so neither line ends in a comma.

- [ ] **Step 2: The script doesn't exist yet (RED), and pnpm passes the id on**

Run:
```bash
pnpm render:video ad-bogus > video/out/render-bogus.log 2>&1; echo "exit $?"; grep -a -E '^\$ pnpm run audio|^soundtrack:|Cannot find module' video/out/render-bogus.log
```
Expected:
```
exit 1
$ pnpm run audio && node scripts/render.mjs ad-bogus
soundtrack: 15 WAVs in D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\public\audio (… s)
Error: Cannot find module 'D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\scripts\render.mjs'
```
pnpm may quote the id in its echo (`"ad-bogus"`); either way the echoed line ends with it. That's the proof spec §4.3 asks for: `pnpm render:video <id>` reaches `render.mjs` as an argument.

- [ ] **Step 3: Write `render.mjs`**

Write `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\scripts\render.mjs`:

```js
// Renders the ad to video/out/<id>.mp4: every composition Root.tsx registers, or only the ids given. `pnpm render`
// runs it after the audio.
//
//   pnpm render:video                          all six, one after another
//   pnpm render:video ad-pt-9x16 ad-en-9x16    only these; an unknown id stops it before any render

import { execSync } from 'node:child_process'
import { join } from 'node:path'

const cwd = join(import.meta.dirname, '..')
// Remotion bundles src/ to list the compositions (~10 s), so Root.tsx stays the only list of ids. Loading the bundle
// also runs the safe-zone check in layouts.ts, so a bad layout stops here too.
const listed = execSync('remotion compositions src/index.ts --quiet', { cwd, encoding: 'utf8' })
const known = listed.split(/\s+/).filter(Boolean)
if (known.length === 0) throw new Error('remotion compositions listed no ids')
const asked = process.argv.slice(2)
const unknown = asked.filter(id => !known.includes(id))
if (unknown.length > 0) throw new Error(`Unknown id: ${unknown.join(', ')}. The compositions are ${known.join(', ')}.`)
const FLAGS = '--crf=18 --jpeg-quality=100 --enforce-audio-track'
for (const id of asked.length > 0 ? asked : known) {
  execSync(`remotion render src/index.ts ${id} out/${id}.mp4 ${FLAGS}`, { cwd, stdio: 'inherit' })
}
```

The pnpm script puts `video/node_modules/.bin` on the PATH, so `remotion` resolves in both `execSync` calls as it did in the old script. The listing call pipes stdout (the ids) and lets Remotion's errors through on stderr.

- [ ] **Step 4: An unknown id stops before any render**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
stat -c '%n %Y' video/out/*.mp4 > "$SP/mp4-before.txt"; cat "$SP/mp4-before.txt"
pnpm render:video ad-bogus > video/out/render-bogus.log 2>&1; echo "exit $?"; grep -a '^Error: Unknown id' video/out/render-bogus.log; stat -c '%n %Y' video/out/*.mp4 | diff "$SP/mp4-before.txt" - && echo "no MP4 touched"
```
Expected:
```
video/out/ad-en.mp4 <mtime>
video/out/ad-pt.mp4 <mtime>
exit 1
Error: Unknown id: ad-bogus. The compositions are ad-pt, ad-en, ad-pt-16x9, ad-en-16x9, ad-pt-9x16, ad-en-9x16.
no MP4 touched
```

- [ ] **Step 5: A bad layout stops the render too**

Edit `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`: old

```
    caption: { box: { x: 130, y: 330, w: 820, h: 160 }, size: 64, align: 'center' },
```

→ new

```
    caption: { box: { x: 130, y: 200, w: 820, h: 160 }, size: 64, align: 'center' },
```

Run:
```bash
pnpm render:video ad-pt-9x16 > video/out/render-bad.log 2>&1; echo "exit $?"; grep -a -o '[0-9]*x[0-9]*: [a-z0-9 ]* ([^)]*) is outside the safe zone ([^)]*)' video/out/render-bad.log | sort -u; ls video/out/ad-pt-9x16.mp4
```
Expected:
```
exit 1
9x16: caption (x 130–950, y 200–360) is outside the safe zone (x 120–960, y 270–1248)
ls: cannot access 'video/out/ad-pt-9x16.mp4': No such file or directory
```

Revert: old `    caption: { box: { x: 130, y: 200, w: 820, h: 160 }, size: 64, align: 'center' },` → new `    caption: { box: { x: 130, y: 330, w: 820, h: 160 }, size: 64, align: 'center' },`.

- [ ] **Step 6: One id renders only that file**

Run (about 2 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
pnpm render:video ad-pt-9x16 > video/out/render-one.log 2>&1; echo "exit $?"; stat -c '%n %Y' video/out/*.mp4 | diff "$SP/mp4-before.txt" -
pnpm --filter video exec remotion ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,sample_rate,channels,r_frame_rate,duration -of compact out/ad-pt-9x16.mp4 2>/dev/null
```
Expected (ffprobe prints a few blank lines first, and its fields in its own order):
```
exit 0
1a2
> video/out/ad-pt-9x16.mp4 <mtime>
stream|codec_name=h264|codec_type=video|width=1080|height=1920|r_frame_rate=30/1|duration=30.000000|
stream|codec_name=aac|codec_type=audio|sample_rate=48000|channels=2|r_frame_rate=0/0|duration=30.058667
```
The square's two MP4s keep their times; only the new file appears. (AAC pads to whole 1024-sample frames, hence 30.058667 s; the square's MP4s read the same.)

- [ ] **Step 7: Lint and format check**

Run:
```bash
pnpm exec eslint video --max-warnings 0; echo "exit $?"
pnpm exec prettier --check video/scripts/render.mjs video/package.json video/src; echo "exit $?"
```
Expected: `exit 0` twice, and `All matched files use Prettier code style!`.

- [ ] **Step 8: No commit.** Henriko commits.

---

### Task 5: Overlay stills and Henriko's approval (gate)

**Files:**
- Create (gitignored): `video/out/formats-stills/` (28 stills), `video/out/formats-sheets/` (4 contact sheets)
- Modify only on Henriko's request: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\src\layouts.ts`, the spec's §3, and `LAYOUT`/`WRAPS` in `$SP/formats.py`

**Interfaces:**
- Consumes: the six compositions (Task 3); `formats.py lines` and `sheets` (Task 1).
- Produces: `video/out/formats-stills/<id>-<frame>.png` for the four new ids at frames 75, 190, 340, 500, 600, 690 and 880; `video/out/formats-sheets/<id>.png`; Henriko's explicit approval, which Task 6 needs.

- [ ] **Step 1: Render the 16:9 stills**

Run (about 3 minutes; give the Bash call a 10-minute timeout):
```bash
mkdir -p video/out/formats-stills && for id in ad-pt-16x9 ad-en-16x9; do for f in 75 190 340 500 600 690 880; do pnpm --filter video exec remotion still src/index.ts $id out/formats-stills/$id-$f.png --frame=$f > /dev/null 2>&1 || echo "still failed: $id $f"; done; done; ls video/out/formats-stills | wc -l
```
Expected: `14`, and no `still failed` line.

- [ ] **Step 2: Render the 9:16 stills**

Run (about 3 minutes; give the Bash call a 10-minute timeout):
```bash
for id in ad-pt-9x16 ad-en-9x16; do for f in 75 190 340 500 600 690 880; do pnpm --filter video exec remotion still src/index.ts $id out/formats-stills/$id-$f.png --frame=$f > /dev/null 2>&1 || echo "still failed: $id $f"; done; done; ls video/out/formats-stills | wc -l
```
Expected: `28`, and no `still failed` line.

- [ ] **Step 3: Every text wraps as spec §3 says**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/formats.py" lines; echo "exit $?"
```
Expected:
```
PASS  lines, ad-pt: 75=3, 190=3, 340=2, 500=2, 690=1, 880=3
PASS  lines, ad-en: 75=2, 190=4, 340=2, 500=2, 690=1, 880=2
PASS  lines, ad-pt-16x9: 75=2, 190=2, 340=2, 500=3, 600=3, 690=1, 880=2
PASS  lines, ad-en-16x9: 75=2, 190=2, 340=2, 500=2, 600=3, 690=2, 880=2
PASS  lines, ad-pt-9x16: 75=3, 190=3, 340=2, 500=2, 600=2, 690=1, 880=3
PASS  lines, ad-en-9x16: 75=2, 190=4, 340=2, 500=2, 600=2, 690=1, 880=2
6/6 checks pass
exit 0
```
The EN 9:16's `880` may read `3` instead of `2`; both pass (deviation 3). If another count differs, open that still with Read before anything else: if the text runs past the box `formats.py` measures (`LAYOUT` in the script), the counter is clipping, not the layout. If the count is real, don't change a layout on your own: show Henriko the still in Step 6 and name the text, the frame and both counts.

- [ ] **Step 4: Draw the contact sheets**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/formats.py" sheets; echo "exit $?"
```
Expected:
```
PASS  sheets, ad-pt-16x9: video/out/formats-sheets/ad-pt-16x9.png
PASS  sheets, ad-en-16x9: video/out/formats-sheets/ad-en-16x9.png
PASS  sheets, ad-pt-9x16: video/out/formats-sheets/ad-pt-9x16.png
PASS  sheets, ad-en-9x16: video/out/formats-sheets/ad-en-9x16.png
4/4 checks pass
exit 0
```

- [ ] **Step 5: Look at the sheets yourself first**

Open the four sheets with Read (`D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\out\formats-sheets\<id>.png`). Check, frame by frame:
- every text and every tap sits inside the green zone;
- nothing is cut off, overlaps another element, or is missing (compare with the square's frame at the same moment);
- the 9:16's second gray card shows below the first one from frame 250 on;
- what the stricter readings catch matches spec §3.3's list, and nothing else: TikTok's rail (magenta) over the right ends of the 9:16's second card, comment box and LinkedIn reply; Meta's corner (blue) over Submit's bottom edge and the second card's footer; Shorts' top (red) over the first line of a two-line caption; YouTube's center 80% and top 70% (blue) over the 16:9's caption and mock edges, the comment box's bottom, the promise's second line and the fine print.

If something else is wrong, stop and tell Henriko before asking for approval.

- [ ] **Step 6: Henriko approves the overlay stills**

Send the four sheets with SendUserFile (status `normal`, display `render`): `video/out/formats-sheets/ad-pt-16x9.png`, `ad-en-16x9.png`, `ad-pt-9x16.png` and `ad-en-9x16.png`, with the caption "Folhas de contato: 16:9 e 9:16, PT e EN, frames 75, 190, 340, 500, 600, 690 e 880, com a zona segura (verde) e as leituras das plataformas por cima."

Then ask, in pt-BR:

> As 4 folhas mostram os dois formatos novos nos dois idiomas, com a zona segura em verde e cada leitura das plataformas por cima (legenda no topo de cada folha). Todo texto e todo toque ficam dentro do verde. O que as leituras mais rígidas ainda pegam é o que o spec §3.3 lista: no 9:16, o trilho do TikTok (magenta) sobre a ponta direita do segundo card, da caixa de comentário e da resposta, e o canto da Meta (azul) sobre a borda de baixo do Submit; no 16:9, o "centro 80%, topo 70%" do YouTube (azul) sobre as bordas da legenda e do mock, o fim da caixa de comentário, a segunda linha da promessa e o texto miúdo. Nenhum ponto de toque cai em nenhuma delas.
>
> Aprova esses layouts para o render final? Se quiser mudar algo, diga o formato, o frame e o que mudar.

**Wait for an explicit yes.** Don't start Task 6 without it.

- [ ] **Step 7: Only on Henriko's request, adjust and re-check**

For each change he asks for: edit the number in `layouts.ts` with Edit; make the same change in the spec's §3 tables (and §3.1/§3.2 prose if it names the number); update `LAYOUT` and, if a wrap changes, `WRAPS` in `$SP/formats.py`. Then run `pnpm --filter video exec remotion compositions src/index.ts --quiet 2>/dev/null` (the check must still pass), re-render only the stills of the changed format (`rm -f video/out/formats-stills/ad-*-16x9-*.png`, then Step 1, for the 16:9; `rm -f video/out/formats-stills/ad-*-9x16-*.png`, then Step 2, for the 9:16; the count reads 28 either way), re-run Steps 3–6, and wait for a new yes. Task 7 must then use the final numbers.

- [ ] **Step 8: No commit.** Henriko commits.

---

### Task 6: The final render and the checks on the MP4s

**Files:**
- Create (gitignored): `video/out/ad-pt.mp4`, `ad-en.mp4`, `ad-pt-16x9.mp4`, `ad-en-16x9.mp4`, `ad-pt-9x16.mp4`, `ad-en-9x16.mp4`, `video/out/formats-audio/<id>.wav` (6), `video/out/formats-after/` (12), logs

**Interfaces:**
- Consumes: Henriko's yes (Task 5); `pnpm render:video` (Task 4); `formats.py blank`, `audio` and `square` (Task 1), with Task 1's `before.wav` and `formats-before/`.
- Produces: the six final MP4s; the measured render time for the docs (Task 7).

- [ ] **Step 1: Render all six**

Run in the background (about 8 minutes), and read the result when it finishes:
```bash
start=$(date +%s); pnpm render:video > video/out/render.log 2>&1; echo "exit $? in $(( $(date +%s) - start )) s"
```
Expected: `exit 0 in <about 480> s`. Note the seconds: Task 7's docs round them to minutes.

- [ ] **Step 2: The new files are what the platforms need**

Run:
```bash
for id in ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16; do echo "$id"; pnpm --filter video exec remotion ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,sample_rate,channels,r_frame_rate,duration -of compact out/$id.mp4 2>/dev/null | grep -a stream; done
```
Expected, for each 16:9 id:
```
stream|codec_name=h264|codec_type=video|width=1920|height=1080|r_frame_rate=30/1|duration=30.000000|
stream|codec_name=aac|codec_type=audio|sample_rate=48000|channels=2|r_frame_rate=0/0|duration=30.058667
```
and for each 9:16 id:
```
stream|codec_name=h264|codec_type=video|width=1080|height=1920|r_frame_rate=30/1|duration=30.000000|
stream|codec_name=aac|codec_type=audio|sample_rate=48000|channels=2|r_frame_rate=0/0|duration=30.058667
```

- [ ] **Step 3: No new dark beats**

Run (about a minute):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY "$SP/formats.py" blank; echo "exit $?"
```
Expected: six `PASS` lines, `6/6 checks pass` and `exit 0`. The square's two read `dark runs of 3+: 0-5, 86-90`; the new ones read the same runs or shorter ones inside them. A `FAIL` names the run's frames: open a still of its first frame (`remotion still … --frame=<n>`) to see what went dark.

- [ ] **Step 4: The sound is the same in all six**

Run (about 4 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
for id in ad-pt ad-en ad-pt-16x9 ad-en-16x9 ad-pt-9x16 ad-en-9x16; do pnpm --filter video exec remotion render src/index.ts $id out/formats-audio/$id.wav --codec=wav --enforce-audio-track > /dev/null 2>&1 || echo "render failed: $id"; done; $PY "$SP/formats.py" audio; echo "exit $?"
```
Expected:
```
PASS  audio: 6 of 6 renders byte-identical to before.wav, differ: none, missing: none
1/1 checks pass
exit 0
```
`before.wav` is Task 1's render of the square before any code change; this overwrites Task 1's `ad-en.wav` with the new code's.

- [ ] **Step 5: The square is still pixel-identical**

Run (about 2 minutes; give the Bash call a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
rm -rf video/out/formats-after && mkdir -p video/out/formats-after && for l in pt en; do for f in 75 190 340 500 690 880; do pnpm --filter video exec remotion still src/index.ts ad-$l out/formats-after/ad-$l-$f.png --frame=$f > /dev/null 2>&1 || echo "still failed: ad-$l $f"; done; done; $PY "$SP/formats.py" square; echo "exit $?"
```
Expected:
```
PASS  square: 12 of 12 stills identical, changed: none, missing: 0
1/1 checks pass
exit 0
```

- [ ] **Step 6: Gates**

Run (give the Bash call a 10-minute timeout):
```bash
pnpm typecheck > video/out/typecheck.log 2>&1; echo "exit $?"
pnpm lint > video/out/lint.log 2>&1; echo "exit $?"
pnpm format:check > video/out/format.log 2>&1; echo "exit $?"; tail -1 video/out/format.log
pnpm -r test > video/out/test.log 2>&1; echo "exit $?"; grep -aE 'Tests +[0-9]+' video/out/test.log
```
Expected: `exit 0` four times, `All matched files use Prettier code style!`, and the counts 75, 789 and 700 as in Task 1 Step 1.

- [ ] **Step 7: No commit.** Henriko commits.

---

### Task 7: Docs and memory

**Files:**
- Modify: `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\docs\PLATFORM.md` (§3, §4, §15A, §18 and a Last-updated entry)
- Modify (outside the repo): `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\promo-video.md` and `MEMORY.md`

**Interfaces:**
- Consumes: the final numbers (Task 5 may have changed some; the texts below use spec §3's) and Task 6 Step 1's render time.
- Produces: the docs Henriko commits with the code.

Anchor every edit on its text, never on line numbers: other sessions edit this file too. Prose wraps at 120 columns; tables are aligned by display width.

- [ ] **Step 1: Snapshot the doc**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
cp docs/PLATFORM.md "$SP/PLATFORM.before.md"; wc -l "$SP/PLATFORM.before.md"
```
Expected: the line count, about 8,300. Step 11's width check compares against this copy.

- [ ] **Step 2: §15A's opening**

Edit `docs/PLATFORM.md`: old

```
A 30-second, square (1080×1080) ad for the LinkedIn feed, in pt-BR and US English, with music and sound effects
composed in code. It works muted too, since LinkedIn autoplays without sound. The same files fit the Instagram and
Facebook feeds. [Remotion](https://www.remotion.dev) `4.0.529` draws it with React and renders it locally; nothing in
`video/` is deployed, and the MP4s are uploaded to LinkedIn Campaign Manager by hand. Design and storyboard:
[`docs/superpowers/specs/2026-09-26-promo-video-design.md`](superpowers/specs/2026-09-26-promo-video-design.md). Sound:
[`docs/superpowers/specs/2026-09-26-promo-audio-design.md`](superpowers/specs/2026-09-26-promo-audio-design.md).
```

→ new

```
A 30-second ad in pt-BR and US English, with music and sound effects composed in code, in three formats: square
(1080×1080) for the LinkedIn feed, 16:9 (1920×1080) for YouTube in-stream ads, and 9:16 (1080×1920) for YouTube
Shorts, Instagram Reels, Stories and TikTok ("Formats" below). It works muted too, since LinkedIn autoplays without
sound. The square also fits the Instagram and Facebook feeds. [Remotion](https://www.remotion.dev) `4.0.529` draws it
with React and renders it locally; nothing in `video/` is deployed, and the MP4s are uploaded to each platform's ad
manager by hand. Design and storyboard:
[`docs/superpowers/specs/2026-09-26-promo-video-design.md`](superpowers/specs/2026-09-26-promo-video-design.md). Sound:
[`docs/superpowers/specs/2026-09-26-promo-audio-design.md`](superpowers/specs/2026-09-26-promo-audio-design.md).
```

- [ ] **Step 3: "How it is built"**

Edit: old

```
- **One component, two compositions.** `Root.tsx` registers `Ad` as `ad-pt` and `ad-en` (1080×1080, 30 fps, 900
  frames); the language is the only prop. `COPY` is typed `Record<Lang, AdCopy>`, so a missing string fails `tsc`.
```

→ new

```
- **One component, six compositions.** `Root.tsx` registers `Ad` once per language and format ("Formats" below):
  `ad-pt` and `ad-en` (1080×1080), `ad-pt-16x9` and `ad-en-16x9` (1920×1080), and `ad-pt-9x16` and `ad-en-9x16`
  (1080×1920), all at 30 fps and 900 frames. The language and the format are the only props. `COPY` is typed
  `Record<Lang, AdCopy>`, so a missing string fails `tsc`.
```

Edit: old

```
- **The gold node** (`YouNode.tsx`) is one layer above every scene. It lights the constellation, taps through the mock
  at `TAPS` and flies into `LOGO_NODE`. On the gold submit button it gets a dark edge and a dark tap ring, so that tap
  stays visible. The end card reveals only the L of `landing/components/LogoMark.tsx` (imported unchanged), so the
  node that lands is the logo's node.
```

→ new

```
- **The gold node** (`YouNode.tsx`) is one layer above every scene. It lights the constellation, taps through the mock
  at `TAPS` (plus the stage origin) and flies into the logo's node (`logoNode(layout)` in `EndCard.tsx`). On the gold
  submit button it gets a dark edge and a dark tap ring, so that tap stays visible. The end card reveals only the L of
  `landing/components/LogoMark.tsx` (imported unchanged), so the node that lands is the logo's node.
```

Edit: old

```
- **Fixed layout.** Every box in the mock has a fixed size, so the taps land on the same pixels in both languages. A
  longer label ellipsizes, as it does in the app, instead of moving a button.
```

→ new

```
- **Fixed layout.** Every box in the mock has a fixed size, so the taps land on the same pixels in both languages and
  on the same stage pixels in every format. A longer label ellipsizes, as it does in the app, instead of moving a
  button.
```

- [ ] **Step 4: The new "Formats" subsection**

Edit: old

```
  which answered with an HTML page instead of the font.

### Sound
```

→ new

```
  which answered with an HTML page instead of the font.

### Formats

Each composition is one language in one format. `video/src/layouts.ts` holds a `Layout` per format: the frame, the
safe zone, the mock's stage origin, the node's home, the boxes and font sizes of the Opening, the captions and the end
card, and the number of dots and gray cards. The `1x1` entry holds the square's original numbers, and the square
renders pixel for pixel as before. Design, the numbers and the platform readings behind each zone:
[`docs/superpowers/specs/2026-09-28-promo-formats-design.md`](superpowers/specs/2026-09-28-promo-formats-design.md).

| Format | Frame       | For                                                        | Safe zone (text and taps) |
|--------|-------------|------------------------------------------------------------|---------------------------|
| `1x1`  | 1080 × 1080 | LinkedIn feed (also fits the Instagram and Facebook feeds) | x 90–990, y 90–990        |
| `16x9` | 1920 × 1080 | YouTube in-stream ads                                      | x 140–1780, y 90–860      |
| `9x16` | 1080 × 1920 | YouTube Shorts, Instagram Reels and Stories, TikTok        | x 120–960, y 270–1248     |

- **The stage.** The app mock draws in the square's 1080×1080 coordinates, on a stage placed at the format's origin:
  (0, 0) in the square, (790, −160) in the 16:9 (on the right, raised) and (0, 230) in the 9:16. The taps keep their
  stage coordinates and the node adds the origin, so the taps, the node's path and every sound are the same in all
  six compositions.
- **Text per format.** The 9:16 keeps the square's font sizes in an 820 px column (x 130–950), away from the side
  icons. The 16:9 puts the captions beside the mock, left-aligned at 80 px instead of 64, and uses bigger sizes in the
  Opening and on the end card, since a phone held upright shrinks its 1920 px width more than the square's.
- **Dots.** The same seeded draw over the whole frame, kept within 960 px of the node so the first ring lights each
  one fully: 40 in the square (the same dots as before), 82 in the 16:9 and 70 in the 9:16. The far corners stay
  dark, near where the platforms draw their own buttons.
- **The safe-zone check.** When `layouts.ts` loads, it checks that every text box, the mock's text area, the node's
  home and every stop on its path (`nodeStops(layout)` in `YouNode.tsx`) sit inside the format's safe zone. A failure
  throws with the format and the element, such as
  `9x16: caption (x 130–950, y 200–360) is outside the safe zone (x 120–960, y 270–1248)`, and stops the Studio,
  `remotion compositions` and every render before a frame is drawn. It leaves out the camera drift, the text inside
  each box (the stills show the wraps), the flight's arc and the gray cards.
- **What the zones don't clear.** The strictest third-party readings reach into the layouts: TikTok's icon rail over
  the right ends of the 9:16's second card, comment box and LinkedIn reply; Meta's bottom-right corner over Submit's
  bottom edge and the second card's footer; Shorts' 380 px top over the first line of a two-line caption; and
  YouTube's "center 80%, top 70%" over the 16:9's caption and mock edges, the bottom of its comment box, the
  promise's second line and the fine print. No tap point falls in any of them, and Henriko approved them on overlay
  stills that draw every reading.

### Sound
```

If Task 5 changed a number, use the final one here and in the table (keep every table line 113 wide).

- [ ] **Step 5: The commands and the paragraph after them**

Edit: old

```
pnpm dev:video        # the WAVs, then Remotion Studio on http://localhost:3100: pick ad-pt or ad-en, scrub, play
pnpm render:video     # the WAVs, then video/out/ad-pt.mp4 + ad-en.mp4: H.264 (CRF 18) + AAC, 48 kHz stereo
```

→ new

```
pnpm dev:video        # the WAVs, then Remotion Studio on http://localhost:3100: pick a composition, scrub, play
pnpm render:video     # the WAVs, then all six to video/out/<id>.mp4: H.264 (CRF 18) + AAC, 48 kHz stereo
pnpm render:video ad-pt-9x16 ad-en-9x16                                                  # the WAVs, then only these ids
```

Edit: old

```
The first render downloads Chrome Headless Shell (~100 MB) once; later renders run offline. `video/out/` and
`video/public/audio/` are gitignored. `video/` has no unit tests: the only logic is timing, so `tsc`, ESLint, a review
of the stills and the soundtrack's self-check are the checks.
```

→ new (put Task 6 Step 1's time, in minutes, in place of the 8)

```
The first render downloads Chrome Headless Shell (~100 MB) once; later renders run offline. All six take about 8
minutes on the dev PC. `pnpm render:video` runs `video/scripts/render.mjs`, which asks Remotion for the ids
(`remotion compositions`, about 10 s, so `Root.tsx` stays the only list) and renders them one after another with the
same flags; an unknown id stops it before any render. `video/out/` and `video/public/audio/` are gitignored. `video/`
has no unit tests: the logic is timing and layout, so `tsc`, ESLint, the safe-zone check in `layouts.ts`, a review of
the stills in every format and the soundtrack's self-check are the checks.
```

- [ ] **Step 6: The Mermaid flow**

Edit: old

```
    C --> Ad["Ad.tsx<br/>Opening, Demo, EndCard + YouNode"]
```

→ new

```
    C --> Ad["Ad.tsx<br/>Opening, Demo, EndCard + YouNode"]
    LY["layouts.ts<br/>1x1, 16x9, 9x16 + safe-zone check"] --> Ad
```

Edit: old

```
    Ad --> R["Root.tsx<br/>ad-pt, ad-en"]
    R --> S["pnpm dev:video<br/>Studio preview"]
    R --> V["pnpm render:video<br/>video/out/ad-pt.mp4, ad-en.mp4"]
    V --> M["LinkedIn Campaign Manager<br/>(manual upload)"]
```

→ new

```
    Ad --> R["Root.tsx<br/>6 compositions: ad-{pt,en}, ad-{pt,en}-16x9, ad-{pt,en}-9x16"]
    R --> S["pnpm dev:video<br/>Studio preview"]
    R --> V["pnpm render:video → scripts/render.mjs<br/>video/out/ad-*.mp4 (six files)"]
    V --> M["LinkedIn Campaign Manager<br/>(square, manual upload)"]
    V --> YT["Google Ads for YouTube<br/>(16:9 in-stream + 9:16 Shorts, manual upload)"]
    V --> MA["Meta Ads Manager<br/>(Reels + Stories, manual upload)"]
    V --> TT["TikTok Ads Manager<br/>(9:16, manual upload)"]
```

The block's other ids are `L`, `A`, `C`, `Ad`, `G`, `P`, `W`, `ST`, `R`, `S`, `V` and `M`, so `LY`, `YT`, `MA` and `TT` are new. The braces sit inside quoted labels, as `{pt,en}` already does in the block's first line.

- [ ] **Step 7: "Changing the ad"**

Edit: old

```
- **Copy.** Nothing re-renders on its own: after a change to landing `hero.*` or app `comment.*` / `feed.*`,
  re-render and look at the stills before uploading, since a longer string can wrap onto one more line. The render
  throws `Expected two sentences in "…"` if `hero.subLine2` stops being two sentences.
```

→ new

```
- **Copy.** Nothing re-renders on its own: after a change to landing `hero.*` or app `comment.*` / `feed.*`,
  re-render and look at the stills in all three formats before uploading, since a longer string can wrap onto one
  more line, and each format wraps differently. The closest fits today: the PT feed caption in the 16:9 (663 px in
  680), the PT promise's first line in the 9:16 (802 in 820) and the EN fine print in the 9:16 (2 or 3 lines, both
  fit). The render throws `Expected two sentences in "…"` if `hero.subLine2` stops being two sentences.
- **A format's layout.** Its numbers are in `video/src/layouts.ts`. The check at load names any text box, tap or stop
  on the node's path that leaves the safe zone; the stills show the rest (wraps, the camera drift, the gray cards).
  `pnpm render:video <id> …` re-renders only the ids given.
```

Edit: old

```
- **Another language.** Add it to `LANGS` and `COPY` in `copy.ts`; `tsc` then lists every missing string.
```

→ new

```
- **Another language.** Add it to `LANGS` and `COPY` in `copy.ts`; `tsc` then lists every missing string, and
  `Root.tsx` registers the new language in all three formats on its own.
```

- [ ] **Step 8: §3 and §4**

Edit: old

```
- **Promo video (`video/`):** [Remotion](https://www.remotion.dev) **4.0.529**, React **19**, TypeScript. Renders the
  LinkedIn ad MP4s locally; nothing is deployed ([§15A](#15a-promotional-video-video)).
```

→ new

```
- **Promo video (`video/`):** [Remotion](https://www.remotion.dev) **4.0.529**, React **19**, TypeScript. Renders the
  ad MP4s locally in three formats (square for LinkedIn, 16:9 for YouTube, 9:16 for Shorts, Reels, Stories and TikTok);
  nothing is deployed ([§15A](#15a-promotional-video-video)).
```

Edit: old

```
├── video/                       # Remotion promo ad + sound, 1080×1080, pt + en → video/out/*.mp4 (not deployed, §15A)
```

→ new (deviation 9)

```
├── video/                       # Remotion promo ad + sound, pt + en in 1:1, 16:9 and 9:16 → video/out/*.mp4 (§15A)
```

- [ ] **Step 9: §18**

Edit: old

```
| `dev:video` / `render:video`                   | Build the WAVs, then Remotion Studio on port 3100 / render both ad MP4s (§15A).     |
```

→ new

```
| `dev:video` / `render:video`                   | Build the WAVs, then Studio on port 3100 / render all six MP4s or given ids (§15A). |
```

Edit: old

```
- **Video:** no unit tests (the only logic is timing); `tsc`, ESLint, the reviewed stills and the soundtrack script's
  self-check are the checks (§15A).
```

→ new

```
- **Video:** no unit tests (the logic is timing and layout); `tsc`, ESLint, the safe-zone check in `layouts.ts`, the
  reviewed stills and the soundtrack script's self-check are the checks (§15A).
```

§21's `video/**` row already covers the new files; it doesn't change.

- [ ] **Step 10: The Last-updated entry**

The newest entry goes first, above the Promo audio one, separated by a `---` line as the others are. The dates use non-breaking hyphens (U+2011), like every entry: copy them from the old line's `2026‑09‑26`.

Edit: old

```
_Last updated: 2026‑09‑26 (Promo audio). **The promo ad has sound: music and effects composed in code.**
```

→ new

```
_Last updated: 2026‑09‑28 (Promo formats). **The promo ad now also renders in 16:9 for YouTube in-stream ads and in
9:16 for YouTube Shorts, Instagram Reels, Stories and TikTok, in both languages.** `video/src/layouts.ts` holds one
layout per format (frame, safe zone, the mock's stage origin, text boxes and sizes, dots and gray cards) and checks
at load that every text box, the mock's text area, the node's home and every stop on its path sit inside the
format's safe zone. The app mock draws on a 1080×1080 stage at each format's origin, so the taps, the node's path and
the sound are unchanged; the Opening, the captions and the end card take their boxes and sizes from the layout.
`Root.tsx` registers six compositions (`ad-pt`, `ad-en`, `ad-pt-16x9`, `ad-en-16x9`, `ad-pt-9x16`, `ad-en-9x16`), and
the new `video/scripts/render.mjs` renders all of them, or only the ids given (`pnpm render:video ad-pt-9x16`). The
square is pixel-identical to before (12 stills), all six audio tracks are byte-identical, and no app, landing or
Convex code changed. Gates: `pnpm typecheck`, `pnpm lint` and `pnpm format:check` clean; `pnpm -r test` green and
unchanged (app 700/700, convex 789/789, landing 75/75). Sections updated: §3, §4, §15A, §18._

---

_Last updated: 2026‑09‑26 (Promo audio). **The promo ad has sound: music and effects composed in code.**
```

If Task 6 Step 6's counts differ from 700/789/75, use the measured ones.

- [ ] **Step 11: No stale names, and every width holds**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
grep -nE 'LOGO_NODE|\bHOME\b|both ad MP4s|pick ad-pt or ad-en' docs/PLATFORM.md; echo "exit $?"
$PY -c "
import sys
before = set(open(sys.argv[1], encoding='utf-8').read().split('\n'))
L = open('docs/PLATFORM.md', encoding='utf-8').read().split('\n')
print('new prose over 120:', [(i + 1, len(l)) for i, l in enumerate(L) if len(l) > 120 and l not in before and l[:1] != '|'])
row = next(l for l in L if l.startswith('| \`dev:video\`'))
print('row:', len(row), [i for i, c in enumerate(row) if c == '|'])
print('tree:', len(next(l for l in L if '# Remotion promo ad' in l)))
s = next(i for i, l in enumerate(L) if l.startswith('## 15A.'))
e = next(i for i, l in enumerate(L) if l.startswith('## 16.'))
f = next(i for i in range(s, e) if L[i] == '### Formats')
print('formats table:', [len(l) for l in L[f:e] if l.startswith('|')][:5])
print('command #:', [l.index('#') for l in L[s:e] if l.startswith('pnpm ') and '#' in l])
h = chr(0x2011)
print('date:', any(l.startswith('_Last updated: 2026' + h + '09' + h + '28 (Promo formats)') for l in L))
" "$SP/PLATFORM.before.md"
```
Expected:
```
exit 1
new prose over 120: []
row: 136 [0, 49, 135]
tree: 116
formats table: [113, 113, 113, 113, 113]
command #: [22, 22, 89, 89, 89, 89]
date: True
```
`row` matches the §18 table's other rows (pipes at 0, 49 and 135); `command #` is the commands block's comment column (the two short commands at 22, the long ones at 89).

- [ ] **Step 12: Memory**

Read `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\promo-video.md` first. Edit its description: old

```
description: "video/ (Remotion 4.0.529) renders the 30 s LinkedIn feed ad in pt-BR + EN from landing hero.* and app comment.*/feed.* strings, with sound synthesized by video/scripts/soundtrack.mjs; after changing those keys, tell Henriko the ad needs a re-render and a still review; a timeline change also goes into the script's literals."
```

→ new

```
description: "video/ (Remotion 4.0.529) renders the 30 s ad in pt-BR + EN in 3 formats (square LinkedIn, 16:9 YouTube, 9:16 Shorts/Reels/Stories/TikTok) from landing hero.* and app comment.*/feed.* strings, with sound synthesized by video/scripts/soundtrack.mjs; after changing those keys, tell Henriko the ad needs a re-render and a still review in all 3 formats; a timeline change also goes into the script's literals."
```

Edit (same file): old

```
Henriko approved the sound on 2026-09-28 ("ficou perfeito") with no tuning.
```

→ new

```
Formats (2026-09-28, PLATFORM §15A "Formats", plan `docs/superpowers/plans/2026-09-28-promo-formats.md`): six
compositions, `ad-{pt,en}` (square, unchanged), `ad-{pt,en}-16x9` (YouTube in-stream) and `ad-{pt,en}-9x16` (Shorts,
Reels, Stories, TikTok); `video/src/layouts.ts` holds each format's numbers and a safe-zone check that throws at load.
The mock draws on a 1080×1080 stage at each layout's origin, so taps, node path and sound are shared.
`pnpm render:video [ids…]` goes through `video/scripts/render.mjs` (~8 min for all six). After a copy change, review
stills in all three formats: close calls are the 16:9 PT feed caption and the 9:16 PT promise line 1 and EN fine print.
To re-check, re-create the plan's Task 1 `formats.py` in the scratchpad (square/audio/blank/lines/sheets).

Henriko approved the sound on 2026-09-28 ("ficou perfeito") with no tuning.
```

(Use Task 6's measured minutes in place of `~8 min`, and the date Henriko approved the stills if it isn't 2026-09-28.)

Read `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\MEMORY.md` first. Edit its promo-video line: old

```
renders are gitignored in `video/out/`.
```

→ new

```
renders are gitignored in `video/out/`. Formats since 2026-09-28: `ad-{pt,en}-16x9` (YouTube in-stream) + `ad-{pt,en}-9x16` (Shorts/Reels/Stories/TikTok); numbers + a safe-zone check that throws at load in `video/src/layouts.ts`; `pnpm render:video [ids…]` via `video/scripts/render.mjs`; review stills in all 3 formats.
```

- [ ] **Step 13: Ready to commit**

After the final review of the whole change (superpowers:executing-plans or superpowers:subagent-driven-development), optionally send Henriko the four new MP4s with SendUserFile (status `normal`, display `attach`). Tell Henriko in pt-BR that it's ready for their commit, and list what this plan touched:
- new: `video/src/layouts.ts`, `video/scripts/render.mjs`, this plan
- changed: `video/package.json`, `video/src/Root.tsx`, `video/src/Ad.tsx`, `video/src/YouNode.tsx`, `video/src/brand.ts`, `video/src/scenes/Opening.tsx`, `video/src/scenes/Demo.tsx`, `video/src/scenes/EndCard.tsx`, `docs/PLATFORM.md`
- already written: the spec, `docs/superpowers/specs/2026-09-28-promo-formats-design.md` (and its §3, if Task 5 changed a number)
- gitignored, never committed: `video/out/` and `video/public/audio/`

`video/` as a whole is still untracked (the picture's and the sound's work isn't committed yet), so git shows all of it as new.

- [ ] **Step 14: No commit.** Henriko commits.
