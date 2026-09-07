import { useAction, useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import BrandMark from '@/components/BrandMark'
import PostComposer from './PostComposer'

// One-time first-login nudge to share the member's first post. Shown by RequireAuth until
// users.firstPostPromptedAt is set — which happens when they submit any post (server-side in
// submitPost) or click "I'll do this later". Skippable: it never blocks entry to the app.
export default function FirstPostPromptScreen() {
  const { t } = useTranslation()
  const submitPost = useAction(api.posts.submitPost)
  const dismiss = useMutation(api.users.dismissFirstPostPrompt)

  async function handleSubmit(postUrl: string) {
    const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
    if (!sessionToken) throw new Error(t('auth.notSignedIn'))
    await submitPost({ sessionToken, postUrl })
    // submitPost set firstPostPromptedAt server-side. Everyone lands on the feed: a not-yet-subscribed
    // member's post is created hidden and the feed's CardGateBanner names it, so the card ask arrives
    // after they have seen the product rather than instead of it (R04).
    window.location.reload()
  }

  async function handleSkip() {
    const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
    if (!sessionToken) return
    await dismiss({ sessionToken })
    window.location.reload()
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-md rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />
        <h1 className="text-foreground font-display text-2xl font-semibold">{t('onboarding.firstPost.title')}</h1>
        <p className="text-muted-foreground mt-2 mb-4 text-sm leading-relaxed">{t('onboarding.firstPost.intro')}</p>
        <PostComposer onSubmit={handleSubmit} />
        <button
          type="button"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground mx-auto block text-xs underline"
        >
          {t('onboarding.firstPost.skip')}
        </button>
      </div>
    </div>
  )
}
