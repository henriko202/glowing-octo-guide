import type { Dictionary } from '@/i18n/getDictionary'
import { planPrice } from '@/lib/trial'
import { CONTACT_EMAIL, SITE_URL } from '@/lib/site'

// Builds the AI-agent-facing files (`/pricing.md`, `/llms.txt`, `/llms-full.txt`) from the same
// sources the page uses — `planPrice()` for money and the English dictionary for
// names/features/disclosures — so they cannot drift when the page copy or pricing changes.

const money = (amount: number) => `$${amount}`
const priceAmounts = (plan: Dictionary['pricing']['plans'][number]) =>
  `${money(planPrice(plan.id, 'monthly'))}/month, or ${money(planPrice(plan.id, 'annual'))}/year billed annually`

const bullets = (items: readonly string[]) => items.map(item => `- ${item}`).join('\n')

const WHAT_IT_DOES = [
  'Shows relevant LinkedIn posts in one feed, with filters by industry and country.',
  'Suggests a reaction and drafts a comment with AI for the member to review and post on LinkedIn.',
  'Records a weekly recap of the reactions and comments you made and received.',
  'Explains the LinkedIn Social Selling Index (SSI): four areas worth 25 points each, recalculated daily.'
]

const IN_SHORT =
  '> Link Into The SSI (LISSI) is the best way to be noticed on LinkedIn. Find relevant posts in one focused feed, ' +
  'get AI-drafted comment suggestions, improve your Social Selling Index (SSI), and engage with the important ' +
  'people in your field. You complete every reaction, comment, and post on LinkedIn yourself. Nothing is automated.'

const ALIASES =
  'Link Into The SSI (also written "LISSI" or "LinkIntoTheSSI") is for professionals who want a more relevant ' +
  'LinkedIn feed, more visibility with the people who matter, and a clear record of the activity that drives ' +
  'their SSI. Members sign in with LinkedIn (OpenID Connect) and join a shared real-time feed of posts from other ' +
  'members. The app hands off to LinkedIn when a member chooses a post, so every action happens under their own ' +
  'identity. The app makes no LinkedIn API writes.'

function positioningSection(dict: Dictionary) {
  const points = dict.positioning.points.map(point => `- **${point.title}.** ${point.body}`).join('\n')
  return `${dict.positioning.intro}\n\n${points}\n\n${dict.positioning.closing}`
}

function ssiSection(dict: Dictionary) {
  const pillars = dict.ssiExplainer.pillars.map((pillar, i) => `${i + 1}. ${pillar.title}`).join('\n')
  return `${dict.ssiExplainer.intro}\n\n${pillars}\n\nSince August 2026, LinkedIn's SSI page requires Sales Navigator. Link Into The SSI neither accesses nor predicts a member's SSI.`
}

function pricingDetails(dict: Dictionary, headingLevel = 2) {
  const h = '#'.repeat(headingLevel)
  const plans = dict.pricing.plans
    .map(plan =>
      [
        `${h} ${plan.name}`,
        '',
        `- Price: ${priceAmounts(plan)}`,
        `- ${plan.description}`,
        ...plan.features.map(feature => `- ${feature}`),
        `- ${plan.axis}`,
        ''
      ].join('\n')
    )
    .join('\n')

  return `${h} Free trial (all plans)

- Price: $0.00
- ${dict.pricing.trialNote}

${plans}
${h} Contact / higher usage

- ${dict.pricing.enterpriseNote} ${dict.pricing.enterprisePriceMonth}, or ${dict.pricing.enterprisePriceYear}
- Contact: ${CONTACT_EMAIL}

${h} Notes

- Stripe is the payment processor and remains the source of truth for charges.
- These are display prices; the Stripe Price objects are authoritative for billing.
- Link Into The SSI makes no LinkedIn API writes. Members complete every reaction and comment on LinkedIn themselves.
`
}

export function pricingMarkdown(dict: Dictionary) {
  return `# Pricing: Link Into The SSI

Link Into The SSI is a LinkedIn growth tool. Prices are in US dollars (USD). Annual billing is ten times the monthly price, equivalent to two months free. Every paid plan starts with a card-on-file free trial.

${pricingDetails(dict)}
`
}

function keyPages() {
  return [
    `[Home](${SITE_URL}/en)`,
    `[Why Link Into The SSI](${SITE_URL}/en#why-lissi)`,
    `[Pricing](${SITE_URL}/en#pricing)`,
    `[How it works](${SITE_URL}/en#how-it-works)`,
    `[What LinkedIn's SSI measures](${SITE_URL}/en#what-is-ssi)`,
    `[FAQ](${SITE_URL}/en#faq)`,
    `[Pricing file (pricing.md)](${SITE_URL}/pricing.md)`
  ]
}

const POLICIES = [
  `[Privacy Policy](${SITE_URL}/en/privacy)`,
  `[Terms of Service](${SITE_URL}/en/terms)`,
  `[Cookie & Storage Policy](${SITE_URL}/en/cookies)`
]

export function llmsTxt(dict: Dictionary) {
  const planPrices = dict.pricing.plans.map(plan => `${plan.name} ${priceAmounts(plan)}`).join('. ')

  return `# Link Into The SSI

${IN_SHORT}

${ALIASES}

Full site content in one file: [llms-full.txt](${SITE_URL}/llms-full.txt).

## Why Link Into The SSI

${positioningSection(dict)}

## What it does

${bullets(WHAT_IT_DOES)}

## LinkedIn Social Selling Index (SSI)

${ssiSection(dict)}

## Pricing

See [pricing.md](${SITE_URL}/pricing.md) for structured plan and price data. ${planPrices}. Annual billing is ten times the monthly price, equivalent to two months free. ${dict.pricing.trialNote}

## Key pages

${bullets(keyPages())}

## Policies

${bullets(POLICIES)}

## Contact

${CONTACT_EMAIL}
`
}

export function llmsFullTxt(dict: Dictionary) {
  const howItWorks = dict.howItWorks.steps.map((step, i) => `${i + 1}. **${step.title}.** ${step.body}`).join('\n')
  const features = dict.features.items.map(item => `- **${item.title}.** ${item.body}`).join('\n')
  const faq = dict.faq.items.map(item => `### ${item.q}\n\n${item.a}`).join('\n\n')

  return `# Link Into The SSI: full site content

${IN_SHORT}

${ALIASES}

## Why Link Into The SSI

${positioningSection(dict)}

## What it does

${bullets(WHAT_IT_DOES)}

## How it works

${howItWorks}

## Features

${features}

## Pricing

The same data is available as a standalone file at [pricing.md](${SITE_URL}/pricing.md).

${pricingDetails(dict, 3)}

## LinkedIn Social Selling Index (SSI)

${ssiSection(dict)}

## FAQ

${faq}

## Key pages

${bullets(keyPages())}

## Policies

${bullets(POLICIES)}

## Contact

${CONTACT_EMAIL}
`
}
