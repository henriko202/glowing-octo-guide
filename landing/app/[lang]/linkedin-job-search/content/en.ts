import type { GuideContent } from '../../linkedin-ssi/content/en'
import type { GuideSources } from '../../linkedin-ssi/Guide'

// Structured copy for the /linkedin-job-search guide, rendered by the shared guide component. It
// reuses the SSI guide's shape, so the section keys keep that guide's names: `pillars` holds the
// profile cards, `scoring` the "how recruiters find you" paragraphs, `improve` the numbered steps.
//
// Honesty constraints: every statement about a LinkedIn feature comes from the two LinkedIn Help
// pages in `sources`, the guide carries no hiring statistics, and it never says the app searches
// for jobs, applies, contacts recruiters, or gets anyone hired.
export type JobGuideContent = GuideContent & { sources: GuideSources }

const guide: JobGuideContent = {
  meta: {
    title: 'How to get a job on LinkedIn: a step-by-step guide',
    description:
      'To get a job on LinkedIn, you need a clear profile, a network in your field, and steady activity. Six steps, from Open to Work to commenting on posts.',
    ogTitle: 'Link Into The SSI · How to get a job on LinkedIn'
  },
  hero: {
    eyebrow: 'LinkedIn job search guide',
    headline: 'How do you get a job on LinkedIn?',
    intro:
      'To get a job on LinkedIn, you need three things: a profile that says clearly what you do, a network of people in your field, and steady activity, so recruiters and peers keep seeing your work. Applying to job posts is one way in. The other is being seen by the people who hire or refer, and that comes from what your profile says and what you do on LinkedIn.',
    updated: 'Last updated: October 2026'
  },
  pillars: {
    heading: 'What people read on your profile first',
    intro:
      'A recruiter or a hiring manager who opens your profile reads a few things before anything else. Get these four right before you apply anywhere.',
    items: [
      {
        title: 'Headline',
        body: 'It appears next to your name in search results, in comments, and in invitations. Say what you do and the field you do it in, beyond your current job title.'
      },
      {
        title: 'About section',
        body: "A few short paragraphs on the work you do, who you do it for, and what you want next. Write it the way you'd explain it to a colleague."
      },
      {
        title: 'Experience and skills',
        body: 'List each role with what you delivered, and add the skills you use in your work. A recruiter comparing you to a job description looks here.'
      },
      {
        title: 'Recent activity',
        body: "Your posts and comments show on your profile. They tell a visitor what you know and that you're active in your field."
      }
    ]
  },
  scoring: {
    heading: 'How recruiters find you on LinkedIn',
    paragraphs: [
      'Recruiters search LinkedIn for candidates, and LinkedIn says that setting your job preferences helps your profile show up in those searches. You set them with Open to Work: the job titles you want, the locations, and whether you want remote, hybrid, or on-site work.',
      'Open to Work has two visibility settings. "All LinkedIn members" adds the #OpenToWork frame to your photo, and people at your current company can see it. "Recruiters only" shows it to people who use LinkedIn Recruiter. LinkedIn tries to hide it from recruiters at your current company, but says it can\'t guarantee complete privacy.',
      'Applying is the other route. In the Jobs tab you can search by role and location, filter the results, and turn on an alert so LinkedIn tells you about new posts that match.'
    ]
  },
  sources: {
    line: 'Sources:',
    links: [
      {
        label: "LinkedIn Help, Let recruiters know you're Open to Work",
        url: 'https://www.linkedin.com/help/linkedin/answer/a507508'
      },
      {
        label: 'LinkedIn Help, Search for jobs on LinkedIn',
        url: 'https://www.linkedin.com/help/linkedin/answer/a512245'
      }
    ]
  },
  improve: {
    heading: 'How to get a job on LinkedIn, step by step',
    intro:
      "The steps go in order. The first three take an afternoon. The last three are habits, and they're what keeps you visible after the first week.",
    steps: [
      {
        title: 'Rewrite your headline and About section',
        body: 'Say what you do, the field you do it in, and the kind of role you want. Use the words a job description for that role would use.'
      },
      {
        title: 'Turn on Open to Work',
        body: "Add the job titles and locations you want, then choose who sees it: all members, or only recruiters if you're employed and want to keep it quiet."
      },
      {
        title: 'Set up job alerts',
        body: "Search for the role you want in the Jobs tab, filter the results, and turn on the alert. Apply to the posts that fit, and skip the ones that don't."
      },
      {
        title: 'Connect with people in your field',
        body: "Add peers, former colleagues, and people at the companies you'd like to work for. Write a short note with each invitation, so they know why you're reaching out."
      },
      {
        title: 'Comment on posts from your field',
        body: "A comment with a point of view puts your name and headline in front of the people reading that post, including people you aren't connected to. A few good comments a week is a realistic pace."
      },
      {
        title: 'Post about your own work',
        body: 'One short post a week is enough: something you built, a problem you solved, or a lesson you learned. It gives a visitor to your profile something recent to read.'
      }
    ],
    note: 'No tool or guide can promise you a job or a timeline, and that includes this one. You control how clear your profile is and how often people in your field see your work.'
  },
  product: {
    heading: 'Where Link Into The SSI fits',
    body: "Link Into The SSI (LISSI) helps with steps 5 and 6. It doesn't search for jobs, apply for you, or contact recruiters. You get posts from your field in one feed, with an AI draft to start your comment from, and you add your own posts so other members see them. You make every reaction and comment on LinkedIn yourself, and a weekly recap shows what you did.",
    linkLabel: 'See how the feed works'
  },
  faq: {
    heading: 'Common questions',
    items: [
      {
        q: 'Should I use the Open to Work photo frame?',
        a: "It depends on who you want to tell. The frame shows every LinkedIn member that you're looking, including people at your current company. To keep it quiet, choose \"Recruiters only\". LinkedIn says it can't guarantee that recruiters at your own company won't see it."
      },
      {
        q: 'Do I need LinkedIn Premium to get a job?',
        a: "No. You can search for jobs, apply, set alerts, and turn on Open to Work with a free account. Premium adds extras, and you can decide later if they're worth it to you."
      },
      {
        q: 'How long does it take to get a job on LinkedIn?',
        a: "There's no fixed time. It depends on your field, your experience, and the job market. Plan for steady activity over several weeks instead of one busy day."
      },
      {
        q: 'Does commenting on posts help me get hired?',
        a: "It helps people in your field see your name and what you know, and your next role often comes from someone who already knows your work. A comment doesn't replace an application, so do both."
      },
      {
        q: 'Can Link Into The SSI get me a job?',
        a: "No. LISSI doesn't search for jobs, apply for you, or message recruiters, and it never acts on your account. It helps you find posts from your field and draft comments, so staying visible takes less time. We can't promise a timeline or a result."
      }
    ]
  },
  cta: {
    heading: 'Stay visible while you look',
    body: 'Get posts from your field in one feed, plus an AI draft whenever you want help with a comment. You choose what to engage with.'
  },
  backHome: '← Back to Link Into The SSI'
}

export default guide
