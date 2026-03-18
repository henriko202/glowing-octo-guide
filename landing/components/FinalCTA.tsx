export default function FinalCTA() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173'
  return (
    <section className="relative overflow-hidden bg-ink px-6 py-32 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,150,62,0.07) 0%, transparent 70%)' }}
      />
      <div
        className="circle-ring"
        style={{
          width: 500,
          height: 500,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: 'rgba(201,150,62,0.08)'
        }}
      />
      <div className="relative z-10 mx-auto max-w-xl space-y-6">
        <h2 className="font-display text-5xl font-semibold text-cream md:text-6xl">
          Ready to join
          <br />
          <span className="italic text-gold">the circle?</span>
        </h2>
        <p className="text-base text-cream/50">Start your 3-day free trial. No credit card required.</p>
        <a
          href={`${APP_URL}/login`}
          className="inline-block rounded-full bg-gold px-10 py-4 font-semibold text-ink shadow-[0_0_40px_rgba(201,150,62,0.4)] transition-all duration-200 hover:bg-gold-light hover:shadow-[0_0_60px_rgba(201,150,62,0.55)]"
        >
          Sign in with LinkedIn — it&apos;s free
        </a>
      </div>
    </section>
  )
}
