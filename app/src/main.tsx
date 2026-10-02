import './i18n'
import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './components/ThemeProvider'
import ErrorBoundary from './components/ErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'
import { initSentry } from './lib/observability/sentry'
import { initPostHog } from './lib/observability/analytics'
import { joinSessionChannel } from './lib/sessionHandoff'

// No-ops in dev / without the prod env vars. PostHog starts opted-out; capture begins only after the
// signed-in user grants analytics consent (see AnalyticsConsentGate).
initSentry()
initPostHog()

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

// A tab opened from another one (ctrl/middle click) takes that tab's session before the first render:
// every page reads the token from sessionStorage as it renders (lib/sessionHandoff.ts).
void joinSessionChannel().then(() =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <TooltipProvider>
          <ConvexProvider client={convex}>
            <BrowserRouter>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </BrowserRouter>
          </ConvexProvider>
        </TooltipProvider>
      </ThemeProvider>
    </React.StrictMode>
  )
)
