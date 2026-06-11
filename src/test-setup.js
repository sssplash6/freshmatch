import '@testing-library/jest-dom'

// jsdom doesn't implement these browser APIs that framer-motion touches
// (whileInView -> IntersectionObserver, useReducedMotion -> matchMedia).
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
globalThis.IntersectionObserver = IntersectionObserverStub
if (typeof window !== 'undefined') {
  window.IntersectionObserver = IntersectionObserverStub
  if (!window.matchMedia) {
    window.matchMedia = query => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false },
    })
  }
}
