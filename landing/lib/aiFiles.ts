import type { Dictionary } from '@/i18n/getDictionary'
import { planPrice } from '@/lib/trial'
import { CONTACT_EMAIL, SITE_URL } from '@/lib/site'

// Builds the AI-agent-facing files (`/pricing.md`, `/llms.txt`) from the same sources the page
// uses — `planPrice()` for money and the English dictionary for names/features/disclosures — so
// they cannot drift when pricing changes.

const money = (amount: number) => `$${amount}`
const priceAmounts = (plan: Dictionary['pricing']['plans'][number]) =>
  `${money(planPrice(plan.id, 'monthly'))}/month, or ${money(planPrice(plan.id, 'annual'))}/year billed annually`

export function pricingMarkdown(dict: Dictionary) {
  const plans = dict.pricing.plans
    .map(plan =>
      [
        `## ${plan.name}`,
        '',
        `- Price: ${priceAmounts(plan)}`,
        `- ${plan.description}`,
        ...plan.features.map(feature => `- ${feature}`),
        `- ${plan.axis}`,
        ''
      ].join('\n')
    )
    .join('\n')

  return `# Pricing — Link Into The SSI

Link Into The SSI is a LinkedIn growth tool. Prices are in US dollars (USD). Annual billing is ten times the monthly price, equivalent to two months free. Every paid plan starts with a card-on-file free trial.

## Free trial (all plans)

- Price: $0.00
- ${dict.pricing.trialNote}

${plans}
## Contact / higher usage

- ${dict.pricing.enterpriseNote} ${dict.pricing.enterprisePriceMonth}, or ${dict.pricing.enterprisePriceYear}
- Contact: ${CONTACT_EMAIL}

## Notes

- Stripe is the payment processor and remains the source of truth for charges.
- These are display prices; the Stripe Price objects are authoritative for billing.
- Link Into The SSI makes no LinkedIn API writes. Members complete every reaction and comment on LinkedIn themselves.
`
}

export function llmsTxt(dict: Dictionary) {
  const planPrices = dict.pricing.plans.map(plan => `${plan.name} ${priceAmounts(plan)}`).join('. ')
  const pillars = dict.ssiExplainer.pillars.map((pillar, i) => `${i + 1}. ${pillar.title}`).join('\n')

  return `# Link Into The SSI

> Link Into The SSI is a LinkedIn growth tool that helps members find relevant LinkedIn posts in one focused feed, get AI-drafted comment suggestions, and understand their LinkedIn Social Selling Index (SSI). Every reaction, comment, and post is completed by the member on LinkedIn itself. Nothing is automated.

Link Into The SSI (also written "LinkIntoTheSSI") is for professionals who want a more relevant LinkedIn feed and a clearer view of their SSI-driving activity. Members sign in with LinkedIn (OpenID Connect), join a shared real-time feed of posts from other members, and choose which conversations to join. When a member decides to engage, the app hands off to LinkedIn so the action happens under the member's own identity. The app makes no LinkedIn API writes.

## What it does

- Surfaces relevant LinkedIn posts in one focused feed, with optional filters by industry and country.
- Suggests a reaction and drafts a comment with AI, which the member reviews and posts themselves on LinkedIn.
- Records a weekly recap of the reactions and comments a member made and received.
- Explains the LinkedIn Social Selling Index (SSI): four areas, 25 points each, recalculated daily.

## LinkedIn Social Selling Index (SSI)

${dict.ssiExplainer.intro}

${pillars}

Since August 2026, LinkedIn's SSI page requires Sales Navigator. Link Into The SSI neither accesses nor predicts a member's SSI.

## Pricing

See [pricing.md](${SITE_URL}/pricing.md) for structured plan and price data. ${planPrices}. Annual billing is ten times the monthly price, equivalent to two months free. ${dict.pricing.trialNote}

## Key pages

- [Home](${SITE_URL}/en)
- [Pricing](${SITE_URL}/en#pricing)
- [How it works](${SITE_URL}/en#how-it-works)
- [What LinkedIn's SSI measures](${SITE_URL}/en#what-is-ssi)
- [FAQ](${SITE_URL}/en#faq)

## Policies

- [Privacy Policy](${SITE_URL}/en/privacy)
- [Terms of Service](${SITE_URL}/en/terms)
- [Cookie & Storage Policy](${SITE_URL}/en/cookies)

## Contact

${CONTACT_EMAIL}
`
}
