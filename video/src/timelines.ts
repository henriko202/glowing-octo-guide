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
