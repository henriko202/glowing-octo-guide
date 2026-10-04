import type { Locale } from '@/i18n/config'

export default function En({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Terms of Service</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Last updated:</strong> October 2026
        </p>

        {/* 1. Acceptance */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Acceptance</h2>
        <p>
          By accessing or using Link Into The SSI (&ldquo;the Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) you
          agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
        </p>
        <p>
          <strong className="text-cream">Age requirement.</strong> By using the Service you confirm that you are{' '}
          <strong className="text-cream">16 years of age or older</strong>. If you are under 16 you may not create an
          account or use the Service.
        </p>

        {/* 2. The service */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. The Service</h2>
        <p>
          Link Into The SSI is a LinkedIn-connected SaaS platform that provides a shared feed of member posts and helps
          you engage with them. Reactions and comments are made by you, directly on LinkedIn: the Service surfaces
          relevant posts, can suggest a reaction and draft a comment, and then opens the post on LinkedIn so you can
          choose to act. The Service does not post, comment, or react on LinkedIn on your behalf. Its purpose is to help
          professionals grow their LinkedIn Social Selling Index (SSI) through authentic, mutual engagement within the
          community.
        </p>
        <p>
          <strong className="text-cream">What you buy.</strong> You buy access to this software. Your subscription
          covers the shared feed, the reaction and comment suggestions, and the account features listed for your plan.
          We sell no reactions, comments, connections, or followers, and we deliver no engagement to your LinkedIn
          account or to any other account. Your SSI depends on what you do on LinkedIn, so we promise no score, no
          ranking, and no result.
        </p>

        {/* 3. Your LinkedIn account & authorization */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Your LinkedIn Account &amp; Authorization
        </h2>
        <p>
          To use the Service you sign in with your LinkedIn account via LinkedIn OpenID Connect. This confirms your
          identity and provides your basic profile information: your LinkedIn member ID, name, profile picture, and
          email address. The Service requests no permission to post, comment, or react on LinkedIn, and makes no writes
          to your LinkedIn account.
        </p>
        <p>
          You remain fully responsible for all activity that occurs under your LinkedIn account, including any comments
          or reactions you make on LinkedIn after opening a post through the Service. You may revoke this authorization
          at any time through your LinkedIn account settings or by deleting your account.
        </p>

        {/* 4. Acceptable use */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>send spam or unsolicited messages;</li>
          <li>harass, abuse, or harm other members;</li>
          <li>
            run automated or bot activity beyond the features expressly provided by the Service (e.g. scripted
            engagement outside the platform);
          </li>
          <li>violate any applicable local, national, or international law or regulation; or</li>
          <li>
            circumvent or attempt to circumvent any technical measures or security controls of the Service or LinkedIn.
          </li>
        </ul>
        <p>
          You must also comply with{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn&rsquo;s User Agreement
          </a>{' '}
          at all times.
        </p>

        {/* 5. Subscriptions & billing */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Subscriptions &amp; Billing</h2>
        <p>
          Access to the Service requires an active paid subscription. Subscriptions are billed{' '}
          <strong className="text-cream">monthly or annually</strong>, according to the plan and interval you choose,
          via Stripe. By subscribing you authorise Stripe to charge the payment method you provide on that recurring
          basis until you cancel.
        </p>
        <p>
          <strong className="text-cream">Plans and delivery.</strong> We offer four plans: Starter, Growth, Pro, and a
          custom Enterprise plan arranged by contacting us. You see the current price for each plan and interval on our
          home page, and again at checkout before you pay. The Service runs as a hosted web application, we open your
          access as soon as your subscription starts, and we ship no physical goods.
        </p>
        <p>
          <strong className="text-cream">One-time purchases.</strong> Some features are sold separately from the
          subscription. Featuring one of your posts costs <strong className="text-cream">$5</strong>, charged once by
          Stripe when you confirm the purchase. It applies to the{' '}
          <strong className="text-cream">single post you choose</strong>, does not renew, and is not refundable once
          that post has been featured.
        </p>
        <p>
          <strong className="text-cream">Free trial.</strong> The <strong className="text-cream">Pro</strong> plan
          starts with a <strong className="text-cream">7-day free trial</strong> (14 days when you join through a
          member&apos;s invite link) and a payment method is required to begin it. The Starter and Growth plans have no
          free trial: billing starts when you subscribe. The trial ends — and billing starts — as soon as you reach{' '}
          <strong className="text-cream">50 interactions</strong> (made plus received) or when the trial period ends,
          whichever comes first. We notify you by email before the first charge. You may cancel at any time before the
          trial ends from the Subscription page in your account, and you will not be charged. One free trial is
          available per account; if you subscribe again after cancelling, billing starts immediately and this is stated
          at checkout.
        </p>
        <p>
          <strong className="text-cream">Promotion codes.</strong> A promotion code entered at checkout can make the
          first month of a monthly plan free. A payment method is still required, and after that month you are billed
          the plan&apos;s monthly price unless you cancel before then. Promotion codes are not available on annual
          billing.
        </p>
        <p>
          <strong className="text-cream">Cancellation.</strong> You may cancel your subscription at any time through
          your account settings. Cancellation takes effect at the{' '}
          <strong className="text-cream">end of the current billing period</strong>; you retain access to the Service
          until that date and no partial refunds are issued for unused time.
        </p>
        <p>
          <strong className="text-cream">Account deletion.</strong> Requesting account deletion automatically cancels
          any active subscription. Billing records are retained as required by law (see the{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Privacy Policy
          </a>
          ).
        </p>

        {/* 6. Suspension, ban & account deletion */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          6. Suspension, Ban &amp; Account Deletion
        </h2>
        <p>
          We may suspend or permanently ban accounts that violate these Terms, engage in misuse, or otherwise harm the
          community or the Service, without prior notice where necessary to protect members or the platform.
        </p>
        <p>
          <strong className="text-cream">Self-deletion.</strong> You may delete your account at any time from your
          account settings. A <strong className="text-cream">30-day grace period</strong> applies, during which your
          account can be recovered. After 30 days your personal data is permanently purged, except for billing records
          that must be retained for tax or financial compliance purposes (see our{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Privacy Policy
          </a>
          ).
        </p>

        {/* 7. Disclaimers & limitation of liability */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          7. Disclaimers &amp; Limitation of Liability
        </h2>
        <p>
          This section, including any warranty disclaimers, indemnification provisions, and caps on liability, will be
          drafted and inserted by qualified legal counsel prior to the Service launching publicly. Until these terms are
          finalised no binding limitation of liability applies in either direction.
        </p>

        {/* 8. LinkedIn User Agreement */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">8. LinkedIn User Agreement</h2>
        <p>
          You must independently comply with{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn&rsquo;s User Agreement
          </a>{' '}
          and all LinkedIn policies. Link Into The SSI is an independent product and is{' '}
          <strong className="text-cream">not affiliated with, endorsed by, or sponsored by LinkedIn Corporation</strong>{' '}
          or any of its affiliates.
        </p>

        {/* 9. Governing law */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws of{' '}
          <strong className="text-cream">Brazil</strong>. Any disputes arising from or relating to these Terms shall be
          subject to the exclusive jurisdiction of the courts of <strong className="text-cream">Brazil</strong>.
        </p>

        {/* 10. Changes & contact */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Changes &amp; Contact</h2>
        <p>
          We may update these Terms from time to time. Material changes will be communicated by email or in-app notice
          before they take effect. Continued use of the Service after the effective date of a change constitutes
          acceptance of the revised Terms.
        </p>
        <p>
          Contact us about these Terms at{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
        <p>
          For information about how we handle your personal data, please read our{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  )
}
