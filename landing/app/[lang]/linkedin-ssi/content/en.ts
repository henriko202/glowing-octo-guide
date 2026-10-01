// Structured copy for the /linkedin-ssi guide. English is the canonical shape: pt/es are typed
// against `GuideContent`, so a missing section fails typecheck. Kept out of the i18n dictionaries
// (which hold UI labels) for the same reason the legal pages keep their long-form copy in content
// modules: the guide is page content, not interface chrome.
//
// Honesty constraints mirror the rest of the landing: the guide never claims the app reads, changes,
// or predicts a member's SSI, and never promises a score or a timeline.
const guide = {
  meta: {
    title: 'What is LinkedIn SSI? Social Selling Index explained',
    description:
      'LinkedIn SSI (Social Selling Index) is a 0 to 100 score across four areas: brand, people, insights, and relationships. Learn how it works and how to improve it.',
    ogTitle: 'Link Into The SSI · What is LinkedIn SSI and how do you improve it?'
  },
  hero: {
    eyebrow: 'LinkedIn SSI guide',
    headline: 'What is LinkedIn SSI?',
    intro:
      'LinkedIn SSI, short for Social Selling Index, is a score from 0 to 100 that LinkedIn gives every member. It looks at four parts of how you use LinkedIn: your professional brand, the people you connect with, how you engage with posts, and the relationships you keep. LinkedIn updates it every day.',
    updated: 'Last updated: October 2026'
  },
  pillars: {
    heading: 'The four areas LinkedIn scores',
    intro:
      'Each area is worth up to 25 points, and together they make up your score out of 100. LinkedIn shows a separate score for each area, so you can see which one needs work.',
    items: [
      {
        title: 'Establish your professional brand',
        body: 'A complete profile with a clear headline, an About section that says who you help, and posts that show your work.'
      },
      {
        title: 'Find the right people',
        body: 'Connecting with the peers, clients, and decision-makers who matter in your field.'
      },
      {
        title: 'Engage with insights',
        body: 'Reacting to and commenting on posts about your area of expertise.'
      },
      {
        title: 'Build relationships',
        body: 'Staying in touch with the people you meet, so a new connection becomes a working relationship over time.'
      }
    ]
  },
  scoring: {
    heading: 'How LinkedIn calculates the SSI',
    paragraphs: [
      "LinkedIn builds the score from what you do on the platform: how complete your profile is, who you connect with, how you engage with posts, and how you keep in touch with your network. LinkedIn shows you the total and the four area scores, but it doesn't publish the exact formula.",
      "Since August 2026, LinkedIn only shows the SSI page to Sales Navigator users. Without Sales Navigator, the score still exists and you can still work on it, but you can't see the number."
    ]
  },
  improve: {
    heading: 'How to improve your LinkedIn SSI',
    intro:
      "The score reflects steady activity, so no single action changes it overnight. The steps below cover all four areas. Start with the area you've done the least in.",
    steps: [
      {
        title: 'Complete your profile',
        body: 'Add a photo, a headline that says what you do, and an About section that says who you help. Your profile is one of the main inputs to the brand score.'
      },
      {
        title: 'Post something useful',
        body: "One short post a week is enough: a lesson, a result, or an opinion from your field. Posting shows your work to people who aren't in the conversation yet."
      },
      {
        title: 'Comment instead of only reacting',
        body: "A comment with a point of view reaches more people than a like, and it's the clearest way to engage with insights."
      },
      {
        title: "Follow your industry's conversations",
        body: 'Read and join the posts your peers and clients are discussing, beyond the popular posts in your feed.'
      },
      {
        title: 'Connect with intent',
        body: 'Add a short note to each invitation, and focus on the people who matter to your work.'
      },
      {
        title: 'Keep relationships warm',
        body: 'Reply to messages, congratulate people on their news, and stay in touch with the connections you already have.'
      }
    ],
    note: "LinkedIn owns the SSI, so we can't promise a score or a timeline. You control the activity that goes into it."
  },
  product: {
    heading: 'Where Link Into The SSI fits',
    body: "Link Into The SSI (LISSI) doesn't read, change, or predict your SSI. It helps with posting and commenting. You add your posts to a shared feed where other members see them, and you get posts from your field to comment on, with an AI draft to start from. You make every reaction and comment on LinkedIn yourself, and a weekly recap shows what you did.",
    linkLabel: 'See how the feed works'
  },
  faq: {
    heading: 'Common questions',
    items: [
      {
        q: 'Is the LinkedIn SSI still available?',
        a: 'Yes. The score still exists, and LinkedIn still updates it every day. Since August 2026, you need Sales Navigator to see it, so members without Sales Navigator can no longer check their number.'
      },
      {
        q: 'How do I check my LinkedIn SSI?',
        a: "Sign in to LinkedIn and open linkedin.com/sales/ssi. Since August 2026, the page only opens for accounts with Sales Navigator. If you don't have it, there's no other official place to see your score."
      },
      {
        q: 'How often does the SSI update?',
        a: "LinkedIn updates the SSI every day. It reflects your activity over time, so it changes gradually. There's no reset button, and LinkedIn hasn't published any shortcut."
      },
      {
        q: 'What is a good SSI score?',
        a: "LinkedIn doesn't set a pass mark. Your own trend and your four area scores tell you more, because they show which activity to work on next."
      },
      {
        q: 'Does the SSI affect my reach on LinkedIn?',
        a: "LinkedIn doesn't say the SSI affects your reach or ranking. Think of it as a summary of your activity."
      },
      {
        q: 'Can Link Into The SSI improve my score for me?',
        a: "No. LISSI can't see or predict your SSI, and it never acts on your account. It helps you find posts and draft comments. You decide what to do on LinkedIn and do it yourself."
      }
    ]
  },
  cta: {
    heading: 'Make engaging on LinkedIn easier',
    body: 'Get posts from your field in one feed, plus an AI draft whenever you want help with a comment. You choose what to engage with.'
  },
  backHome: '← Back to Link Into The SSI'
}

export type GuideContent = typeof guide
export default guide
