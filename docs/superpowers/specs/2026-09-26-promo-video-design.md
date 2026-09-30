# Promotional Ad Video (PT + EN) - Design

**Date:** 2026-09-26 · **Status:** storyboard, visual system and technical approach approved in chat by Henriko
(section by section); this written spec awaits his review. No code yet · **Package:** new `video/` workspace, Remotion
`4.0.529` · **Commits:** none - Henriko commits everything himself.

## 0. Decisions locked before this spec

| # | Question         | Decision (Henriko, 2026-09-26)                                                                             |
|---|------------------|------------------------------------------------------------------------------------------------------------|
| 1 | Where it runs    | **LinkedIn feed ad, square 1:1, 1080×1080.** Also usable on Instagram/Facebook feeds.                     |
| 2 | Length           | **30 seconds:** pain → product in action (feed, AI draft, you comment on LinkedIn) → free trial.          |
| 3 | Audio            | **Silent for now.** On-screen text carries the story (LinkedIn autoplays muted). Music can be added later. |
| 4 | Approach         | **Remotion in the monorepo** (`video/`): one animation, the language is a prop, two renders.              |
| 5 | Storyboard       | Approved as in §2, including the fictional mock data.                                                      |
| 6 | Visual + motion  | Approved as in §3.                                                                                         |
| 7 | Technical        | Approved as in §4.                                                                                         |

Defaults taken without asking (each is reversible):

- **Dark theme** (ink-navy, gold, cream). It stands out in LinkedIn's light feed.
- 30 fps (LinkedIn's recommended rate), H.264 + a silent AAC track (LinkedIn's spec lists AAC audio), CRF 18.
- No ES version and no other aspect ratios yet. The `lang` prop and the layout constants keep both one step away.
- The "music slot" is a documented one-line recipe in PLATFORM.md, not code (§6).

## 1. Goal and success criteria

A 30-second, silent, square ad that shows what Link Into The SSI does, in the brand's own look, in pt-BR and US
English.

Done means:

- `video/out/ad-pt.mp4` and `video/out/ad-en.mp4` exist: 1080×1080, 30 fps, 900 frames (30.0 s), H.264, with an AAC
  track.
- Every claim on screen matches the landing and the app today (§2.2), and the trial disclosure is the landing's exact
  text.
- The brand fonts render in every frame, including frame 0 (no fallback-font flash).
- Henriko has approved a still of each scene in both languages before the final render.
- `pnpm typecheck`, `pnpm lint` and `prettier --check` on the new files are clean. `docs/PLATFORM.md` describes the
  package.

## 2. Storyboard

The through-line is **the gold node from the logo, which stands for "you"**. It starts alone and dim, gets noticed,
becomes the finger that taps through the product, and ends by rising into its place above the cut L.

| # | Time        | Frames  | On-screen text                  | What happens                                                                                                                                                                                                                                                                                                            |
|---|-------------|---------|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | 0–3 s       | 0–90    | Hook                            | A dim constellation of cream dots (the people in your field) and one faint gold node. The question rises word by word.                                                                                                                                                                                                  |
| 2 | 3–7 s       | 90–210  | Promise (two lines)             | The node pulses and sends out gold rings. Each dot lights up on the frame the ring reaches it. Line 2 is gold.                                                                                                                                                                                                          |
| 3 | 7–12 s      | 210–360 | Feed caption                    | A mock of the app's dark feed: two or three post cards rise in sequence (avatar, name, headline, text, suggested-reaction emoji + count, comment count, "View on LinkedIn ↗").                                                                                                                                         |
| 4 | 12–17.5 s   | 360–525 | Draft caption                   | The gold node taps the comment button; the comment box opens under the card; tap **Generate with AI** → "Generating…" → the draft types in.                                                                                                                                                                            |
| 5 | 17.5–23.5 s | 525–705 | Handoff line                    | Tap **Copy & comment on LinkedIn**; a neutral "linkedin.com" window (no LinkedIn logo, no copy of their UI) shows the post; the node taps a blue **Comment** button and the comment appears under the post as "You", with the gold-ring avatar.                                                                         |
| 6 | 23.5–30 s   | 705–900 | CTA + URL + fine print          | The L reveals from the bottom up while the node arcs into place: logo + "Link Into The SSI", gold CTA pill (gentle spring), `linkintothessi.com`, and the trial fine print. Holds long enough to read.                                                                                                                 |

Scenes 3 to 5 are one continuous shot: the feed stays on screen, the comment box opens inside it, and the whole view
hands off to the LinkedIn window. Adjacent scenes cross-fade over 12 frames (§3.3).

### 2.1 Copy and where each string comes from

Strings that already exist are **imported**, not copied, so a copy change on the landing or in the app reaches the
ad on the next render.

| Beat           | Source                                                   | EN                                                                    | PT                                                                   |
|----------------|----------------------------------------------------------|-----------------------------------------------------------------------|----------------------------------------------------------------------|
| Hook           | landing `hero.eyebrow`                                   | Good at your work, but few people see it?                             | Você faz um bom trabalho, mas pouca gente vê?                        |
| Promise        | landing `hero.headlineLine1` + `headlineLine2`           | Get noticed on LinkedIn / by the people in your field.                | Apareça no LinkedIn / para as pessoas da sua área.                   |
| Feed caption   | **new**, `video/src/copy.ts`                             | Posts from your field, in one place.                                  | Publicações da sua área, em um só lugar.                             |
| Draft caption  | **new**, `video/src/copy.ts` (mirrors `meta.ogDescription`) | Get an AI draft for your comment.                                  | Receba um rascunho com IA para o seu comentário.                     |
| Handoff line   | landing `hero.subLine2`                                  | You react and comment yourself, on LinkedIn. Nothing is automated.    | Você mesmo reage e comenta, direto no LinkedIn. Nada é automático.   |
| CTA            | landing `hero.cta`                                       | Start my free trial →                                                 | Começar meu teste grátis →                                           |
| Fine print     | landing `hero.ctaDisclaimer`                             | Free for 7 days or your first 50 interactions (made or received)…    | Grátis por 7 dias ou até suas primeiras 50 interações (feitas ou…    |
| URL            | literal                                                  | linkintothessi.com                                                    | linkintothessi.com                                                   |
| Mock UI labels | app `comment.generate`, `comment.generating`, `comment.submit`, `feed.viewOnLinkedIn`, `feed.comment` | Generate with AI · Generating… · Copy & comment on LinkedIn · View on LinkedIn ↗ · Comment | Gerar com IA · Gerando… · Copiar e comentar no LinkedIn · Ver no LinkedIn ↗ · Comentar |

The two new captions follow the landing voice rules: sentence case, no superlatives, no em dashes, pt-BR written
natively.

### 2.2 Claims check

- "Posts from your field, in one place" repeats `hero.subLine1`. "Get an AI draft for your comment" repeats
  `meta.ogDescription`. The handoff line and the disclosure are the landing's own strings.
- Nothing on screen mentions the SSI score, a result, a number of users, or a testimonial. The mock's reaction and
  comment counts are small and belong to fictional posts.
- The flow on screen is the app's real flow: suggested reaction on the button, **Generate with AI**, **Copy & comment
  on LinkedIn**, then the member comments on LinkedIn themselves.
- The LinkedIn window is a plain browser frame with a `linkedin.com` URL pill and a generic post. No LinkedIn logo
  and no imitation of LinkedIn's interface.

### 2.3 Mock data (fictional, lives in `video/src/copy.ts`)

| Item                   | EN                                                                                                                                                  | PT                                                                                                                                                      |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| Card 1 author          | Sarah Mitchell · Head of Sales · B2B SaaS                                                                                                           | Marina Albuquerque · Head de Vendas · SaaS B2B                                                                                                          |
| Card 1 post            | We closed our first enterprise deal this quarter. What helped most was mapping who signs off on the purchase before the first call.                | Fechamos nosso primeiro contrato enterprise neste trimestre. O que mais ajudou foi mapear quem aprova a compra antes da primeira reunião.              |
| Card 1 reaction        | 💡 48 · 12 comments                                                                                                                                 | 💡 48 · 12 comentários                                                                                                                                  |
| Card 2 author + post   | Daniel Brooks · Founder · Fintech: "Three things I'd tell my younger self about pricing a SaaS product:"                                           | Rafael Moreira · Fundador · Fintech: "Três coisas que eu diria para mim mesmo sobre precificar um SaaS:"                                               |
| AI draft               | Mapping who decides before the first call changed our sales cycle too. Did you bring procurement in before or after the pilot?                     | Mapear quem decide antes da primeira reunião mudou nosso ciclo também. Vocês trouxeram compras para a conversa antes ou depois do piloto?               |
| The viewer             | "You", gold-ring avatar                                                                                                                             | "Você", gold-ring avatar                                                                                                                                |

Avatars are initials on the app's avatar style, no photos. A third card sits half below the fold as a skeleton (grey
lines, no text), so the feed reads as a list that keeps going.

## 3. Visual system

### 3.1 Colour (the landing's dark tokens, `landing/app/globals.css`; nothing new)

| Role                       | Value                                                                  |
|----------------------------|------------------------------------------------------------------------|
| Background                 | ink `#0e1320`                                                          |
| Card surfaces / border     | `#161c2b`, `#1c2433` / `#2a3142`                                       |
| Text / secondary / accent  | cream `#f5f0e8` / `#9a9384` / gold-text `#e8c474`                      |
| Node, CTA fill, rings      | gold `#d8a94e` (CTA text `#1c1813`)                                    |
| LinkedIn window accent     | `#0077b5`, handoff scene only                                          |
| Background glows           | gold `rgba(201,150,62,α)` top-left, blue `rgba(0,119,181,α)` bottom-right, α raised to ~0.12–0.18 so compression doesn't erase them |

### 3.2 Type

- Cormorant Garamond 600 for hook (~88px), promise (~96px) and captions (~64px).
- DM Sans for the app mock (the app's sizes scaled ~1.75×) and the fine print (≥ 28px, which is still readable on a
  phone).

### 3.3 Motion

| Element            | Rule                                                                                                   |
|--------------------|--------------------------------------------------------------------------------------------------------|
| Easing             | ease-out `bezier(0.16, 1, 0.3, 1)`. Nothing moves at a constant speed.                                 |
| Word reveal        | Per word: rise 24px, fade in, blur 6px → 0 over 18 frames, 2–3 frame stagger.                         |
| Scene change       | 12-frame cross-fade, outgoing scales 1 → 1.02, incoming 0.98 → 1 (a camera push, not a slide).        |
| UI entrances       | Remotion `spring`, damping 200 (no bounce).                                                            |
| The one overshoot  | The CTA pill: spring damping ~12.                                                                      |
| Tap                | Node scales 1 → 0.85 → 1 over 8 frames and releases a ring (0 → 60px, fading).                        |
| Camera             | Whole frame drifts 1 → 1.03 scale over the 30 s so holds never look frozen.                            |
| Constellation      | ~40 dots at positions from Remotion's seeded `random()`, so every render is identical.                |

### 3.4 Safe area

No text within 90px of an edge. Nothing important in the bottom 100px, where LinkedIn overlays its sound control.

## 4. Architecture

### 4.1 Files

```
video/
  package.json          # remotion, @remotion/cli, @remotion/fonts (4.0.529), react/react-dom 19, @fontsource fonts
  tsconfig.json         # extends ../tsconfig.base.json, jsx react-jsx, noEmit
  src/
    index.ts            # registerRoot(Root)
    Root.tsx            # <Composition id="ad-pt"> and <Composition id="ad-en">: 1080×1080, 30 fps, 900 frames, same component
    Ad.tsx              # the timeline: background + six scenes in overlapping <Sequence>s + cross-fades
    copy.ts             # Record<'pt' | 'en', AdCopy>: landing + app strings (imported) + the 2 new captions + mock data
    brand.ts            # the dark tokens and loadFont() for both families
    scenes/
      Hook.tsx          # scene 1 (shares the constellation with Promise)
      Promise.tsx       # scene 2
      Demo.tsx          # scenes 3-5, one continuous shot
      EndCard.tsx       # scene 6
  out/                  # renders, gitignored
```

- **Language is a prop.** `Root.tsx` registers the same component twice with `defaultProps: { lang }`. `copy.ts` is
  typed `Record<'pt' | 'en', AdCopy>`, so a missing translation fails `tsc`.
- **Logo reuse.** `landing/components/LogoMark.tsx` is imported unchanged and rendered twice, each copy clipped: one
  shows only the L, the other only the node. Each part animates on its own, and no third copy of the path data is
  created.
- **Fonts.** `@remotion/fonts` `loadFont()` with the `.woff2` files imported from `@fontsource/cormorant-garamond`
  (600) and `@fontsource-variable/dm-sans` (the same packages the app uses). `loadFont` blocks the render until the
  font is ready. The latin subset covers every pt-BR accent.

### 4.2 Commands

| Command                      | What it does                                                                                   |
|------------------------------|------------------------------------------------------------------------------------------------|
| `pnpm --filter video studio` | Remotion Studio (live preview) on port 3100, clear of the landing's 3000                       |
| `pnpm --filter video render` | `ad-pt` and `ad-en` → `video/out/*.mp4` with `--crf=18 --enforce-audio-track`                  |
| Root `dev:video` / `render:video` | Aliases, following `dev:landing` / `dev:app`                                              |

The first render downloads Chrome Headless Shell (~100MB) once.

### 4.3 Repo gates

- `pnpm-workspace.yaml` gains `video`. `.gitignore` gains `video/out/`.
- ESLint: `video/src/**/*.{ts,tsx}` joins the React rules block in `eslint.config.js`.
- Root `typecheck` gains `pnpm --filter video exec tsc --noEmit`.
- Prettier runs only on the new files (never `pnpm format`).
- No unit tests: the only logic is timing. The check is `tsc`, the stills and the two renders (§5).
- `.claude/launch.json` gains a `video` entry (port 3100) so the Studio can be previewed in the browser pane. Local
  only, `.claude/` is gitignored.

## 5. Verification

1. **Spike first:** the bundler accepts the cross-package imports (landing JSON, app JSON, `LogoMark.tsx`) and the
   `.woff2` imports. Proof: `remotion still` of frame 0 renders with the brand fonts.
2. `tsc`, ESLint and `prettier --check` clean on `video/`.
3. Stills per language at one frame per scene (≈ 75, 190, 340, 500, 690, 880). I review them, then send them to
   Henriko for approval.
4. Play-through in Studio (browser pane) to check motion and pacing.
5. Final renders. `remotion ffprobe` confirms 1080×1080, 30 fps, 30.0 s, h264 + aac.

## 6. Docs

`docs/PLATFORM.md`:

- A new **§15A Promotional Video (`video/`)** plus its Table-of-Contents entry. It covers what the ad says and where
  each string comes from, the commands, the Remotion license note, how to add music (drop `video/public/music.mp3`,
  add `<Audio src={staticFile('music.mp3')} />` in `Ad.tsx`), and a Mermaid flow: landing/app dictionaries →
  compositions → render → MP4 → LinkedIn Campaign Manager.
- §4 Repository Layout, §18 Tooling (scripts, typecheck), §21 mapping row (`video/**` → §15A), and a Last-updated
  entry.

## 7. Risks and fallbacks

| Risk                                                        | Fallback                                                                                         |
|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Remotion's bundler refuses imports from outside `video/`    | Copy the strings and the logo path into `video/src`, each with a comment naming its source.     |
| `.woff2` import from `node_modules` isn't served            | Copy the two `.woff2` files into `video/public/` and load them with `staticFile()` (the documented way). |
| Remotion license                                            | Free for individuals and companies up to 3 employees. A company license is needed beyond that.  |
| First render needs internet (Chrome Headless Shell download) | One-time. Later renders run offline.                                                             |
| A future landing copy change makes a line too long          | Re-render and review the stills. The render is manual, so it is never shipped unseen.           |

## 8. Out of scope

Other aspect ratios (9:16, 16:9), a Spanish version, music or voiceover, subtitle files, A/B variants, and uploading
to LinkedIn Campaign Manager (Henriko's step).
