import type { Locale } from '@/i18n/config'

export default function En({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Cookie &amp; Storage Policy</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Last updated:</strong> October 2026
        </p>
        <p>
          This page lists every cookie and browser storage item Link Into The SSI uses on linkintothessi.com and
          app.linkintothessi.com, and what each one is for. We do not use advertising or cross-site tracking cookies.
          Items in local storage stay until you clear them; items in session storage are deleted when you close the tab.
        </p>

        {/* 1. Needed for the site and app */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Needed for the Site and App</h2>
        <p>
          These keep you signed in and remember the choices you make. They hold no analytics, and because the service
          cannot work without them, they do not need your consent.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">lang</strong> and <strong className="text-cream">theme</strong> (cookies, 1
            year, shared by the website and the app) &mdash; your language and your light or dark theme. The website
            keeps a copy of your theme in local storage (<strong className="text-cream">theme</strong>), and the app
            keeps copies of both (<strong className="text-cream">theme</strong> and{' '}
            <strong className="text-cream">i18nextLng</strong>).
          </li>
          <li>
            <strong className="text-cream">sessionToken</strong> (app, session storage) &mdash; keeps you signed in.
          </li>
          <li>
            <strong className="text-cream">oauthVerifier</strong> and <strong className="text-cream">oauthCode</strong>{' '}
            (app, session storage) &mdash; used only while you sign in with LinkedIn.
          </li>
          <li>
            <strong className="text-cream">oauth_nonce_&hellip;</strong> (cookie set by our sign-in server, 10 minutes)
            &mdash; ties a LinkedIn sign-in to the browser that started it, so no one else can complete it.
          </li>
          <li>
            <strong className="text-cream">signedOut</strong> (app, local storage) &mdash; after you sign out, stops
            LinkedIn from signing you straight back in.
          </li>
          <li>
            <strong className="text-cream">chosenPlan</strong> and{' '}
            <strong className="text-cream">chosenInterval</strong> (app, session storage) &mdash; the plan and billing
            period you picked on our pricing page, carried to checkout.
          </li>
          <li>
            <strong className="text-cream">motdDismissed</strong> (app, session storage) &mdash; remembers that you
            closed an announcement.
          </li>
          <li>
            <strong className="text-cream">ref</strong> (website, session storage) &mdash; the invite code from a link
            you followed, passed to the app when you sign up.
          </li>
          <li>
            <strong className="text-cream">cookieNoticeDismissed</strong> (website, local storage) &mdash; remembers
            that you closed the storage notice.
          </li>
          <li>
            <strong className="text-cream">__ph_opt_in_out_&hellip;</strong> (app, local storage) &mdash;
            PostHog&rsquo;s record of your analytics choice (yes or no). It holds no identifier.
          </li>
        </ul>

        {/* 2. Error monitoring */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. Error Monitoring</h2>
        <p>
          The app uses Sentry to find and fix errors. Sentry keeps one item in session storage,{' '}
          <strong className="text-cream">sentryReplaySession</strong>, which identifies the current screen recording.
          Sentry records the screen for 10% of app sessions and for every session with an error. The recordings mask all
          text and block images, so they show the page layout and your clicks, not what you read or type. See section 2
          of our{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>

        {/* 3. Website statistics without cookies */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Website Statistics Without Cookies
        </h2>
        <p>These count visits to our website. None of them sets a cookie.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">DataFast</strong> &mdash; counts the pages viewed on the website. It keeps{' '}
            <strong className="text-cream">datafast_visitor_id</strong>,{' '}
            <strong className="text-cream">datafast_session_id</strong>, and{' '}
            <strong className="text-cream">datafast_session_start</strong> in session storage, and{' '}
            <strong className="text-cream">datafast_event_queue</strong> (visits waiting to be sent, empty once sent) in
            local storage. The visitor code is derived from your IP address and browser and changes every day, so your
            visits cannot be linked across days. Invite codes are removed from the page address before it is sent.
          </li>
          <li>
            <strong className="text-cream">Cloudflare Web Analytics</strong> &mdash; measures page loads on the website
            and in the app. It stores nothing in your browser.
          </li>
          <li>
            <strong className="text-cream">Our sign-up counter</strong> &mdash; counts, on our own servers, how many
            visitors see our pricing and click our sign-up buttons. It stores nothing in your browser. To count each
            visitor once per day, it keeps a code derived from your IP address and browser that changes every day and is
            deleted within two days.
          </li>
        </ul>
        <p>
          We rely on our legitimate interest in understanding how our website is used (see section 3 of our Privacy
          Policy).
        </p>

        {/* 4. App analytics, only with consent */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          4. App Analytics, Only With Your Consent
        </h2>
        <p>
          App analytics are off by default. They start only if you turn them on in{' '}
          <strong className="text-cream">Settings &rarr; Privacy &amp; Data</strong>.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">DataFast</strong> &mdash; records the pages you visit in the app, linked to
            your internal member ID. It sets five cookies on linkintothessi.com:{' '}
            <strong className="text-cream">datafast_visitor_id</strong>,{' '}
            <strong className="text-cream">datafast_visitor_first_seen_at</strong>, and{' '}
            <strong className="text-cream">datafast_visitor_session_count</strong> (1 year), and{' '}
            <strong className="text-cream">datafast_session_id</strong> and{' '}
            <strong className="text-cream">datafast_session_start</strong> (30 minutes). It also uses{' '}
            <strong className="text-cream">datafast_event_queue</strong> in local storage.
          </li>
          <li>
            <strong className="text-cream">PostHog</strong> &mdash; records the pages you visit and the features you use
            in the app, linked to your internal member ID. The text of what you click is masked. It sets the{' '}
            <strong className="text-cream">ph_&hellip;_posthog</strong> cookie (1 year) and keeps matching items in
            local and session storage.
          </li>
        </ul>
        <p>
          Turning analytics off, or signing out, stops both, and we delete the DataFast cookies and PostHog&rsquo;s
          cookie and storage. We never send them your name, email, posts, or payment details.
        </p>

        {/* 5. Your choices */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Your Choices</h2>
        <p>
          You can turn app analytics on or off at any time in{' '}
          <strong className="text-cream">Settings &rarr; Privacy &amp; Data</strong>. You can also clear cookies and
          site data in your browser settings; clearing the items in section 1 signs you out and resets your language and
          theme.
        </p>
        <p>
          Questions:{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
        </p>
      </div>
    </main>
  )
}
