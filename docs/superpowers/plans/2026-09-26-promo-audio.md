# Promotional Ad Audio (music + sound effects) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `video/out/ad-pt.mp4` and `ad-en.mp4` a soundtrack, music composed in code plus sound effects on the on-screen events, without changing a pixel of the picture.

**Architecture:** A Node script with no dependencies (`video/scripts/soundtrack.mjs`) synthesizes the music and 14 effects into gitignored WAVs in `video/public/audio/`, checks itself, and runs before every Studio start and every render. `video/src/Soundtrack.tsx` plays the music from frame 0 and each effect in a `<Sequence from layout="none">` on the frame of the constant that already times its picture, so a moved tap takes its sound along. A Python script in the scratchpad measures the renders (sync, loudness, true peak, languages, stills); it fails on today's silent ad first.

**Tech Stack:** Node 24 (ESM, `node:` built-ins only); Remotion `4.0.529` (`Html5Audio`, `Sequence`, `staticFile`, `random`, `interpolate`), React 19, TypeScript 5.9. For measuring only, outside the repo: Python 3.11 with numpy 1.26, scipy 1.15 and Pillow 10.3.

**Spec:** `docs/superpowers/specs/2026-09-26-promo-audio-design.md` (approved 2026-09-26). Read it before starting; this plan argues from it. The picture's timeline is in `docs/superpowers/plans/2026-09-26-promo-video.md` and `docs/PLATFORM.md` §15A.

## Global Constraints

Copied from the spec; every task must meet them.

- **Output:** both MP4s carry the soundtrack as AAC, 48 kHz, stereo. The picture is unchanged: stills of frames 75, 190, 340, 500, 690 and 880 in both languages are pixel-identical to stills rendered before the first code change.
- **Sync:** every effect starts within ±1 frame (±33 ms, 1600 samples) of its event, and each is found as many times as spec §3 lists it.
- **Levels:** −15 ± 1 LUFS integrated (ITU-R BS.1770, gated) and a true peak ≤ −1 dBTP (4× oversampled), measured on the AAC decoded from the final MP4s.
- **Languages:** the PT and EN audio are identical, sample for sample.
- **The script:** Node 24, no dependencies. It writes `music.wav` plus `glow`, `ring-1` to `ring-3`, `card`, `tap`, `shimmer`, `key-1` to `key-3`, `plim`, `glide`, `land` and `pop` (`.wav`), 48 kHz 16-bit stereo, to `video/public/audio/` (gitignored, never versioned). Every run writes the same bytes. Its self-check (the music is exactly 30 s × 48 000 samples, no sample is `NaN` or infinite, no file peaks over its level) throws before anything is written. Budget: under 10 s on this PC.
- **The one manual coupling:** `FPS = 30`, `TOTAL_FRAMES = 900` and the cuts `210` and `705` are repeated at the top of the script, each commented with its source.
- **Remotion:** `Html5Audio` (`Audio` is the deprecated name). The music plays from frame 0; each effect in a `<Sequence from={frame} layout="none">`. Every file plays at volume 1 except the shimmer, which fades out over its last 4 frames. The shimmer's and the glide's `<Sequence>` end at the next event (typing starts, the node lands). `Ad.tsx` mounts `<Soundtrack />` once, outside the camera drift.
- **Exports only:** `T` (`Demo.tsx`), `FLIGHT` (`YouNode.tsx`) and `CTA_AT` (`EndCard.tsx`, replacing the literal `758`) become exports. No value changes.
- **Gates:** `pnpm typecheck`, `pnpm lint` and `pnpm format:check` clean; `pnpm -r test` unchanged (app 700/700, convex 789/789, landing 75/75).
- **Repo rules (CLAUDE.md + memory):**
  - **No git state changes at all.** No `git commit`, `git push`, `git stash`, `git checkout`, `git reset` or `git add`; Henriko commits everything.
  - Change files with the Edit and Write tools. Never use sed, heredocs or node scripts to edit; Bash is for read-only work, for running tools, and for scratch files in `$SP` (below). In the repo, the one exception is `cp`, `rm` and output redirects for generated files under `video/out/` and `video/public/audio/`.
  - Use pnpm, never npm. Never run `pnpm format` (it rewrites the whole repo); `prettier --check` and `pnpm format:check` only read.
  - `docs/PLATFORM.md` is updated in the same change.
- **Shell:** every command runs in Git Bash from the repo root, `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI`. Shell variables don't survive between Bash calls, so every block that uses `$SP` or `$PY` starts with this line:
  ```bash
  export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
  ```
- **Known noise:** every Remotion command prints a yellow "Version mismatch: zod installed 4.4.3, required 4.5.4" block. It predates this work and is harmless; ignore it.

## Review Focus

The five uncovered ways this breaks for a person using the ad or the repo, most likely first. Each one is pinned to a step in the task that owns the code.

1. **A fresh checkout has no WAVs** (they're gitignored), or someone deletes them. Expected: `pnpm render:video` and `pnpm dev:video` build them before Remotion starts, and the MP4s carry the sound. Pinned by Task 3 Step 9, which deletes `video/public/audio/` before the final render that the GREEN measurement reads, and Task 3 Step 8, which starts the Studio through its package script.
2. **The synth breaks** (a `NaN`, a silent part, a peak over its level) and a broken track would reach a render. Expected: the self-check throws before any file is written, and `pnpm render:video` stops before Remotion starts, so the last good MP4s stay as they were. Pinned by Task 2 Steps 3 and 4: the silent stand-in fails with exit 1, writes nothing, and leaves the MP4s' timestamps unchanged.
3. **A timing constant moves and its sound stays behind**, because a frame number was copied into `Soundtrack.tsx`. Expected: every effect reads the constant that times its picture. Pinned by Task 3 Step 7 (`Soundtrack.tsx` holds no number of two or more digits), next to the sync checks that find every effect on its constant's frame.
4. **A phone speaker plays mono**, and wide stereo (the detuned pad, the ping-pong echo, the reverb) can cancel when folded. Expected: folded to mono, the mix loses at most 3 dB. Pinned by the `levels, mono` check in Task 3 Step 12.
5. **The script runs from another directory** (the repo root, an IDE's run button). Expected: it always writes to `video/public/audio/`, never to a `public/` next to the caller. Pinned by Task 2 Step 8.

## Deviations from the spec (for Henriko to approve with this plan)

- **The plim peaks at −13 dBFS, not −10.** At −10 it pushes the mix's true peak to about −1.05 dBTP before the AAC encode, which leaves no margin under −1. At −13 the final MP4 measures about −1.9. Spec §7's fallback: whatever clips comes down.
- **The music measures about −15.9 LUFS on its own, not about −17.** It is still mastered to a −3 dBFS peak, as specified; `MUSIC_DRIVE_DB = 1` drives it 1 dB into the limiter, which puts the whole mix at about −15.5 LUFS, inside −15 ± 1. The spec called −17 a starting point, tuned by measurement.
- **Two more constants:** `MUSIC_DRIVE_DB` (above) and `THIRD_DB`, the level of ring-2's F#3 pad voice against one pad voice in `music.wav` (0 = the same level).
- **The filters are Simper's trapezoidal state-variable filter, not biquads** (spec §4.1). It has the same low, band and high responses and stays stable while the pad's cutoff sweeps (it's recomputed every 32 samples).
- **The glide's and the shimmer's lengths are literals too:** `GLIDE_FRAMES = 50` (`FLIGHT.dur`) and `SHIMMER_SECONDS = 1` (`T.generating` to `T.typing[0]`, 30 frames), commented with their sources. As the spec says, a timing change can shorten them but never make them overrun. §15A lists them next to the cuts.
- **What the checks allow for (measured):** Remotion's audio-only `--codec=wav` render is 16 samples longer than 30 s (1 440 016), and each effect starts 0 to 16 samples (at most 0.3 ms) after its frame, well inside ±1 frame. ffprobe reads the AAC stream as 30.058667 s, because AAC pads to whole 1024-sample frames, as the silent track already did; the picture and the music are 30.0 s.
- **One check stricter than the spec:** after subtracting the music and every matched effect, at most 8 LSB is left anywhere in the render, so nothing plays that spec §3 doesn't list.

## File map

```
video/
  package.json          # + "audio": "node scripts/soundtrack.mjs"; "studio" and "render" run it first
  scripts/
    soundtrack.mjs      # new: synth, composition and effects → public/audio/*.wav, after a self-check
  public/
    audio/              # generated and gitignored: music.wav + 14 effect WAVs
  src/
    Soundtrack.tsx      # new: the music + one <Sequence from layout="none"> per effect
    Ad.tsx              # mounts <Soundtrack /> once, outside the camera drift
    YouNode.tsx         # FLIGHT becomes an export
    scenes/
      Demo.tsx          # T becomes an export
      EndCard.tsx       # CTA_AT = 758 (export); the pop reads it
  out/                  # renders, audio-only renders, decoded AAC and stills (gitignored)
```

Modified outside `video/`: `.gitignore`, `docs/PLATFORM.md`, and the memory folder (`promo-video.md`, `MEMORY.md`). Outside the repo: `$SP/measure.py`.

---

### Task 1: Baseline stills and the measurement (RED)

**Files:**
- Create (gitignored): `video/out/review-before/{en,pt}-{1..6}.png`, `video/out/aac-{pt,en}.wav`
- Create (scratchpad, not the repo): `C:\Users\henri\AppData\Local\Temp\claude\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\00ade649-c22e-4874-92b5-b97ed30d0b3b\scratchpad\measure.py`

**Interfaces:**
- Consumes: the current `video/` package and its silent MP4s, `video/out/ad-pt.mp4` and `ad-en.mp4`.
- Produces:
  - `$PY $SP/measure.py video` runs 11 checks (spec §5 steps 2–5) on `video/public/audio/*.wav`, `video/out/audio-{pt,en}.wav` (audio-only renders) and `video/out/aac-{pt,en}.wav` (the MP4s' AAC, decoded).
  - `$PY $SP/measure.py video stills` runs 1 check (spec §5 step 7): `video/out/review-before/*.png` against `video/out/review-after/*.png`.
  - Both print one `PASS` or `FAIL` line per check, then `N/M checks pass`, and exit 0 only when every check passes. A missing file fails its checks, not the script.
  - The 12 stills of the picture before any code change.

- [ ] **Step 1: Stills before any code change**

This must run before Task 3 touches `video/src/` (Task 2 doesn't touch it). It takes about 2 minutes, so give the Bash call a 10-minute timeout.

Run:
```bash
mkdir -p video/out/review-before && for l in en pt; do i=1; for f in 75 190 340 500 690 880; do pnpm --filter video exec remotion still src/index.ts ad-$l out/review-before/$l-$i.png --frame=$f; i=$((i+1)); done; done; ls video/out/review-before
```
Expected: `en-1.png` to `en-6.png` and `pt-1.png` to `pt-6.png` (12 files).

- [ ] **Step 2: Write the measurement**

The file may already exist in the scratchpad from the design work; write it anyway, so it matches this plan byte for byte. Write `C:\Users\henri\AppData\Local\Temp\claude\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\00ade649-c22e-4874-92b5-b97ed30d0b3b\scratchpad\measure.py`:

```python
"""Measures the promo ad's soundtrack against docs/superpowers/specs/2026-09-26-promo-audio-design.md §5.

  python measure.py VIDEO_DIR          sync, music, levels and languages (§5 steps 2-5), from
                                       VIDEO_DIR/public/audio/*.wav, VIDEO_DIR/out/audio-{pt,en}.wav (audio-only
                                       renders) and VIDEO_DIR/out/aac-{pt,en}.wav (the MP4s' AAC, decoded)
  python measure.py VIDEO_DIR stills   the picture (§5 step 7): out/review-before/*.png against out/review-after/*.png

Prints one PASS or FAIL line per check and exits 1 if any fails. A missing file fails its checks, not the script.
"""

import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, correlate, lfilter, resample_poly, sosfilt

SR = 48000
FRAME = SR // 30  # samples per frame
LENGTH = 900 * FRAME
LSB = 1 / 32768
# Where each effect starts (frame), loudest first: the matching subtracts each one it finds, so the quiet ones are
# matched against what's left. From Opening.tsx, Demo.tsx, YouNode.tsx and EndCard.tsx.
ONE_SHOTS = {
    'tap': [372, 408, 525, 575, 605],
    'land': [750],
    'plim': [609],
    'ring-1': [96],
    'ring-2': [120],
    'ring-3': [144],
    'pop': [758],
    'glow': [90],
    'glide': [700],
    'card': [222, 236, 250],
    'shimmer': [410],
}
MATCH_FRAMES = {'shimmer': 26, 'glide': 50}  # the part of a sustained effect that plays at full volume
TYPING = (440, 490)  # T.typing
FADE = (436, 440)  # the shimmer's fade-out, which the matching leaves in the residual
SEARCH = 10 * FRAME  # how far from its frame an effect is looked for

VIDEO = Path(sys.argv[1])
AUDIO = VIDEO / 'public' / 'audio'
OUT = VIDEO / 'out'
results = []


def check(name, fn):
    try:
        ok, detail = fn()
    except Exception as e:  # a missing or unreadable file fails the check
        ok, detail = False, f'{type(e).__name__}: {e}'
    results.append(ok)
    print(f'{"PASS" if ok else "FAIL"}  {name}: {detail}', flush=True)


def load(path):
    sr, x = wavfile.read(path)
    if sr != SR:
        raise ValueError(f'{path.name} is {sr} Hz, not {SR}')
    if x.ndim != 2 or x.shape[1] != 2:
        raise ValueError(f'{path.name} is not stereo')
    scale = {np.dtype('int16'): 2**15, np.dtype('int32'): 2**31}.get(x.dtype, 1)  # 24-bit reads as int32
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


def integrated_lufs(x):  # ITU-R BS.1770-4: 400 ms blocks, 75% overlap, absolute then relative gate
    l, _ = block_loudness(x, 19200, 4800)
    l = l[l > -70]
    if len(l) == 0:
        return -np.inf
    power = lambda v: np.mean(10 ** ((v + 0.691) / 10))
    l = l[l > -0.691 + 10 * np.log10(power(l)) - 10]
    return -0.691 + 10 * np.log10(power(l))


def true_peak(x):
    return dbfs(np.abs(resample_poly(x, 4, 1, axis=0)).max())


def locate(r, w, lo, hi):
    """Best fit of w in r, starting between samples lo and hi: (start, gain). The gain is 1 when w is there as is."""
    seg = r[lo : hi + len(w)]
    corr = sum(correlate(seg[:, c], w[:, c], mode='valid', method='fft') for c in (0, 1))
    k = int(np.argmax(corr))
    return lo + k, corr[k] / (w**2).sum()


# ─── Sync (§5 step 2) ───────────────────────────────────────────────────────────────────────────────────────────────

state = {}


def residual():
    """What the render holds besides the music. The sync checks below subtract each effect from it as they find it."""
    if 'r' not in state:
        raise RuntimeError('no residual, see "sync, music under the effects"')
    return state['r']


def music_under():
    mix = load(OUT / 'audio-pt.wav')
    music = load(AUDIO / 'music.wav')
    # Remotion pads the end of its WAV with a few samples (16 in 4.0.529), so up to a frame of extra render is fine.
    if len(music) != LENGTH or not LENGTH <= len(mix) <= LENGTH + FRAME:
        return False, f'music.wav has {len(music)} samples and the render {len(mix)}, not {LENGTH}'
    state['r'] = mix[:LENGTH] - music
    head = np.abs(state['r'][: int(2.95 * SR)]).max() / LSB
    return head <= 2, f'the render minus music.wav is {head:.0f} LSB before the first effect (max 2)'


def one_shots():
    r = residual()
    worst, gains, placed = 0, [], 0
    for name, frames in ONE_SHOTS.items():
        w = load(AUDIO / f'{name}.wav')
        if name in MATCH_FRAMES:
            w = w[: MATCH_FRAMES[name] * FRAME]
        for f in frames:
            at, gain = locate(r, w, f * FRAME - SEARCH, f * FRAME + SEARCH)
            r[at : at + len(w)] -= w
            worst = max(worst, abs(at - f * FRAME))
            gains.append(gain)
            placed += 1
    ok = worst <= FRAME and min(gains) > 0.95 and max(gains) < 1.05
    return ok, f'{placed} effects, worst offset {worst} samples (max {FRAME}), gains {min(gains):.3f}-{max(gains):.3f}'


def keys():
    r = residual()
    variants = [load(AUDIO / f'key-{v}.wav') for v in (1, 2, 3)]
    lo, hi = (TYPING[0] - 1) * FRAME, TYPING[1] * FRAME
    found = []
    while len(found) < 40:
        at, gain, v = max(((*locate(r, w, lo, hi), v) for v, w in enumerate(variants)), key=lambda b: b[1])
        if gain < 0.5:
            break
        r[at : at + len(variants[v])] -= variants[v]
        found.append((at, gain))
    frames = sorted(round(at / FRAME) for at, _ in found)
    gaps = set(np.diff(frames).tolist())
    off = max((abs(at - round(at / FRAME) * FRAME) for at, _ in found), default=0)
    gains = [g for _, g in found] or [0]
    ok = (
        17 <= len(found) <= 25
        and frames[0] >= TYPING[0]
        and frames[-1] < TYPING[1]
        and gaps <= {2, 3}
        and off <= FRAME
        and min(gains) > 0.95
        and max(gains) < 1.05
    )
    return ok, (
        f'{len(found)} keys on frames {frames[0]}-{frames[-1]}, gaps {sorted(gaps)}, worst offset {off} samples, '
        f'gains {min(gains):.3f}-{max(gains):.3f}'
    )


def leftover():
    r = residual().copy()
    r[FADE[0] * FRAME : FADE[1] * FRAME] = 0
    left = np.abs(r).max() / LSB
    at = np.abs(r).max(axis=1).argmax() / FRAME
    return left <= 8, f'after the matches, {left:.0f} LSB left (max 8), largest at frame {at:.0f}'


# ─── Music (§5 step 3) ──────────────────────────────────────────────────────────────────────────────────────────────


def edges():
    x = load(AUDIO / 'music.wav')
    head, tail = dbfs(np.abs(x[:480]).max()), dbfs(np.abs(x[-480:]).max())
    return max(head, tail) < -60, f'first 10 ms {head:.0f} dBFS, last 10 ms {tail:.0f} dBFS (max -60)'


def no_dropout():
    x = load(AUDIO / 'music.wav')
    l, starts = block_loudness(x, 19200, 4800)
    keep = (starts >= 2 * SR) & (starts + 19200 <= 29.5 * SR)
    i = np.argmin(l[keep])
    return l[keep][i] > -40, f'quietest 400 ms is {l[keep][i]:.1f} LUFS at {starts[keep][i] / SR:.1f} s (min -40)'


def bass_at_cuts():
    x = load(AUDIO / 'music.wav')
    low = sosfilt(butter(4, 150, 'low', fs=SR, output='sos'), x.mean(axis=1))
    hop = 240  # 5 ms
    e = 10 * np.log10(np.add.reduceat(low**2, np.arange(0, len(low), hop)) / hop + 1e-20)
    found = []
    for cut in (210, 705):
        hops = range((cut - 10) * FRAME // hop, (cut + 10) * FRAME // hop)
        # the first 5 ms that is 10 dB over the median of the half-second before it
        onset = next((h * hop / FRAME - cut for h in hops if e[h] > np.median(e[h - 100 : h - 20]) + 10), None)
        found.append((cut, onset))
    ok = all(onset is not None and abs(onset) <= 1 for _, onset in found)
    return ok, 'below 150 Hz, ' + ', '.join(
        f'frame {cut}: ' + ('no onset' if onset is None else f'onset {onset:+.2f} frames') for cut, onset in found
    )


# ─── Levels and languages (§5 steps 4-5) ────────────────────────────────────────────────────────────────────────────


def levels(lang):
    def fn():
        x = load(OUT / f'aac-{lang}.wav')
        lufs, tp = integrated_lufs(x), true_peak(x)
        return -16 <= lufs <= -14 and tp <= -1, f'{lufs:.2f} LUFS (-15 ± 1), true peak {tp:.2f} dBTP (max -1)'

    return fn


def mono():  # a phone speaker plays (L + R) / 2: wide stereo that cancels there would lose more than 3 dB
    x = load(OUT / 'aac-pt.wav')
    drop = integrated_lufs(x) - integrated_lufs(x.mean(axis=1, keepdims=True).repeat(2, axis=1))
    return drop <= 3, f'folded to mono it loses {drop:.2f} dB (max 3)'


def languages():
    pt, en = load(OUT / 'audio-pt.wav'), load(OUT / 'audio-en.wav')
    return pt.shape == en.shape and np.array_equal(pt, en), 'audio-pt.wav and audio-en.wav are sample-identical'


# ─── Stills (§5 step 7) ─────────────────────────────────────────────────────────────────────────────────────────────


def stills():
    from PIL import Image

    before = sorted((OUT / 'review-before').glob('*.png'))
    pixels = lambda p: np.asarray(Image.open(p))
    changed = [p.name for p in before if not np.array_equal(pixels(p), pixels(OUT / 'review-after' / p.name))]
    return len(before) == 12 and not changed, f'{len(before)} stills (12 expected), changed: {changed or "none"}'


if sys.argv[2:] == ['stills']:
    check('picture', stills)
else:
    check('sync, music under the effects', music_under)
    check('sync, one-shots', one_shots)
    check('sync, keys', keys)
    check('sync, nothing else', leftover)
    check('music, silent edges', edges)
    check('music, no dropout', no_dropout)
    check('music, bass at the cuts', bass_at_cuts)
    check('levels, pt', levels('pt'))
    check('levels, en', levels('en'))
    check('levels, mono', mono)
    check('languages', languages)
print(f'{sum(results)}/{len(results)} checks pass')
sys.exit(0 if all(results) else 1)
```

How it measures, in short: the render minus `music.wav` leaves only the effects, because Remotion sums the tracks as they are (`amix` with `normalize=0`) and every file plays at volume 1. Each effect's WAV is then found in that residual by cross-correlation and subtracted, loudest first; the gain of a match is 1 when the effect is there unchanged. The keys are found the same way inside `T.typing`. Loudness follows BS.1770-4 (K-weighting, 400 ms blocks, absolute and relative gates), and the true peak is read 4× oversampled.

- [ ] **Step 3: Watch it fail on today's silent ad (RED)**

Decode the silent MP4s' AAC, then measure. There are no WAVs and no audio-only renders yet.

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
for l in pt en; do pnpm --filter video exec remotion ffmpeg -hide_banner -loglevel error -y -i out/ad-$l.mp4 -vn -c:a pcm_s24le out/aac-$l.wav; done
$PY $SP/measure.py video; echo "exit $?"
```
Expected (paths print Windows-style; `…` stands for the rest of the path):
```
FAIL  sync, music under the effects: FileNotFoundError: [Errno 2] No such file or directory: '…audio-pt.wav'
FAIL  sync, one-shots: RuntimeError: no residual, see "sync, music under the effects"
FAIL  sync, keys: RuntimeError: no residual, see "sync, music under the effects"
FAIL  sync, nothing else: RuntimeError: no residual, see "sync, music under the effects"
FAIL  music, silent edges: FileNotFoundError: [Errno 2] No such file or directory: '…music.wav'
FAIL  music, no dropout: FileNotFoundError: [Errno 2] No such file or directory: '…music.wav'
FAIL  music, bass at the cuts: FileNotFoundError: [Errno 2] No such file or directory: '…music.wav'
FAIL  levels, pt: -inf LUFS (-15 ± 1), true peak -240.00 dBTP (max -1)
FAIL  levels, en: -inf LUFS (-15 ± 1), true peak -240.00 dBTP (max -1)
FAIL  levels, mono: folded to mono it loses nan dB (max 3)
FAIL  languages: FileNotFoundError: [Errno 2] No such file or directory: '…audio-pt.wav'
0/11 checks pass
exit 1
```
The levels lines prove the decoded track really is silent (every sample 0), and the other lines fail because the files don't exist yet.

- [ ] **Step 4: Prove the stills check can fail**

Three controls, in this order:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
rm -rf video/out/review-after && cp -r video/out/review-before video/out/review-after && $PY $SP/measure.py video stills; echo "exit $?"
cp video/out/review-after/en-2.png video/out/review-after/en-3.png && $PY $SP/measure.py video stills; echo "exit $?"
rm -rf video/out/review-after && $PY $SP/measure.py video stills; echo "exit $?"
```
Expected, one block per control:
```
PASS  picture: 12 stills (12 expected), changed: none
1/1 checks pass
exit 0
FAIL  picture: 12 stills (12 expected), changed: ['en-3.png']
0/1 checks pass
exit 1
FAIL  picture: FileNotFoundError: [Errno 2] No such file or directory: '…review-after\\en-1.png'
0/1 checks pass
exit 1
```
`video/out/review-after/` no longer exists afterwards; Task 3 renders it for real.

- [ ] **Step 5: No commit.** Henriko commits.

---

### Task 2: The soundtrack script

**Files:**
- Create: `video/scripts/soundtrack.mjs`
- Modify: `video/package.json` (the `scripts` block)
- Modify: `.gitignore` (append after `video/out/`, its last line)
- Create (gitignored): `video/public/audio/*.wav` (15 files)

**Interfaces:**
- Consumes: nothing from `video/src/` (Node can't import its TypeScript and JSX). The script repeats the timeline's numbers as literals: `FPS` 30 and `TOTAL_FRAMES` 900 (`brand.ts`), the cuts 210 and 705 (`Ad.tsx`), `GLIDE_FRAMES` 50 (`YouNode.tsx` `FLIGHT.dur`) and `SHIMMER_SECONDS` 1 (`Demo.tsx`, `T.typing[0] - T.generating` = 30 frames).
- Produces:
  - The package script `audio` (`pnpm --filter video audio`), which `studio` and `render` run first. It prints `soundtrack: 15 WAVs in <path> (<seconds> s)` and exits 0, or throws `soundtrack self-check failed:` and exits 1 before writing anything.
  - 15 files in `video/public/audio/`, 48 kHz 16-bit stereo PCM: `music`, `glow`, `ring-1`, `ring-2`, `ring-3`, `card`, `tap`, `shimmer`, `key-1`, `key-2`, `key-3`, `plim`, `glide`, `land`, `pop` (`.wav`). `music.wav` is exactly 1 440 000 samples; `glide.wav` is exactly 50 frames (80 000 samples); `shimmer.wav` is 1.7 s, of which its `<Sequence>` plays the first 30 frames.

- [ ] **Step 1: Write the script with a stand-in for the music**

Everything but the composition. `music()` returns silence, which the self-check must refuse. Write `video/scripts/soundtrack.mjs`:

```js
// The ad's soundtrack, synthesized in code with no dependencies: music.wav plus one WAV per sound effect, written to
// video/public/audio/ (gitignored) after a self-check. Soundtrack.tsx plays them: the music from frame 0, each effect
// on the frame of its event. PLATFORM.md §15A "Sound" has the map.
//
//   pnpm --filter video audio        (the studio and render scripts run it first)
//
// The levels, the harmony and the brightness are constants at the top; the instruments are functions below. Noise
// comes from seeded generators, so every run writes the same bytes.

import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
const THIRD_DB = 0 // ring-2's F#3 pad voice, against one pad voice in music.wav
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
const CHORDS = {
  D: { pad: ['D3', 'F#3', 'A3', 'D4'], top: 'F#4', bass: 'D2', arp: ['D4', 'A4', 'D5', 'F#5'] },
  Bm: { pad: ['B2', 'F#3', 'B3', 'D4'], top: 'F#4', bass: 'B1', arp: ['B3', 'F#4', 'B4', 'D5'] },
  G: { pad: ['G2', 'G3', 'B3', 'D4'], top: 'G4', bass: 'G1', arp: ['G3', 'D4', 'G4', 'B4'] },
  A: { pad: ['A2', 'E3', 'A3', 'C#4'], top: 'E4', bass: 'A1', arp: ['A3', 'E4', 'A4', 'C#5'] },
  Asus4: { pad: ['A2', 'E3', 'A3', 'D4'], top: 'E4', bass: 'A1', arp: ['A3', 'E4', 'A4', 'D5'] },
  'G/D': { pad: ['D3', 'G3', 'B3', 'D4'], top: 'G4', bass: 'D2', arp: ['D4', 'G4', 'B4', 'D5'] }
}
const INTRO = ['D3', 'A3', 'D4', 'E4'] // Dsus2, no third: an open question. ring-2.wav brings the F#.
const FEED_BARS = [['D'], ['Bm'], ['G'], ['A'], ['D'], ['Bm'], ['G'], ['Asus4', 'A']] // two chords split the bar
const END_BARS = [['D'], ['G/D'], ['D']]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3] // the arpeggio note each eighth plays
const PANS = [-0.35, -0.1, 0.1, 0.35] // where each arpeggio note sits, low notes left
const BREATH_STRUM = ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4']
const FINAL_STRUM = ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']
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

// A stand-in until the composition exists: silence, which the self-check must refuse.
function music() {
  return { track: normalize(stereo(SECONDS), MUSIC_PEAK_DB), padGain: 0 }
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
// feed (whose D chord brings its own F#3) and releases, at the level of one pad voice in music.wav.
function ringWithThird(padGain) {
  const hold = 3.4 // s: ring-2 plays at 4.0 s, so the voice ends near 7.4 s
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
  if (files.music.l.length !== LENGTH) errors.push(`music.wav has ${files.music.l.length} samples, not ${LENGTH}`)
  for (const [name, track] of Object.entries(files)) {
    if (!channels(track).every(ch => ch.every(Number.isFinite))) errors.push(`${name}.wav has a NaN or infinite sample`)
    const limitDb = name === 'music' ? MUSIC_PEAK_DB : PEAK_DB[name.replace(/-\d$/, '')]
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
const { track, padGain } = music()
const files = { music: track, ...effects(padGain) }
check(files)
const out = join(import.meta.dirname, '..', 'public', 'audio')
mkdirSync(out, { recursive: true })
for (const [name, file] of Object.entries(files)) writeFileSync(join(out, `${name}.wav`), wav(file))
const took = ((performance.now() - started) / 1000).toFixed(1)
console.log(`soundtrack: ${Object.keys(files).length} WAVs in ${out} (${took} s)`)
```

ESLint would flag the instruments as unused until Step 5 puts the real `music()` in; lint runs in Step 10.

- [ ] **Step 2: Wire the package scripts and ignore the WAVs**

Edit `video/package.json`: old

```
    "studio": "remotion studio src/index.ts --port=3100",
    "render": "remotion render src/index.ts ad-pt out/ad-pt.mp4 --crf=18 --jpeg-quality=100 --enforce-audio-track && remotion render src/index.ts ad-en out/ad-en.mp4 --crf=18 --jpeg-quality=100 --enforce-audio-track"
```

→ new

```
    "audio": "node scripts/soundtrack.mjs",
    "studio": "pnpm run audio && remotion studio src/index.ts --port=3100",
    "render": "pnpm run audio && remotion render src/index.ts ad-pt out/ad-pt.mp4 --crf=18 --jpeg-quality=100 --enforce-audio-track && remotion render src/index.ts ad-en out/ad-en.mp4 --crf=18 --jpeg-quality=100 --enforce-audio-track"
```

The root scripts need no change: `dev:video` is `pnpm --filter video studio` and `render:video` is `pnpm --filter video render`. The `video` entry in `.claude/launch.json` runs `pnpm --filter video studio --no-open`; pnpm appends `--no-open` to the end of the script, so it still reaches `remotion studio`.

Edit `.gitignore` (CRLF, and its last line has no newline): old

```
video/out/
```

→ new

```
video/out/

# Soundtrack WAVs (video/): written by video/scripts/soundtrack.mjs before every Studio run and render
video/public/audio/
```

- [ ] **Step 3: Watch the self-check refuse the stand-in (RED)**

Run:
```bash
rm -rf video/public/audio; pnpm --filter video audio; echo "exit $?"; ls video/public/audio
```
Expected:
- Node's stack trace for `Error: soundtrack self-check failed:`, followed by the two lines `music.wav has a NaN or infinite sample` and `music.wav peaks over -3 dBFS` (the silent music normalizes to `NaN`).
- pnpm's own report of the failed `audio` script, then `exit 1`.
- `ls: cannot access 'video/public/audio': No such file or directory`: the check runs before the folder is even created.

- [ ] **Step 4: A failed check stops the render (Review Focus 2)**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
stat -c '%y %n' video/out/ad-pt.mp4 video/out/ad-en.mp4 > "$SP/mtimes.txt"; pnpm render:video; echo "exit $?"; stat -c '%y %n' video/out/ad-pt.mp4 video/out/ad-en.mp4 | diff "$SP/mtimes.txt" - && echo "MP4s untouched"
```
Expected: the same self-check error as Step 3, within a few seconds and with no `Rendered` line (Remotion never started), then `exit 1` and `MP4s untouched`.

- [ ] **Step 5: Compose the music**

Edit `video/scripts/soundtrack.mjs`: old

```js
// A stand-in until the composition exists: silence, which the self-check must refuse.
function music() {
  return { track: normalize(stereo(SECONDS), MUSIC_PEAK_DB), padGain: 0 }
}
```

→ new

```js
function music() {
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
  // pulsing on the root and the pluck on the arpeggio, doubled an octave up in the second pass. At BREATH it all stops
  // for a strum on A.
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
    if (e >= 32) add(plucks, pluck(2 * hz(chord.arp[i]), 0.8, rng), t, db(MIX_DB.octave), -PANS[i])
  }
  strum(plucks, BREATH_STRUM, BREATH, END + 1 - BREATH, 0.997, rng)

  // The end card: the impact lands on D. Kick and bass keep pulsing for two bars under quarter-note plucks; the last D
  // drops the kick, holds the bass and strums, ringing into the fade.
  add(fx, normalize(impact(), MIX_DB.impact), END)
  const last = END + 2 * BAR
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
  const drive = db(MUSIC_DRIVE_DB) / peak(master)
  limit(scale(master, drive), MUSIC_PEAK_DB)
  fadeOut(fadeIn(master, 2), 0.5)
  const trim = db(MUSIC_PEAK_DB) / peak(master)
  scale(master, trim)
  return { track: master, padGain: padGain * drive * trim }
}
```

`padGain` leaves `music()` so that `ringWithThird` can put ring-2's F#3 at exactly the level of one pad voice in the finished `music.wav`.

- [ ] **Step 6: Run it (GREEN)**

Run:
```bash
pnpm --filter video audio; echo "exit $?"; ls video/public/audio
```
Expected:
- `soundtrack: 15 WAVs in D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\public\audio (1.9 s)`. The time varies; the spec's budget is under 10 s.
- `exit 0`.
- 15 files, one per line: `card.wav`, `glide.wav`, `glow.wav`, `key-1.wav`, `key-2.wav`, `key-3.wav`, `land.wav`, `music.wav`, `plim.wav`, `pop.wav`, `ring-1.wav`, `ring-2.wav`, `ring-3.wav`, `shimmer.wav`, `tap.wav`.

- [ ] **Step 7: Every run writes the same bytes**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
(cd video/public/audio && sha256sum *.wav) > "$SP/run1.sha" && pnpm --filter video audio && (cd video/public/audio && sha256sum *.wav) > "$SP/run2.sha" && diff "$SP/run1.sha" "$SP/run2.sha" && echo IDENTICAL && wc -l < "$SP/run2.sha"
```
Expected: the `soundtrack:` line, then `IDENTICAL` and `15`.

- [ ] **Step 8: It writes to `video/public/audio/` from any directory (Review Focus 5)**

Run it with Node from the repo root instead of through pnpm (which runs in `video/`):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
node video/scripts/soundtrack.mjs && ls public; (cd video/public/audio && sha256sum *.wav) | diff "$SP/run2.sha" - && echo IDENTICAL
```
Expected: `soundtrack: 15 WAVs in D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\public\audio (…)`, then `ls: cannot access 'public': No such file or directory` (nothing was written next to the caller), then `IDENTICAL`.

- [ ] **Step 9: The music checks pass**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY $SP/measure.py video; echo "exit $?"
```
Expected: the three music checks now pass, and the rest still fail as in Task 1 Step 3 (no audio-only renders yet, and the decoded AAC is still the silent one):
```
PASS  music, silent edges: first 10 ms -240 dBFS, last 10 ms -90 dBFS (max -60)
PASS  music, no dropout: quietest 400 ms is -26.1 LUFS at 2.0 s (min -40)
PASS  music, bass at the cuts: below 150 Hz, frame 210: onset +0.00 frames, frame 705: onset +0.00 frames
```
then `3/11 checks pass` and `exit 1`.

- [ ] **Step 10: Lint and format**

Run:
```bash
pnpm exec eslint --max-warnings 0 video/scripts/soundtrack.mjs && pnpm exec prettier --check video/scripts/soundtrack.mjs video/package.json
```
Expected: no ESLint output, then `Checking formatting...` and `All matched files use Prettier code style!`.

- [ ] **Step 11: Git ignores the WAVs**

Run:
```bash
git check-ignore -v video/public/audio/music.wav; git status --short --untracked-files=all video/public
```
Expected: `.gitignore:24:video/public/audio/	video/public/audio/music.wav`, and nothing from `git status`.

- [ ] **Step 12: No commit.** Henriko commits.

---

### Task 3: Play the soundtrack in the ad

**Files:**
- Create: `video/src/Soundtrack.tsx`
- Modify: `video/src/scenes/Demo.tsx` (the `T` declaration), `video/src/YouNode.tsx` (the `FLIGHT` declaration), `video/src/scenes/EndCard.tsx` (after `LANDED`, and the pop's spring), `video/src/Ad.tsx` (an import and one line in the JSX)
- Create (gitignored): `video/out/ad-{pt,en}.mp4` (re-rendered), `video/out/audio-{pt,en}.wav`, `video/out/aac-{pt,en}.wav` (replaced), `video/out/review-after/*.png`, `video/out/render.log`

**Interfaces:**
- Consumes: Task 2's 15 WAV names; `TAPS` from `Demo.tsx` (`comment`, `generate`, `submit`, `paste`, `post`, each `{ at, x, y }`); `BRIGHTEN` (90) and `RINGS` ([96, 120, 144]) from `Opening.tsx`; `LANDED` (750) from `EndCard.tsx`; Task 1's `measure.py`.
- Produces:
  - `export const T` in `Demo.tsx`: `cards` ([222, 236, 250]), `generating` (410), `typing` ([440, 490]) and `posted` (609), plus `boxOpen`, `dim`, `window` and `pasted`.
  - `export const FLIGHT = { at: LANDED - 50, dur: 50, arc: 160 }` in `YouNode.tsx`.
  - `export const CTA_AT = 758` in `EndCard.tsx`.
  - `export function Soundtrack()` in `video/src/Soundtrack.tsx`, mounted by `Ad`.
  - The final MP4s, with sound.

- [ ] **Step 1: Export `T`**

Edit `video/src/scenes/Demo.tsx`: old

```tsx
// What each tap sets off.
const T = {
```

→ new

```tsx
// What each tap sets off. Soundtrack.tsx plays its effects on these frames too.
export const T = {
```

- [ ] **Step 2: Export `FLIGHT`**

Edit `video/src/YouNode.tsx`: old

```tsx
const FLIGHT = { at: LANDED - 50, dur: 50, arc: 160 }
```

→ new

```tsx
export const FLIGHT = { at: LANDED - 50, dur: 50, arc: 160 } // scripts/soundtrack.mjs sizes the glide to `dur`
```

- [ ] **Step 3: Name the CTA's frame**

Edit `video/src/scenes/EndCard.tsx`: old

```tsx
export const LANDED = 750
```

→ new

```tsx
export const LANDED = 750
export const CTA_AT = 758 // the CTA pill pops in
```

Then Edit the same file: old

```tsx
  const pop = spring({ frame: Math.max(0, frame - 758), fps: FPS, config: { damping: 12 } })
```

→ new

```tsx
  const pop = spring({ frame: Math.max(0, frame - CTA_AT), fps: FPS, config: { damping: 12 } })
```

- [ ] **Step 4: Write the soundtrack component**

Write `video/src/Soundtrack.tsx`:

```tsx
import { Html5Audio, interpolate, random, Sequence, staticFile } from 'remotion'
import { T, TAPS } from './scenes/Demo'
import { CTA_AT, LANDED } from './scenes/EndCard'
import { BRIGHTEN, RINGS } from './scenes/Opening'
import { FLIGHT } from './YouNode'

// Plays video/public/audio/*.wav (scripts/soundtrack.mjs writes them): the music from frame 0, and each effect on the
// frame of the constant that times its picture, so a moved tap takes its sound along. Levels are baked into the files.
const audio = (name: string) => staticFile(`audio/${name}.wav`)

// The AI's typing: a key every 2 frames, or 3 with probability 0.2, each one of 3 variants. Seeded random(), so every
// render types the same.
const KEYS: { at: number; variant: number }[] = []
for (let at = T.typing[0], i = 0; at < T.typing[1]; i++) {
  KEYS.push({ at, variant: 1 + Math.floor(random(`key-${i}`) * 3) })
  at += random(`gap-${i}`) < 0.2 ? 3 : 2
}

const SHIMMER = T.typing[0] - T.generating // frames: the shimmer stops where the typing starts

const ONE_SHOTS = [
  { at: BRIGHTEN, name: 'glow' },
  ...RINGS.map((at, i) => ({ at, name: `ring-${i + 1}` })),
  ...T.cards.map(at => ({ at, name: 'card' })),
  ...Object.values(TAPS).map(tap => ({ at: tap.at, name: 'tap' })),
  ...KEYS.map(key => ({ at: key.at, name: `key-${key.variant}` })),
  { at: T.posted, name: 'plim' },
  { at: LANDED, name: 'land' },
  { at: CTA_AT, name: 'pop' }
]

export function Soundtrack() {
  return (
    <>
      <Html5Audio src={audio('music')} />
      {ONE_SHOTS.map(({ at, name }) => (
        <Sequence
          key={`${name}@${at}`}
          from={at}
          layout="none"
        >
          <Html5Audio src={audio(name)} />
        </Sequence>
      ))}
      <Sequence
        from={T.generating}
        durationInFrames={SHIMMER}
        layout="none"
      >
        <Html5Audio
          src={audio('shimmer')}
          volume={f =>
            interpolate(f, [SHIMMER - 4, SHIMMER - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          }
        />
      </Sequence>
      {/* Ends where the node lands, so a longer flight can't make the glide overrun the landing. */}
      <Sequence
        from={FLIGHT.at}
        durationInFrames={LANDED - FLIGHT.at}
        layout="none"
      >
        <Html5Audio src={audio('glide')} />
      </Sequence>
    </>
  )
}
```

The shimmer's `volume` callback receives the frame relative to its `<Sequence>`, so it holds 1 until frame 26 and reaches 0 at frame 29, the last frame before the typing starts.

- [ ] **Step 5: Mount it in the ad**

Edit `video/src/Ad.tsx`: old

```tsx
import { Opening } from './scenes/Opening'
```

→ new

```tsx
import { Opening } from './scenes/Opening'
import { Soundtrack } from './Soundtrack'
```

Then Edit the same file: old

```tsx
        <YouNode />
      </AbsoluteFill>
    </AbsoluteFill>
```

→ new

```tsx
        <YouNode />
      </AbsoluteFill>
      <Soundtrack />
    </AbsoluteFill>
```

`<Soundtrack />` sits outside the drifting `AbsoluteFill`: it draws nothing, and the camera has nothing to do with sound.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter video exec tsc --noEmit; echo "exit $?"`
Expected: no errors, `exit 0`.

- [ ] **Step 7: No frame number in the component (Review Focus 3)**

Run: `grep -nE '[0-9]{2,}' video/src/Soundtrack.tsx; echo "exit $?"`
Expected: no match, `exit 1`. Every frame comes from an import; the only numbers left are the typing's rule (2 or 3 frames, probability 0.2, 3 variants) and the shimmer's 4-frame fade.

- [ ] **Step 8: `dev:video` builds the WAVs first (Review Focus 1)**

1. `preview_start` with `{ name: "video" }`. It runs `pnpm --filter video studio --no-open`, which now runs the audio script first.
2. `preview_logs` with `search: "soundtrack:"`. Expected: `soundtrack: 15 WAVs in D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI\video\public\audio (… s)`.
3. `read_console_messages` with `onlyErrors: true`. Expected: none.
4. `preview_stop`, so no process holds the WAVs open during the next step.

- [ ] **Step 9: Render from a clean slate (Review Focus 1)**

Delete the WAVs, as a fresh checkout would lack them, then render. Run in the background (both MP4s take a few minutes):
```bash
rm -rf video/public/audio && pnpm render:video > video/out/render.log 2>&1; echo "exit $?"; grep -a 'soundtrack:' video/out/render.log; ls -l video/out/ad-pt.mp4 video/out/ad-en.mp4
```
Expected: `exit 0`, the `soundtrack: 15 WAVs in …` line, and both MP4s (about 4 MB each) with new timestamps.

- [ ] **Step 10: Audio-only renders**

A `--codec=wav` render gives Remotion's mix without any lossy step, which the sync checks need. Run in the background (about 40 s each):
```bash
for l in pt en; do pnpm --filter video exec remotion render src/index.ts ad-$l out/audio-$l.wav --codec=wav --enforce-audio-track; done; echo "exit $?"; ls -l video/out/audio-pt.wav video/out/audio-en.wav
```
Expected: `exit 0` and two files of 5.8 MB each (1 440 016 stereo 16-bit samples, the last 16 Remotion's padding).

- [ ] **Step 11: Decode the MP4s' AAC**

Run:
```bash
for l in pt en; do pnpm --filter video exec remotion ffmpeg -hide_banner -loglevel error -y -i out/ad-$l.mp4 -vn -c:a pcm_s24le out/aac-$l.wav; done; ls -l video/out/aac-pt.wav video/out/aac-en.wav
```
Expected: no ffmpeg output, and the two files, now replacing Task 1's silent decodes. (The bundled ffmpeg has no float PCM encoder, so the decode is 24-bit.)

- [ ] **Step 12: Measure everything (GREEN)**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
$PY $SP/measure.py video; echo "exit $?"
```
Expected:
```
PASS  sync, music under the effects: the render minus music.wav is 0 LSB before the first effect (max 2)
PASS  sync, one-shots: 17 effects, worst offset 16 samples (max 1600), gains 0.997-1.002
PASS  sync, keys: 23 keys on frames 440-489, gaps [2, 3], worst offset 16 samples, gains 0.998-1.004
PASS  sync, nothing else: after the matches, 0 LSB left (max 8), largest at frame 0
PASS  music, silent edges: first 10 ms -240 dBFS, last 10 ms -90 dBFS (max -60)
PASS  music, no dropout: quietest 400 ms is -26.1 LUFS at 2.0 s (min -40)
PASS  music, bass at the cuts: below 150 Hz, frame 210: onset +0.00 frames, frame 705: onset +0.00 frames
PASS  levels, pt: -15.48 LUFS (-15 ± 1), true peak -1.89 dBTP (max -1)
PASS  levels, en: -15.48 LUFS (-15 ± 1), true peak -1.89 dBTP (max -1)
PASS  levels, mono: folded to mono it loses 0.60 dB (max 3)
PASS  languages: audio-pt.wav and audio-en.wav are sample-identical
11/11 checks pass
exit 0
```
The sync and music lines should match exactly (the WAVs are byte-identical to the ones the design work measured). The levels may differ in the last digit, since each MP4's AAC is encoded separately; they must stay inside −15 ± 1 LUFS and ≤ −1 dBTP. `levels, mono` is Review Focus 4. Task 4 writes the measured levels into the docs, so note the actual numbers.

- [ ] **Step 13: The picture didn't change**

Run (about 2 minutes; give it a 10-minute timeout):
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
mkdir -p video/out/review-after && for l in en pt; do i=1; for f in 75 190 340 500 690 880; do pnpm --filter video exec remotion still src/index.ts ad-$l out/review-after/$l-$i.png --frame=$f; i=$((i+1)); done; done; $PY $SP/measure.py video stills; echo "exit $?"
```
Expected: `PASS  picture: 12 stills (12 expected), changed: none`, `1/1 checks pass`, `exit 0`.

- [ ] **Step 14: Probe the MP4s**

Run:
```bash
for l in pt en; do pnpm --filter video exec remotion ffprobe -v error -show_entries stream=codec_type,codec_name,sample_rate,channels,duration -of compact out/ad-$l.mp4; done
```
Expected per file, in ffprobe's own field order:
- `stream|codec_name=h264|codec_type=video|duration=30.000000|`
- `stream|codec_name=aac|codec_type=audio|sample_rate=48000|channels=2|duration=30.058667` (AAC pads to whole 1024-sample frames)

- [ ] **Step 15: Repo gates**

Run each and read its tail:
```bash
pnpm typecheck; echo "exit $?"
pnpm lint; echo "exit $?"
pnpm format:check; echo "exit $?"
pnpm -r test > video/out/test.log 2>&1; echo "exit $?"; grep -aE 'Tests +[0-9]+' video/out/test.log
```
Expected: `exit 0` four times; Prettier's `All matched files use Prettier code style!`; and the test counts unchanged: app `700 passed (700)`, convex `789 passed (789)`, landing `75 passed (75)`.

- [ ] **Step 16: No commit.** Henriko commits.

---

### Task 4: Docs and memory

**Files:**
- Modify: `docs/PLATFORM.md`:
  - §4's tree (the `├── video/` line)
  - §15A: the opening paragraph, the "One clock" bullet, a new `### Sound` subsection before `### Commands`, the commands block, the paragraph after it, the Mermaid flow, and "Changing the ad" (Timing, and Music → Sound)
  - §18: the `dev:video` / `render:video` row and the `**Video:**` testing line
  - a Last-updated entry, above the Promo video one
- Modify: `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\promo-video.md` and that folder's `MEMORY.md`

Anchor every edit on its text, never on line numbers: other sessions edit this file too. Prose wraps at 120 columns; tables are aligned by display width. If Task 3 Step 12 measured other levels than −15.48 LUFS and −1.89 dBTP, write the measured ones (rounded to one decimal) wherever this task says −15.5 and −1.9.

**Interfaces:**
- Consumes: the finished code from Tasks 2–3 and the numbers Task 3 Step 12 printed.
- Produces: the canonical docs for the sound, and the memory that points future sessions at them.

- [ ] **Step 1: Snapshot the doc, then §15A's opening**

Step 12's width check compares against this copy, so take it before the first edit:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
cp docs/PLATFORM.md "$SP/PLATFORM.before.md"
```

Edit: old

```
A 30-second, silent, square (1080×1080) ad for the LinkedIn feed, in pt-BR and US English. The same files fit the
Instagram and Facebook feeds. [Remotion](https://www.remotion.dev) `4.0.529` draws it with React and renders it
locally; nothing in `video/` is deployed, and the MP4s are uploaded to LinkedIn Campaign Manager by hand. Design and
storyboard: [`docs/superpowers/specs/2026-09-26-promo-video-design.md`](superpowers/specs/2026-09-26-promo-video-design.md).
```

→ new

```
A 30-second, square (1080×1080) ad for the LinkedIn feed, in pt-BR and US English, with music and sound effects
composed in code. It works muted too, since LinkedIn autoplays without sound. The same files fit the Instagram and
Facebook feeds. [Remotion](https://www.remotion.dev) `4.0.529` draws it with React and renders it locally; nothing in
`video/` is deployed, and the MP4s are uploaded to LinkedIn Campaign Manager by hand. Design and storyboard:
[`docs/superpowers/specs/2026-09-26-promo-video-design.md`](superpowers/specs/2026-09-26-promo-video-design.md). Sound:
[`docs/superpowers/specs/2026-09-26-promo-audio-design.md`](superpowers/specs/2026-09-26-promo-audio-design.md).
```

- [ ] **Step 2: "One clock" names the sound's `<Sequence>`s**

Edit: old

```
  positions in `Demo.tsx` (`TAPS`) are computed from the same constants that place the buttons.
```

→ new

```
  positions in `Demo.tsx` (`TAPS`) are computed from the same constants that place the buttons. The only `<Sequence>`s
  are the sound's (`Soundtrack.tsx`, `layout="none"`): they time audio and draw nothing.
```

- [ ] **Step 3: A new "Sound" subsection**

Edit: old

```
  which answered with an HTML page instead of the font.

### Commands
```

→ new

```
  which answered with an HTML page instead of the font.

### Sound

`video/scripts/soundtrack.mjs`, a Node script with no dependencies, synthesizes the music and every effect into
`video/public/audio/*.wav` (48 kHz, 16-bit, stereo). The WAVs are gitignored: `pnpm dev:video` and `pnpm render:video`
rebuild them first, and `pnpm --filter video audio` runs the script alone. Before writing, it checks itself (the music
is exactly 30 s, no sample is `NaN` or infinite, no file peaks over its level), so a failure stops the Studio or the
render before it starts. Its noise is seeded, so every run writes the same bytes.

- **Music** (`music.wav`): D major at about 116 BPM, so both cuts (frames 210 and 705) fall on a bar's first beat. A
  warm pad on Dsus2 rises from silence under the hook and opens up through the promise, and a riser leads into the
  feed. There the beat enters: kick, clap, hats, a pulsing bass and a pluck arpeggio on D, Bm, G and A, twice, the
  second pass fuller. The last bar breathes, and the end card resolves on D over a low impact, then fades out over
  the last 0.5 s.
- **Effects:** `video/src/Soundtrack.tsx` plays each file on the frame of the constant that times its picture, so a
  moved tap takes its sound along. The levels are baked into the files, so everything plays at volume 1 except the
  shimmer, which fades out over its last 4 frames. The keys' gaps and variants come from Remotion's seeded `random()`,
  so every render types the same.

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

- **The one manual coupling.** The script can't import `brand.ts` (font imports) or `Ad.tsx` (JSX), so `FPS`,
  `TOTAL_FRAMES`, `FEED_CUT` (210) and `END_CUT` (705) are repeated at its top with their sources named, next to the
  glide's and the shimmer's lengths (`GLIDE_FRAMES` for `FLIGHT.dur`, `SHIMMER_SECONDS` for `T.generating` to
  `T.typing[0]`). Nothing checks them: a missed cut is heard as a downbeat that misses the scene change.
- **Tuning.** The levels, the harmony and the brightness are constants at the top of the script (`MUSIC_PEAK_DB`,
  `MUSIC_DRIVE_DB`, `PEAK_DB`, `THIRD_DB`, `MIX_DB`, `CUTOFF`, `CHORDS`). On 2026-09-26 the final MP4s measured about
  −15.5 LUFS integrated with a true peak of about −1.9 dBTP, and every effect started within 16 samples (0.3 ms) of
  its frame. After a change, re-render and hold the MP4s to the same targets (−15 ± 1 LUFS, a true peak at or below
  −1 dBTP) with any BS.1770 meter, such as a full ffmpeg's `ebur128=peak=true` filter; Remotion's bundled ffmpeg has
  no filters.

### Commands
```

- [ ] **Step 4: The commands block**

Edit: old

```
pnpm dev:video        # Remotion Studio on http://localhost:3100: pick ad-pt or ad-en, scrub, play
pnpm render:video     # video/out/ad-pt.mp4 + ad-en.mp4: H.264, CRF 18, silent AAC track
```

→ new

```
pnpm dev:video        # the WAVs, then Remotion Studio on http://localhost:3100: pick ad-pt or ad-en, scrub, play
pnpm render:video     # the WAVs, then video/out/ad-pt.mp4 + ad-en.mp4: H.264 (CRF 18) + AAC, 48 kHz stereo
pnpm --filter video audio                                                                # only the WAVs + self-check
```

The new line's `#` sits at index 89, like the two long commands below it.

- [ ] **Step 5: The paragraph after the commands**

Edit: old

```
The first render downloads Chrome Headless Shell (~100 MB) once; later renders run offline. `video/out/` is
gitignored. `video/` has no unit tests: the only logic is timing, so `tsc`, ESLint and a review of the stills are the
checks.
```

→ new

```
The first render downloads Chrome Headless Shell (~100 MB) once; later renders run offline. `video/out/` and
`video/public/audio/` are gitignored. `video/` has no unit tests: the only logic is timing, so `tsc`, ESLint, a review
of the stills and the soundtrack's self-check are the checks.
```

- [ ] **Step 6: The Mermaid flow**

Edit: old

```
    G["landing/components/LogoMark.tsx"] --> Ad
```

→ new

```
    G["landing/components/LogoMark.tsx"] --> Ad
    P["scripts/soundtrack.mjs<br/>synth + self-check"] --> W["public/audio/*.wav<br/>(gitignored)"]
    W --> ST["Soundtrack.tsx<br/>music + effects on their frames"]
    ST --> Ad
```

- [ ] **Step 7: "Changing the ad"**

Edit: old

```
- **Timing.** The frame constants live next to what they time: `T` and `TAPS` in `Demo.tsx`, `RINGS`, `BRIGHTEN`,
  `HOOK_AT`, `HOOK_OUT` and `PROMISE_AT` in `Opening.tsx`, and `LANDED` in `EndCard.tsx`. The node follows `TAPS`, so
  moving a tap moves the node with it.
- **Music.** Drop `video/public/music.mp3` and add `<Html5Audio src={staticFile('music.mp3')} />` inside `Ad` (both
  from `remotion`; `Audio` is the deprecated name). Keep the ad working silent: LinkedIn autoplays muted.
```

→ new

```
- **Timing.** The frame constants live next to what they time: `T` and `TAPS` in `Demo.tsx`, `RINGS`, `BRIGHTEN`,
  `HOOK_AT`, `HOOK_OUT` and `PROMISE_AT` in `Opening.tsx`, `FLIGHT` in `YouNode.tsx`, and `LANDED` and `CTA_AT` in
  `EndCard.tsx`. The node follows `TAPS`, so moving a tap moves the node with it, and every sound effect follows its
  constant the same way.
- **Sound.** The effects follow their constants on their own; the music's form doesn't. A change to a cut (210 or
  705), the length or the frame rate also goes into the constants at the top of `video/scripts/soundtrack.mjs`, and
  so does a new `FLIGHT.dur` or shimmer length, which size the glide and the shimmer ("Sound" above). To tune the
  sound, change the constants there and re-render. Keep the ad working muted: LinkedIn autoplays without sound.
```

- [ ] **Step 8: §4's tree**

Edit: old

```
├── video/                       # Remotion promo ad, 1080×1080, pt + en → video/out/*.mp4 (not deployed, §15A)
```

→ new

```
├── video/                       # Remotion promo ad + sound, 1080×1080, pt + en → video/out/*.mp4 (not deployed, §15A)
```

- [ ] **Step 9: §18's script table**

Edit: old

```
| `dev:video` / `render:video`                   | Remotion Studio on port 3100 / render both ad MP4s into `video/out/` (§15A).        |
```

→ new

```
| `dev:video` / `render:video`                   | Build the WAVs, then Remotion Studio on port 3100 / render both ad MP4s (§15A).     |
```

Both rows are 136 characters with their pipes at 0, 49 and 135, like the rest of the table.

- [ ] **Step 10: §18's testing line**

Edit: old

```
- **Video:** no unit tests (the only logic is timing); `tsc`, ESLint and the reviewed stills are the checks (§15A).
```

→ new

```
- **Video:** no unit tests (the only logic is timing); `tsc`, ESLint, the reviewed stills and the soundtrack script's
  self-check are the checks (§15A).
```

- [ ] **Step 11: The Last-updated entry**

The dates use U+2011 (non-breaking hyphen), as in the entries below it. Edit: old

```
_Last updated: 2026‑09‑26 (Promo video). **A new `video/` workspace renders the 30-second LinkedIn feed ad in pt-BR
```

→ new

```
_Last updated: 2026‑09‑26 (Promo audio). **The promo ad has sound: music and effects composed in code.**
`video/scripts/soundtrack.mjs` (Node, no dependencies) synthesizes a calm D major track, a pad that opens up through
the intro and a light beat from the feed cut to a resolution on the end card, plus 14 sound effects, and writes them
to the gitignored `video/public/audio/` after a self-check; `pnpm dev:video` and `pnpm render:video` run it first, so
a failed check stops them. `video/src/Soundtrack.tsx` plays the music from frame 0 and each effect on the frame of the
constant that times its picture (`T`, `FLIGHT` and the new `CTA_AT` are now exported; no value changed, and the key
stills are pixel-identical). Measured on the final MP4s: about −15.5 LUFS integrated, a true peak of about −1.9 dBTP,
every effect on its frame, and identical PT and EN audio. No app, landing or Convex code changed. Gates:
`pnpm typecheck`, `pnpm lint` and `pnpm format:check` clean; `pnpm -r test` green and unchanged (app 700/700, convex
789/789, landing 75/75). Sections updated: §4, §15A, §18._

---

_Last updated: 2026‑09‑26 (Promo video). **A new `video/` workspace renders the 30-second LinkedIn feed ad in pt-BR
```

- [ ] **Step 12: Check the widths**

Run:
```bash
export PYTHONIOENCODING=utf-8 SP=/c/Users/henri/AppData/Local/Temp/claude/D--ERP-LinkIntoTheSSI-LinkIntoTheSSI/00ade649-c22e-4874-92b5-b97ed30d0b3b/scratchpad PY=/c/Users/henri/AppData/Local/Programs/Python/Python311/python
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
print('sound table:', sorted({len(l) for l in L[s:e] if l.startswith('|') and ('.wav' in l or 'Frame(s)' in l or '|---' in l)}))
print('command #:', [l.index('#') for l in L[s:e] if l.startswith('pnpm ') and '#' in l])
h = chr(0x2011)
print('date:', any(l.startswith('_Last updated: 2026' + h + '09' + h + '26 (Promo audio)') for l in L))
" "$SP/PLATFORM.before.md"
```
Expected:
```
new prose over 120: []
row: 136 [0, 49, 135]
tree: 119
sound table: [118]
command #: [22, 22, 89, 89, 89]
date: True
```
Tables are left out of the first line on purpose: the §18 row is 136 wide like the rest of its table, and the second line checks it.

- [ ] **Step 13: Memory**

Read `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\promo-video.md` first. Edit its description: old

```
description: "video/ (Remotion 4.0.529) renders the 30 s LinkedIn feed ad in pt-BR + EN from landing hero.* and app comment.*/feed.* strings; after changing those keys, tell Henriko the ad needs a re-render and a still review."
```

→ new

```
description: "video/ (Remotion 4.0.529) renders the 30 s LinkedIn feed ad in pt-BR + EN from landing hero.* and app comment.*/feed.* strings, with sound synthesized by video/scripts/soundtrack.mjs; after changing those keys, tell Henriko the ad needs a re-render and a still review; a timeline change also goes into the script's literals."
```

Then Edit the same file: old

```
The final review's 4 deferred minors were declined by Henriko on 2026-09-26 ("nem se incomode"), so don't re-flag
```

→ new

```
Sound (2026-09-26, PLATFORM §15A "Sound", plan `docs/superpowers/plans/2026-09-26-promo-audio.md`):
`video/scripts/soundtrack.mjs` synthesizes `video/public/audio/*.wav` (gitignored, rebuilt by `dev:video` and
`render:video`), and `Soundtrack.tsx` plays each effect on its constant's frame. The one manual coupling: `FPS`,
`TOTAL_FRAMES`, the cuts 210/705, `GLIDE_FRAMES` (`FLIGHT.dur`) and `SHIMMER_SECONDS` are literals at the script's
top, so a timeline change goes there too. Henriko judges the sound by ear; every tweak is a constant. To re-measure,
re-create the plan's Task 1 `measure.py` in the scratchpad (sync by cross-correlation, BS.1770 loudness, true peak,
pixel-identical stills). Traps: the audio-only `--codec=wav` render is 16 samples longer than 30 s and effects start
0-16 samples late (both harmless); the bundled ffmpeg has no `pcm_f32le` encoder (decode to `pcm_s24le`); Pillow
10.1+ `getbbox()` on RGBA only looks at alpha, so compare stills as numpy arrays; the yellow "zod installed 4.4.3,
required 4.5.4" block from every Remotion command is pre-existing and harmless.

The final review's 4 deferred minors were declined by Henriko on 2026-09-26 ("nem se incomode"), so don't re-flag
```

Then Edit `C:\Users\henri\.claude\projects\D--ERP-LinkIntoTheSSI-LinkIntoTheSSI\memory\MEMORY.md` (read it first): old

```
renders are gitignored in `video/out/`.
```

→ new

```
renders are gitignored in `video/out/`. Sound since 2026-09-26: `video/scripts/soundtrack.mjs` → gitignored `video/public/audio/*.wav`; its top repeats FPS, 900 frames and the cuts 210/705 (the one manual coupling); re-measure with the audio plan's `measure.py`.
```

- [ ] **Step 14: No commit.** Henriko commits.

---

### Task 5: Henriko listens (gate)

**Files:** none new. The tuning loop may change constants in `video/scripts/soundtrack.mjs` and the measured numbers in `docs/PLATFORM.md` (§15A "Sound" and the Last-updated entry).

**Interfaces:**
- Consumes: the reviewed MP4s.
- Produces: Henriko's approval of the sound (spec §1, §5 step 9).

Run this task after the executing-plans final review and its fix pass, so Henriko listens to the reviewed build. If the fix pass changed anything that reaches the sound or the picture, first re-run Task 3 Steps 9 to 15.

- [ ] **Step 1: Send the ads and wait (gate)**

SendUserFile `video/out/ad-pt.mp4` and `video/out/ad-en.mp4` (status `normal`, display `attach`) with the caption "Os dois anúncios com som (PT e EN)". Ask in pt-BR: "Ouça no alto-falante do celular e no fone. Aprova o som? Se algo incomodar, me diga o quê e em que segundo (por exemplo: o clique dos toques alto demais em 0:12)." **Wait for an explicit yes.**

- [ ] **Step 2: Tune (only if Henriko asks for changes)**

For each request:
1. Change the constant with Edit (the table below says which).
2. Re-run Task 2 Steps 6, 7 and 10, then Task 3 Steps 9 to 15.
3. If a check fails (say, the loudness leaves −15 ± 1 after an effect got louder), bring it back with `MUSIC_DRIVE_DB` or that effect's `PEAK_DB`, and tell Henriko what moved.
4. Update the measured numbers in §15A "Sound" and in the Last-updated entry.
5. Send the MP4s again (Step 1).

Where each request goes, at the top of `soundtrack.mjs` unless it says otherwise:
- **The music too loud or too soft against the effects:** `MUSIC_PEAK_DB`, and `MUSIC_DRIVE_DB` for loudness at the same peak.
- **One effect too loud or too soft:** its `PEAK_DB` entry.
- **One part of the music too loud or too soft:** its `MIX_DB` entry (`pad`, `pluck`, `echo`, `octave`, `bass`, `kick`, `clap`, `hat`, `riser`, `impact`, `reverb`).
- **Too dark or too bright:** `CUTOFF`.
- **The F# ring's swell:** `THIRD_DB`.
- **A chord or a note:** `CHORDS`, `INTRO`, `ARP`, `BREATH_STRUM`, `FINAL_STRUM`, `SHIMMER_NOTES`.
- **An effect's sound itself:** its function under "Sound effects" (`click`, `tick`, `shimmer`, `ringWithThird`, `plim`, `glide`, `land`, `pop`).

- [ ] **Step 3: Ready to commit**

Tell Henriko in pt-BR that it's ready for their commit, and list what this plan touched:
- new: `video/scripts/soundtrack.mjs`, `video/src/Soundtrack.tsx`, this plan
- changed: `video/package.json`, `video/src/Ad.tsx`, `video/src/YouNode.tsx`, `video/src/scenes/Demo.tsx`, `video/src/scenes/EndCard.tsx`, `.gitignore`, `docs/PLATFORM.md`
- already written: the spec, `docs/superpowers/specs/2026-09-26-promo-audio-design.md`
- gitignored, never committed: `video/public/audio/` and `video/out/`

`video/` as a whole is still untracked (the picture's work isn't committed yet), so git shows all of it as new.

- [ ] **Step 4: No commit.** Henriko commits.
