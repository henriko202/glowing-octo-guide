import cormorant600 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2'
import dmSans from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2'
import { loadFont } from '@remotion/fonts'
import { Easing } from 'remotion'

// The landing's dark tokens (landing/app/globals.css) plus the app's dark card, input and avatar tokens.
export const C = {
  ink: '#0e1320',
  card: '#161c2b',
  cardRaised: '#1c2433',
  border: '#2a3142',
  cream: '#f5f0e8',
  muted: '#9a9384',
  goldText: '#e8c474',
  gold: '#d8a94e',
  onGold: '#1c1813',
  accent: '#2a2418',
  input: 'rgba(42, 49, 66, 0.3)',
  lnBlue: '#0077b5'
}
export const SERIF = '"Cormorant Garamond", Georgia, serif'
export const SANS = '"DM Sans", system-ui, sans-serif'

// loadFont holds every frame until its font is ready and fails the render if the font can't load,
// so no frame is ever drawn in a fallback font.
void loadFont({ family: 'Cormorant Garamond', url: cormorant600, weight: '600' })
void loadFont({ family: 'DM Sans', url: dmSans, weight: '100 1000' })

// The square's side, and the side of the stage the mock draws on in every format (layouts.ts).
export const SIZE = 1080
export const XF = 12 // cross-fade length, in frames
export const EASE = Easing.bezier(0.16, 1, 0.3, 1)
// The mock's column on its stage. In the square, 110px side margins keep text 90px from the edges even at the end of
// the 1.03 camera drift.
export const COL = { x: 110, w: 860 }
