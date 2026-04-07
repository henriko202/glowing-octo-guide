'use client'
import { useState } from 'react'

const FAQS = [
  {
    q: 'What is LinkedIn SSI and how is it calculated?',
    a: "Your Social Selling Index (SSI) is a score from 0–100 that LinkedIn updates daily. It's calculated across four equal pillars: establishing your professional brand, finding the right people, engaging with insights, and building relationships. Each pillar contributes 25 points to your total."
  },
  {
    q: 'Is Link Into The SSI safe? Will LinkedIn penalize me?',
    a: "Yes — completely. We connect via LinkedIn's official OAuth, and every interaction is genuine: you choose what to engage with, and you write your own comments. There is no automation acting on your behalf, so you stay fully within LinkedIn's Terms of Service."
  },
  {
    q: 'How is this different from automation or spamming?',
    a: 'You stay in control at all times. The platform surfaces relevant content and makes engagement fast and easy — but every action requires your intent. No bots, no auto-generated text, no bulk actions. Think of it as a well-organised feed of opportunities to engage authentically.'
  },
  {
    q: 'How quickly will I see my SSI improve?',
    a: 'Most members see their first SSI movement within 1–2 weeks of consistent engagement. Our members average +8 SSI points in their first 30 days. Results vary based on how active you are and your starting score.'
  },
  {
    q: 'Do I need to be active every day?',
    a: 'No. Our most consistent members spend around 3 minutes a few times a week. Small, regular interactions are more valuable to your SSI than occasional bursts — so a light habit beats marathon sessions.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no lock-in, no cancellation fees. Cancel from your account settings in one click. Your subscription stays active until the end of the current billing period.'
  }
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-ink px-6 py-28">
      <div className="mx-auto max-w-3xl">

        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Questions</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            Everything you need to know
          </h2>
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
