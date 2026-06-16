const TESTIMONIALS = [
  {
    quote:
      'Since my SSI crossed 70, I have 2 recruiters reaching out to me every single day. I stopped applying for jobs — they come to me now.',
    name: 'Ana R.',
    role: 'Senior Product Manager',
    location: 'Lisbon'
  },
  {
    quote:
      "I'm a back-end developer — I never thought LinkedIn could change my career. Now multiple recruiters connect with me every week offering new opportunities. I finally feel like I'm being noticed.",
    name: 'Mateus Y.',
    role: 'Senior Back-End Developer',
    location: 'São Paulo'
  },
  {
    quote: "Finally a tool that doesn't feel like gaming the system — it's smart, deliberate networking.",
    name: 'Sophie L.',
    role: 'Marketing Lead',
    location: 'London'
  }
]

export default function Testimonials() {
  return (
    <section
      id="testimonials"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">From the circle</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            What growth looks like in practice
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map(t => {
            const initials = t.name
              .split(' ')
              .map(n => n[0])
              .join('')
            return (
              <div
                key={t.name}
                className="group flex flex-col rounded-2xl border border-cream/[0.08] bg-ink-600 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-cream/15 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
              >
                {/* Quotation mark accent */}
                <span className="font-display text-6xl leading-none text-gold/50 transition-colors group-hover:text-gold/80">
                  &ldquo;
                </span>

                {/* Quote text */}
                <p className="mt-1 flex-1 text-sm leading-relaxed text-cream/70">{t.quote}</p>

                {/* Author */}
                <div className="mt-7 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink-400 text-xs font-semibold text-cream/70">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{t.name}</p>
                    <p className="text-xs text-cream/40">
                      {t.role} · {t.location}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
