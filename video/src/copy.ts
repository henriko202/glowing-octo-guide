import appEn from '../../app/src/i18n/locales/en.json'
import appPt from '../../app/src/i18n/locales/pt.json'
import landingEn from '../../landing/i18n/dictionaries/en.json'
import landingPt from '../../landing/i18n/dictionaries/pt.json'

export const LANGS = ['pt', 'en'] as const
export type Lang = (typeof LANGS)[number]

// Only the keys the ad reads.
type LandingStrings = {
  hero: {
    eyebrow: string
    headlineLine1: string
    headlineLine2: string
    subLine2: string
    cta: string
    ctaDisclaimer: string
  }
}
type AppStrings = {
  comment: { generate: string; generating: string; regenerate: string; submit: string; languageAuto: string }
  feed: { viewOnLinkedIn: string; comment: string }
}

export type Post = { name: string; headline: string; text: string; emoji: string; reactions: number; comments: number }

export type AdCopy = {
  hook: string
  promise: [string, string]
  feedCaption: string
  draftCaption: string
  handoff: [string, string]
  cta: string
  finePrint: string
  ui: AppStrings['comment'] & AppStrings['feed']
  you: string
  posts: [Post, Post]
  draft: string
}

// The handoff shows landing hero.subLine2 one sentence at a time.
function sentences(line: string): [string, string] {
  const parts = line.split(/(?<=\.) /)
  if (parts.length !== 2) throw new Error(`Expected two sentences in "${line}"`)
  return [parts[0], parts[1]]
}

// Every string that already exists on the landing or in the app comes from its dictionary, so a copy change there
// reaches the ad on the next render.
function fromSources(
  { hero }: LandingStrings,
  { comment, feed }: AppStrings
): Pick<AdCopy, 'hook' | 'promise' | 'handoff' | 'cta' | 'finePrint' | 'ui'> {
  return {
    hook: hero.eyebrow,
    promise: [hero.headlineLine1, hero.headlineLine2],
    handoff: sentences(hero.subLine2),
    cta: hero.cta,
    finePrint: hero.ctaDisclaimer,
    ui: {
      generate: comment.generate,
      generating: comment.generating,
      regenerate: comment.regenerate,
      submit: comment.submit,
      languageAuto: comment.languageAuto,
      viewOnLinkedIn: feed.viewOnLinkedIn,
      comment: feed.comment
    }
  }
}

// The mock posts are fictional; their counts are the same in both languages.
const STATS = [
  { emoji: '💡', reactions: 48, comments: 12 },
  { emoji: '👍', reactions: 31, comments: 7 }
] as const

export const COPY: Record<Lang, AdCopy> = {
  pt: {
    ...fromSources(landingPt, appPt),
    feedCaption: 'Publicações da sua área, em um só lugar.',
    draftCaption: 'Receba um rascunho com IA para o seu comentário.',
    you: 'Você',
    posts: [
      {
        name: 'Marina Albuquerque',
        headline: 'Head de Vendas · SaaS B2B',
        // \u00a0 (a non-breaking space) keeps a lone word off a line end at the card's width, here and in `en`.
        text: 'Fechamos nosso primeiro contrato enterprise neste trimestre. O\u00a0que mais ajudou foi mapear quem aprova a compra antes da primeira reunião.',
        ...STATS[0]
      },
      {
        name: 'Rafael Moreira',
        headline: 'Fundador · Fintech',
        text: 'Três coisas que eu diria para mim mesmo sobre precificar um SaaS:',
        ...STATS[1]
      }
    ],
    draft:
      'Mapear quem decide antes da primeira reunião mudou nosso ciclo também. Vocês trouxeram compras para a conversa antes ou depois do piloto?'
  },
  en: {
    ...fromSources(landingEn, appEn),
    feedCaption: 'Posts from your field, in one place.',
    draftCaption: 'Get an AI draft for your comment.',
    you: 'You',
    posts: [
      {
        name: 'Sarah Mitchell',
        headline: 'Head of Sales · B2B SaaS',
        text: 'We closed our first enterprise deal this quarter. What helped most was mapping who signs off on the purchase before the first\u00a0call.',
        ...STATS[0]
      },
      {
        name: 'Daniel Brooks',
        headline: 'Founder · Fintech',
        text: "Three things I'd tell my younger self about pricing a SaaS product:",
        ...STATS[1]
      }
    ],
    draft:
      'Mapping who decides before the first call changed our sales cycle too. Did you bring procurement in before or after the pilot?'
  }
}
