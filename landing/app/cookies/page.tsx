export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Cookie &amp; Storage Policy</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Last updated:</strong> June 2026
        </p>
        <p>
          Link Into The SSI uses only <strong className="text-cream">strictly necessary</strong> browser storage. The
          app stores a session token (to keep you signed in) and your language preference. We do not use advertising or
          cross-site tracking cookies.
        </p>
        <p>
          Because this storage is essential to provide the service you requested, it does not require consent under the
          ePrivacy rules. Optional analytics, if ever introduced, will be off by default and controllable from{' '}
          <strong className="text-cream">Settings &rarr; Privacy &amp; Data</strong>.
        </p>
        <p>
          Questions:{' '}
          <a
            href="mailto:hello@linkintothessi.com"
            className="text-gold hover:underline"
          >
            hello@linkintothessi.com
          </a>
        </p>
      </div>
    </main>
  )
}
