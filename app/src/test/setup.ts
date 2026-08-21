import '@testing-library/jest-dom'
import '../i18n'

// jsdom has no ResizeObserver; cmdk/radix (command palette, popovers) construct one on mount.
// Stub it so tests can render those components.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom doesn't implement scrollIntoView; cmdk calls it when it auto-selects an item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

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
