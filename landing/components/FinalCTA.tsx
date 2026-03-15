export default function FinalCTA() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";
  return (
    <section className="relative py-32 px-6 overflow-hidden bg-ink text-center">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,150,62,0.07) 0%, transparent 70%)" }}
      />
      <div className="circle-ring" style={{ width: 500, height: 500, top: "50%", left: "50%", transform: "translate(-50%, -50%)", borderColor: "rgba(201,150,62,0.08)" }} />
      <div className="relative z-10 max-w-xl mx-auto space-y-6">
        <h2 className="font-display text-5xl md:text-6xl font-semibold text-cream">
          Ready to join<br />
          <span className="italic text-gold">the circle?</span>
        </h2>
        <p className="text-cream/50 text-base">Start your 3-day free trial. No credit card required.</p>
        <a
          href={`${APP_URL}/login`}
          className="inline-block px-10 py-4 rounded-full font-semibold bg-gold text-ink hover:bg-gold-light transition-all duration-200 shadow-[0_0_40px_rgba(201,150,62,0.4)] hover:shadow-[0_0_60px_rgba(201,150,62,0.55)]"
        >
          Sign in with LinkedIn — it&apos;s free
        </a>
      </div>
    </section>
  );
}
