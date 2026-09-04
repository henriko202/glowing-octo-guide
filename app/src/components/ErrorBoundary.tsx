import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../i18n'
import BrandMark from './BrandMark'
import { Button } from './ui/button'
import { captureException } from '../lib/observability/sentry'

type Props = { children: ReactNode }
type State = { hasError: boolean }

// Top-level render-crash guard (B05, minimal scope): without this a render error blanks the whole
// page. The report goes to console.error only — that's the client-side sink for now; a durable
// frontend capture service is what the (unavailable) Convex Sentinel component would have added.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack)
    captureException(error, info.componentStack) // no-op unless Sentry is initialised (prod + DSN)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center p-4">
        <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 text-center shadow-sm">
          <BrandMark className="mb-4 justify-center" />
          <h1 className="text-foreground font-display text-2xl font-semibold">{i18n.t('errorBoundary.title')}</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{i18n.t('errorBoundary.body')}</p>
          <Button
            type="button"
            className="mt-5"
            onClick={() => window.location.reload()}
          >
            {i18n.t('errorBoundary.reload')}
          </Button>
        </div>
      </div>
    )
  }
}
