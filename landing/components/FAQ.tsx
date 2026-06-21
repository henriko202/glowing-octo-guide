'use client'
import { useState } from 'react'

const FAQS = [
  {
    q: 'Is this safe? Will LinkedIn penalize me?',
    a: 'Yes. You sign in through LinkedIn’s official OAuth, you choose what to engage with, and you write your own comments. Nothing acts on your behalf, so you stay within LinkedIn’s Terms of Service.'
  },
  {
    q: 'How is this different from automation or spam?',
    a: 'You stay in control at all times. We surface relevant posts and make engaging fast, but every action needs your intent. No bots, no bulk actions, no auto-posting.'
  },
  {
    q: 'What does the free trial include, and when am I charged?',
    a: 'You get the full Growth-level experience. A card is required to start, but you are not charged until you’ve had 50 interactions (made or received) or 7 days pass, whichever comes first. Cancel anytime before then and you pay nothing.'
  },
  {
    q: 'What is SSI, and how fast will it move?',
    a: 'Your Social Selling Index is LinkedIn’s 0–100 measure of how findable you are. You can check your real score on LinkedIn anytime. Most members see it move within 1–2 weeks of consistent engagement. Results vary with how active you are and where you start.'
  },
  {
    q: 'Do I need to be active every day?',
    a: 'No. A few minutes a few times a week beats occasional marathons. Small, regular interactions are what move your SSI.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no lock-in, no cancellation fees. Cancel from your account settings in one click; access lasts until the end of the current period.'
  }
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section
      id="faq"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">FAQ</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">Common questions</h2>
        </div>

        <div className="divide-y divide-ink-600">
          {FAQS.map((faq, i) => (
            <div key={faq.q}>
              <button
                id={`faq-btn-${i}`}
                aria-controls={`faq-panel-${i}`}
                aria-expanded={openIndex === i}
                className="flex w-full items-center justify-between gap-6 py-6 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-base font-medium text-cream">{faq.q}</span>
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 font-display text-2xl text-gold transition-transform duration-200"
                  style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)' }}
                >
                  +
                </span>
              </button>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-btn-${i}`}
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: openIndex === i ? '600px' : '0px' }}
              >
                <p className="pb-6 text-sm leading-relaxed text-cream/50">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
