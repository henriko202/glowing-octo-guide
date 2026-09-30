import type { CSSProperties } from 'react'
import { ChevronsUpDown, MessageSquare } from 'lucide-react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { C, COL, SANS, SERIF, SIZE, XF } from '../brand'
import type { AdCopy, Post } from '../copy'
import type { Layout } from '../layouts'
import { exitStyle, progress, rise, Words } from '../motion'
import type { Timeline } from '../timelines'

// Fixed layout (px). Every box has a fixed size, so each tap lands on the same pixels in both languages;
// a longer label ellipsizes, as in the app, instead of moving a button.
const B = 2 // border
const PAD = 28 // panel padding
const GAP = 14
const LEFT = COL.x + B + PAD // a panel's inner left edge
const RIGHT = COL.x + COL.w - B - PAD // a panel's inner right edge
const CARD = { top: 270, h: 339, footer: 84, gap: 24, react: 104, comment: 96 }
const BOX = { top: CARD.top + CARD.h + GAP, h: 336, row: 56, combo: 392, gen: 260, text: 128, submit: 460, submitH: 64 }
const WIN = { top: 270, bar: 60, pad: 32, row: 345, rowH: 60, avatar: 48, button: 220, reply: 164 }
const WIN_LEFT = COL.x + B + WIN.pad
const WIN_RIGHT = COL.x + COL.w - B - WIN.pad
const INPUT = { left: WIN_LEFT + WIN.avatar + GAP, right: WIN_RIGHT - WIN.button - GAP }
const ROW_Y = WIN.top + B + WIN.row + WIN.rowH / 2

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

// The mock's text area on its stage: both post cards, before the comment box pushes the second one down. layouts.ts
// checks it against each format's safe zone.
export const MOCK_TEXT = { x: LEFT, y: CARD.top, w: RIGHT - LEFT, h: 2 * CARD.h + CARD.gap }

const panel: CSSProperties = {
  position: 'absolute',
  left: COL.x,
  width: COL.w,
  boxSizing: 'border-box',
  background: C.card,
  border: `${B}px solid ${C.border}`,
  borderRadius: 21,
  overflow: 'hidden',
  fontFamily: SANS,
  color: C.cream
}
const field: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  height: BOX.row,
  padding: '0 21px',
  border: `${B}px solid ${C.border}`,
  borderRadius: 14,
  background: C.input,
  fontSize: 23
}
const clamp3: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
}
const oneLine: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const count: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const bar = (width: number, height: number, marginTop: number) => (
  <div style={{ width, height, marginTop, borderRadius: 999, background: C.cardRaised }} />
)

// Initials on the app's avatar colours; `ring` marks the viewer.
function Avatar({ name, size, ring = false }: { name: string; size: number; ring?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.accent,
        color: C.goldText,
        fontFamily: SANS,
        fontSize: size * 0.35,
        fontWeight: 600,
        boxShadow: ring ? `0 0 0 4px ${C.gold}` : undefined
      }}
    >
      {name
        .split(' ')
        .map(word => word[0])
        .join('')}
    </div>
  )
}

function Author({ post }: { post: Post }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <Avatar
        name={post.name}
        size={70}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 25, fontWeight: 600 }}>{post.name}</div>
        <div style={{ ...oneLine, fontSize: 21, color: C.muted }}>{post.headline}</div>
      </div>
    </div>
  )
}

// A feed card as the app draws it: author, text, then the suggested reaction, the comment button and the link.
function Card({ post, link, top, style }: { post: Post; link: string; top: number; style: CSSProperties }) {
  return (
    <div style={{ ...panel, top, height: CARD.h, padding: PAD, ...style }}>
      <Author post={post} />
      <div style={{ ...clamp3, marginTop: 20, fontSize: 26, lineHeight: 1.45 }}>{post.text}</div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: CARD.footer,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${PAD}px`,
          borderTop: `${B}px solid ${C.border}`,
          fontSize: 23,
          color: C.muted
        }}
      >
        <span style={{ width: CARD.react, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28 }}>{post.emoji}</span>
          <span style={count}>{post.reactions}</span>
        </span>
        <span
          style={{
            width: CARD.comment,
            marginLeft: GAP,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <MessageSquare size={28} />
          <span style={count}>{post.comments}</span>
        </span>
        <span style={{ marginLeft: 'auto', color: C.goldText }}>{link}</span>
      </div>
    </div>
  )
}

// The cards after the two posts, half below the fold or further (the layout sets how many): grey bars and no text,
// so the feed reads as a list that keeps going.
function Skeleton({ top, style }: { top: number; style: CSSProperties }) {
  return (
    <div style={{ ...panel, top, height: CARD.h, padding: PAD, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 70, height: 70, borderRadius: '50%', background: C.cardRaised }} />
        <div>
          {bar(260, 22, 0)}
          {bar(180, 18, 12)}
        </div>
      </div>
      {bar(760, 20, 28)}
      {bar(640, 20, 14)}
    </div>
  )
}

// The app's comment box: language, Generate with AI, the draft, then Copy & comment on LinkedIn.
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
  return (
    <div
      style={{
        ...panel,
        top: BOX.top,
        height: BOX.h,
        padding: PAD,
        opacity: Math.min(1, open * 2),
        clipPath: `inset(0 0 ${(1 - open) * 100}% 0 round 21px)`
      }}
    >
      <div style={{ display: 'flex', gap: GAP }}>
        <div style={{ ...field, width: BOX.combo, gap: 10 }}>
          <span style={{ ...oneLine, flex: 1 }}>{copy.ui.languageAuto}</span>
          <ChevronsUpDown
            size={24}
            style={{ flexShrink: 0, opacity: 0.5 }}
          />
        </div>
        <div
          style={{
            ...field,
            width: BOX.gen,
            justifyContent: 'center',
            fontWeight: 600,
            opacity: generating ? 0.5 : 1
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          ...field,
          height: BOX.text,
          marginTop: GAP,
          padding: '14px 18px',
          alignItems: 'flex-start',
          lineHeight: 1.45
        }}
      >
        {/* One block child, so the caret flows at the end of the text instead of becoming a flex item. */}
        <div>
          {copy.draft.slice(0, typed)}
          {caret && (
            <span
              style={{
                display: 'inline-block',
                width: 3,
                height: 26,
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                background: C.gold
              }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: PAD,
          bottom: PAD,
          width: BOX.submit,
          height: BOX.submitH,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: C.gold,
          color: C.ink,
          fontSize: 23,
          fontWeight: 600
        }}
      >
        {copy.ui.submit}
      </div>
    </div>
  )
}

// A plain browser window on linkedin.com: a URL pill and a generic post. No LinkedIn logo, none of LinkedIn's UI.
function LinkedInWindow({ copy, timeline }: { copy: AdCopy; timeline: Timeline }) {
  const f = useCurrentFrame()
  const t = moments(timeline)
  if (f < t.window) return null
  const s = rise(f, t.window)
  const posted = progress(f, t.posted, 20)
  const pasted = f >= t.pasted && f < t.posted
  const post = copy.posts[0]
  return (
    <div
      style={{
        ...panel,
        top: WIN.top,
        height: 2 * B + WIN.row + WIN.rowH + WIN.pad + posted * (24 + WIN.reply),
        background: C.cardRaised,
        opacity: s,
        transform: `translateY(${(1 - s) * 60}px) scale(${0.96 + 0.04 * s})`,
        transformOrigin: '50% 0',
        boxShadow: '0 40px 80px rgba(0, 0, 0, 0.45)'
      }}
    >
      <div
        style={{
          position: 'relative',
          height: WIN.bar,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 24px',
          background: C.card
        }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{ width: 14, height: 14, borderRadius: '50%', background: C.border }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 28px',
            borderRadius: 999,
            background: C.ink,
            color: C.muted,
            fontSize: 21
          }}
        >
          linkedin.com
        </div>
      </div>
      <div style={{ padding: `${WIN.pad}px ${WIN.pad}px 0` }}>
        <Author post={post} />
        <div style={{ ...clamp3, marginTop: 20, fontSize: 26, lineHeight: 1.45 }}>{post.text}</div>
        <div style={{ height: B, marginTop: 24, background: C.border }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: WIN.row,
          left: WIN.pad,
          right: WIN.pad,
          height: WIN.rowH,
          display: 'flex',
          alignItems: 'center',
          gap: GAP
        }}
      >
        <Avatar
          name={copy.you}
          size={WIN.avatar}
          ring
        />
        <div
          style={{
            ...field,
            flex: 1,
            minWidth: 0,
            height: WIN.rowH,
            borderRadius: WIN.rowH / 2,
            border: `${B}px solid ${pasted ? C.gold : C.border}`
          }}
        >
          {pasted && <span style={oneLine}>{copy.draft}</span>}
        </div>
        <div
          style={{
            width: WIN.button,
            height: WIN.rowH,
            flexShrink: 0,
            borderRadius: WIN.rowH / 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: C.lnBlue,
            color: C.cream,
            fontSize: 23,
            fontWeight: 600
          }}
        >
          {copy.ui.comment}
        </div>
      </div>
      {posted > 0 && (
        <div
          style={{
            position: 'absolute',
            top: WIN.row + WIN.rowH + 24,
            left: WIN.pad,
            right: WIN.pad,
            height: WIN.reply,
            display: 'flex',
            gap: GAP,
            opacity: posted,
            transform: `translateY(${(1 - posted) * 16}px)`
          }}
        >
          <Avatar
            name={copy.you}
            size={WIN.avatar}
            ring
          />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              alignSelf: 'flex-start',
              padding: '14px 20px',
              borderRadius: 18,
              background: C.card,
              fontSize: 23,
              lineHeight: 1.45
            }}
          >
            <div style={{ fontWeight: 600 }}>{copy.you}</div>
            <div style={clamp3}>{copy.draft}</div>
          </div>
        </div>
      )}
    </div>
  )
}

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
        lineHeight: 1.1,
        color: C.cream,
        textWrap: 'balance',
        ...exitStyle(frame, out)
      }}
    >
      <div>
        <Words
          text={text}
          start={at}
        />
      </div>
    </div>
  )
}

export function Demo({ copy, layout, timeline }: { copy: AdCopy; layout: Layout; timeline: Timeline }) {
  const f = useCurrentFrame()
  const t = moments(timeline)
  const { cards, captions } = timeline.demo
  const open = rise(f, t.boxOpen)
  const push = open * (BOX.h + GAP) // the open comment box pushes the cards below it down
  const dim = progress(f, t.dim, 20)
  const enter = (i: number): CSSProperties => {
    const s = rise(f, cards[i])
    return { opacity: s, transform: `translateY(${(1 - s) * 80}px)` }
  }
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
          {f >= t.boxOpen && (
            <CommentBox
              copy={copy}
              open={open}
              timeline={timeline}
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
    </AbsoluteFill>
  )
}
