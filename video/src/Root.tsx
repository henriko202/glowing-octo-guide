import { Composition } from 'remotion'
import { Ad } from './Ad'
import { LANGS } from './copy'
import { type Format, LAYOUTS } from './layouts'
import { FPS, type Length, TIMELINES } from './timelines'

// Which length each format comes in (PLATFORM §15A "Lengths").
const CUTS: [Format, Length][] = [
  ['1x1', '30s'], // LinkedIn
  ['16x9', '30s'], // YouTube in-stream
  ['9x16', '30s'], // YouTube Shorts and TikTok
  ['4x5', '15s'], // Facebook Feed
  ['9x16', '15s'], // Instagram Feed, Reels and Stories
  ['16x9', '15s'] // Facebook and YouTube in-stream
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
