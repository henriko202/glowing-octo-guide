import type { Locale } from '@/i18n/config'

export default function En({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Privacy Policy</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Last updated:</strong> September 2026
        </p>
        {/* Source of truth is POLICY_VERSION in convex/lib/policy.ts, which drives the in-app re-consent
            prompt. The landing site has no convex dependency, so this string is a manual copy: bump it in
            en/pt/es whenever you bump the constant, or the page under-reports a policy members re-accepted. */}
        <p>Policy version: 2026-09-08</p>

        {/* 1. Who we are */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Who We Are</h2>
        <p>
          The data controller for your personal information is{' '}
          <strong className="text-cream">NEANDERTECH SERVICOS DE TECNOLOGIA LTDA</strong>, located at{' '}
          <strong className="text-cream">
            AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil
          </strong>{' '}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;Link Into The SSI&rdquo;).
        </p>
        <p>
          Privacy enquiries:{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
        <p>
          Data Protection Officer / EU&ndash;UK Representative: <strong className="text-cream">Henriko Alberton</strong>
          .
        </p>

        {/* 2. Data we collect & sources */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. Data We Collect &amp; Sources</h2>
        <p>
          <strong className="text-cream">LinkedIn sign-in (OIDC).</strong> When you connect your LinkedIn account we
          receive your LinkedIn member ID, full name, profile picture URL, and email address through LinkedIn&rsquo;s
          OpenID Connect flow.
        </p>
        <p>
          <strong className="text-cream">Profile attributes you set.</strong> You may voluntarily provide your industry
          and country in your profile settings.
        </p>
        <p>
          <strong className="text-cream">Posts you submit.</strong> We store the posts you submit to the shared feed
          through the platform.
        </p>
        <p>
          <strong className="text-cream">Engagement activity.</strong> When you choose to react to or comment on a post
          in the feed, we record that engagement (the reaction type, or the comment text you use) to measure your
          activity and interaction counts. The reaction or comment itself is made by you, directly on LinkedIn. The
          Service opens the post so you can act; it does not react or comment on LinkedIn on your behalf.
        </p>
        <p>
          <strong className="text-cream">Billing.</strong> Subscription payments are processed by Stripe. We store your
          Stripe customer ID and subscription status; we do <em>not</em> store payment card details. One-off purchases
          (a featured post) are charged by Stripe the same way and appear on your Stripe receipt; we store the purchase
          record (session id, amount, date) on the post it featured.
        </p>
        <p>
          <strong className="text-cream">Technical &amp; session data.</strong> We collect standard server logs (IP
          address, browser type, pages visited, timestamps) for security and performance monitoring.
        </p>
        <p>
          <strong className="text-cream">No scraping.</strong> We do not scrape LinkedIn or any other third-party
          website. We receive data from your own use of our platform and from LinkedIn OpenID Connect sign-in, which
          returns your member ID, name, profile picture, and email. We hold no permission to post, comment, or react on
          LinkedIn, and we write nothing to your LinkedIn account.
        </p>

        {/* 3. Why we use it & legal bases */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">3. Why We Use It &amp; Legal Bases</h2>
        <p>
          <strong className="text-cream">Contract (Art. 6(1)(b) GDPR).</strong> Providing the core service:
          authenticating you, displaying your feed, letting you submit posts and record your engagement, and managing
          your subscription.
        </p>
        <p>
          <strong className="text-cream">Legitimate interests (Art. 6(1)(f) GDPR).</strong> Optimising feed quality,
          preventing abuse, ensuring platform security, and maintaining aggregate, non-identifiable analytics about
          service performance. We also rely on legitimate interests to send a 3-day activity digest by email, and you
          can object at any time from the unsubscribe link in the email or in Settings &rarr; Emails. Signed-in members
          can also see the site-wide ranking of the most active posters and interactors, and you can opt out of
          appearing in it at any time in Settings &rarr; Emails.
        </p>
        <p>
          <strong className="text-cream">Consent (Art. 6(1)(a) GDPR).</strong> Marketing communications and optional
          analytics are processed only with your explicit consent. Both are{' '}
          <strong className="text-cream">off by default</strong> and can be toggled at any time in{' '}
          <strong className="text-cream">Settings &rarr; Privacy &amp; Data</strong>.
        </p>
        <p>
          <strong className="text-cream">Legal obligation (Art. 6(1)(c) GDPR).</strong> Retaining billing records for
          tax and financial compliance, maintaining consent records, and responding to lawful requests from supervisory
          or law-enforcement authorities.
        </p>

        {/* 4. Who we share it with */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Who We Share It With</h2>
        <p>We engage the following sub-processors who may process personal data on our behalf:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">LinkedIn</strong> &mdash; authentication (OpenID Connect sign-in).
          </li>
          <li>
            <strong className="text-cream">Stripe</strong> &mdash; payment processing and subscription management.
          </li>
          <li>
            <strong className="text-cream">Convex</strong> &mdash; backend database and serverless functions.
          </li>
          <li>
            <strong className="text-cream">Cloudflare</strong> &mdash; hosting for the landing site and the application,
            plus DNS, CDN, and DDoS protection.
          </li>
          <li>
            <strong className="text-cream">Resend</strong> &mdash; transactional email delivery.
          </li>
          <li>
            <strong className="text-cream">OpenRouter (AI inference)</strong> &mdash; generating reaction suggestions
            and draft comments from your public post content, including its images. OpenRouter routes only to inference
            providers with zero data retention (prompts are not stored or used for training).
          </li>
        </ul>
        <p>
          <strong className="text-cream">Stripe&rsquo;s own role.</strong> Stripe processes payments on our behalf, and
          Stripe also acts as an independent controller of the payment data it collects from you, which it uses to
          prevent fraud and to meet its own legal and regulatory duties. Stripe governs that use under{' '}
          <a
            href="https://stripe.com/privacy"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe&rsquo;s privacy policy
          </a>
          . Your card number goes to Stripe, and we never see or store it.
        </p>
        <p>
          <strong className="text-cream">We do not sell or share your personal information</strong> for cross-context
          behavioural advertising or any other commercial purpose.
        </p>

        {/* 5. International transfers */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. International Transfers</h2>
        <p>
          Our sub-processors are primarily based in the United States. Where data is transferred outside the European
          Economic Area or United Kingdom, we rely on the European Commission&rsquo;s Standard Contractual Clauses
          (SCCs) as the transfer mechanism for each processor. A copy of the relevant transfer safeguards is available
          on request by contacting{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>

        {/* 6. How long we keep it */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">6. How Long We Keep It</h2>
        <p>
          <strong className="text-cream">Account deletion.</strong> When you delete your account (or request erasure),
          your personal data is marked for deletion immediately. A 30-day grace period applies to allow
          accidental-deletion recovery, after which data is permanently purged.
        </p>
        <p>
          <strong className="text-cream">Dormant accounts.</strong> Accounts with no activity for 24 months are
          automatically treated as deletion requests; we will notify you before purging.
        </p>
        <p>
          <strong className="text-cream">Billing records.</strong> Transaction and subscription records are retained
          within Stripe for as long as required by applicable tax and financial regulations (typically 7 years).
        </p>
        <p>
          We apply data minimisation: we collect only what is necessary to provide the service and remove data as soon
          as it is no longer needed for its original purpose.
        </p>

        {/* 7. Your rights */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">7. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">Access</strong> &mdash; obtain a copy of the personal data we hold about you.
          </li>
          <li>
            <strong className="text-cream">Rectification</strong> &mdash; correct inaccurate or incomplete data.
          </li>
          <li>
            <strong className="text-cream">Erasure</strong> &mdash; request deletion of your data (&ldquo;right to be
            forgotten&rdquo;).
          </li>
          <li>
            <strong className="text-cream">Restriction</strong> &mdash; ask us to limit how we process your data.
          </li>
          <li>
            <strong className="text-cream">Objection</strong> &mdash; object to processing based on legitimate
            interests.
          </li>
          <li>
            <strong className="text-cream">Portability</strong> &mdash; receive your data in a structured,
            machine-readable format.
          </li>
          <li>
            <strong className="text-cream">Withdraw consent</strong> &mdash; withdraw consent for marketing or analytics
            at any time without affecting prior processing.
          </li>
          <li>
            <strong className="text-cream">Lodge a complaint</strong> &mdash; with your local supervisory authority
            (e.g. your national data-protection authority within the EU/UK, or the relevant state AG in the US).
          </li>
        </ul>
        <p>
          <strong className="text-cream">How to exercise your rights.</strong> The quickest way is through{' '}
          <strong className="text-cream">Settings &rarr; Privacy &amp; Data</strong>, where you can export your data,
          delete your account, and manage consent toggles. You may also contact us at{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          . We will respond within 30 days (or the statutory deadline where shorter).
        </p>

        {/* 8. California (CCPA/CPRA) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          8. California Residents (CCPA / CPRA)
        </h2>
        <p>
          <strong className="text-cream">Categories collected.</strong> Identifiers (name, email, LinkedIn ID, IP
          address); professional or employment-related information (headline, industry); Internet or network activity
          (session logs); commercial information (subscription status via Stripe).
        </p>
        <p>
          <strong className="text-cream">No sale or sharing.</strong> We do not sell personal information. We do not
          share personal information for cross-context behavioural advertising.
        </p>
        <p>
          <strong className="text-cream">Your CCPA/CPRA rights.</strong> California residents may exercise the right to
          know what personal information we collect, have personal information deleted, have inaccurate personal
          information corrected, and opt out of any future sale or sharing. We will not discriminate against you for
          exercising these rights.
        </p>
        <p>
          <strong className="text-cream">Authorised agents.</strong> You may designate an authorised agent to submit a
          request on your behalf. We may require verification of your identity and written authorisation for such
          requests.
        </p>
        <p>
          To submit a California privacy request, use{' '}
          <strong className="text-cream">Settings &rarr; Privacy &amp; Data</strong> or email{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>

        {/* 9. Brazil (LGPD) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Brazilian Users (LGPD)</h2>
        <p>
          In accordance with Brazil&rsquo;s Lei Geral de Prote&ccedil;&atilde;o de Dados (LGPD), you have the rights set
          out in Art. 18 of the LGPD, including: confirmation of the existence of processing; access to your data;
          correction of incomplete or inaccurate data; anonymisation, blocking, or deletion of unnecessary or excessive
          data; portability; deletion of data processed on the basis of consent; information about public and private
          entities with which we share data; information about the possibility of refusing consent and the consequences;
          and revocation of consent.
        </p>
        <p>Complaints may be filed with the Autoridade Nacional de Prote&ccedil;&atilde;o de Dados (ANPD).</p>
        <p>
          Our encarregado (Data Protection Officer / LGPD representative):{' '}
          <strong className="text-cream">Henriko Alberton</strong>.
        </p>

        {/* 10. Cookies & storage */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Cookies &amp; Storage</h2>
        <p>
          We use only <strong className="text-cream">essential</strong> browser storage (a session token to keep you
          signed in and your preferences). We do not use advertising, cross-site tracking, or non-essential analytics
          cookies. For full details see our{' '}
          <a
            href={`/${lang}/cookies`}
            className="text-gold-text hover:underline"
          >
            Cookie &amp; Storage Policy
          </a>
          .
        </p>

        {/* 11. Children / age */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">11. Children &amp; Minimum Age</h2>
        <p>
          The service is intended for users <strong className="text-cream">16 years of age and older</strong>. We do not
          knowingly collect personal information from anyone under 16. If you believe a child under 16 has provided us
          with personal information, please contact us at{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>{' '}
          and we will delete it promptly.
        </p>

        {/* 12. Changes to this policy */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">12. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. For <strong className="text-cream">material changes</strong> (new
          data categories, new purposes, or new sub-processors), we will notify you by email and/or an in-app notice,
          and we will re-prompt you for acknowledgment before the changes take effect. The policy version date at the
          top of this page reflects the most recent revision.
        </p>
        <p>
          Contact us with any questions at{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
      </div>
    </main>
  )
}
