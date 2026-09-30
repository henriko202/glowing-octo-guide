import { SIZE } from './brand'
import { MOCK_TEXT } from './scenes/Demo'
import { FINE_PRINT_LINE } from './scenes/EndCard'
import { LENGTHS, TIMELINES } from './timelines'
import { nodeStops } from './YouNode'

// The ad's four shapes: the square for the LinkedIn feed, 16:9 for YouTube in-stream ads, 9:16 for Shorts, Reels,
// Stories and TikTok, and 4:5 for the Facebook Feed. Each composition is one language in one format and one length
// (Root.tsx).
export const FORMATS = ['1x1', '16x9', '9x16', '4x5'] as const
export type Format = (typeof FORMATS)[number]
type Box = { x: number; y: number; w: number; h: number }
type Point = { x: number; y: number }
type TextAt = { top: number; size: number }
export type Layout = {
  width: number
  height: number
  zone: Box // where text and taps may go; stricter platform readings still reach into it (PLATFORM §15A)
  stage: Point // the mock's origin: it draws in the square's 1080×1080 coordinates (Demo.tsx)
  home: Point // the gold node's home in the Opening
  // `dots`: one per ~12,580 px² of makeDots()' free area (Opening.tsx), the density of the square and the 9:16
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
  // text column away from the side icons, and 740 px on the end card so the EN fine print stays left of AdCheckLab's
  // x 940 with the camera drift. Meta keeps the top 14% and the bottom 35%; the sides come from TikTok.
  '9x16': {
    width: 1080,
    height: 1920,
    zone: { x: 120, y: 270, w: 840, h: 978 },
    stage: { x: 0, y: 230 },
    home: { x: 540, y: 480 },
    opening: { box: { x: 130, y: 680, w: 820, h: 450 }, hook: 88, promise: 96, dots: 70 },
    caption: { box: { x: 130, y: 330, w: 820, h: 160 }, size: 64, align: 'center' },
    skeletons: 2,
    endCard: {
      x: 170,
      w: 740,
      logo: { top: 420, h: 200 },
      title: { top: 650, size: 60 },
      cta: { top: 758, size: 34 },
      url: { top: 890, size: 30 },
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
    caption: { box: { x: 110, y: 145, w: 860, h: 160 }, size: 64, align: 'center' },
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

// The safe-zone check, at load like copy.ts's two-sentence check: every text box, the mock's text area, the node's
// home and every stop on its path under every timeline must sit inside the format's zone, or the Studio and every
// render stop here. It leaves out the camera drift, the text inside each box, the flight's arc and the gray cards.
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
    ...LENGTHS.flatMap(length =>
      nodeStops(layout, TIMELINES[length]).map((stop): [string, Box] => [
        `node stop at frame ${stop.at} of the ${length}`,
        point(stop)
      ])
    )
  ]
  for (const [name, box] of items) {
    if (!inside(box, zone)) {
      throw new Error(`${format}: ${name} (${describe(box)}) is outside the safe zone (${describe(zone)})`)
    }
  }
}
