export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Privacy Policy</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Last updated:</strong> March 2026
        </p>
        <p>
          Link Into The SSI (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects your LinkedIn profile data and post data
          through LinkedIn OAuth solely to provide the feed and engagement features of the platform.
        </p>
        <p>
          We store your LinkedIn access tokens securely on our servers and never expose them to other users or third
          parties.
        </p>
        <p>We use Stripe to process payments. We do not store payment card details.</p>
        <p>
          You may delete your account and all associated data at any time by contacting{' '}
          <a
            href="mailto:hello@linkintothessi.com"
            className="text-gold hover:underline"
          >
            hello@linkintothessi.com
          </a>
          .
        </p>
        <p>For questions about your data, contact us at the address above.</p>
      </div>
    </main>
  )
}
