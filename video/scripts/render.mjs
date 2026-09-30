// Renders the ad to video/out/<id>.mp4: every composition Root.tsx registers, or only the ids given. `pnpm render`
// runs it after the audio.
//
//   pnpm render:video                                all of them, one after another
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
