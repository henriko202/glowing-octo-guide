'use client'
import { useState } from 'react'
import type { Dictionary } from '../i18n/getDictionary'

export default function FAQ({ dict }: { dict: Dictionary['faq'] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section
      id="faq"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">{dict.headline}</h2>
        </div>

        <div className="divide-y divide-gold">
          {dict.items.map((faq, i) => (
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
                  className="flex-shrink-0 font-display text-2xl text-gold-text transition-transform duration-200"
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
