const STATS = [
  { value: '10,000+', label: 'Engagements facilitated' },
  { value: '+8 pts', label: 'Avg. SSI gain in 30 days' },
  { value: '3 min/day', label: 'Average session time' },
  { value: '3 languages', label: 'English · Portuguese · Spanish' }
]

export default function StatsBar() {
  return (
    <section
      id="our-numbers"
      className="bg-ink px-6 py-16"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-0 md:divide-x md:divide-gold/20">
          {STATS.map(stat => (
            <div
              key={stat.value}
              className="text-center"
            >
              <p
                className="animate-shimmer font-display text-4xl font-semibold"
                style={{
                  color: '#F5F0E8',
                  background: 'linear-gradient(90deg, #F5F0E8 0%, #C9963E 50%, #F5F0E8 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                {stat.value}
              </p>
              <p className="mt-2 text-xs uppercase tracking-widest text-cream/40">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
