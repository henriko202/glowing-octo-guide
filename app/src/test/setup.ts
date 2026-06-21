import '@testing-library/jest-dom'
import '../i18n'

// jsdom has no matchMedia; ThemeProvider reads it. Stub it (defaults to light) so components
// that render the provider can be tested.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  })
}
