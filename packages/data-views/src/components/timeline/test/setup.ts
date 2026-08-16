/**
 * Vitest setup file for the Timeline component test suite.
 *
 * Provides jsdom polyfills for APIs not implemented in the test environment:
 * - ResizeObserver
 * - Element.scrollTo
 * - Element.setPointerCapture / releasePointerCapture / hasPointerCapture
 *
 * Also registers @testing-library/jest-dom matchers globally.
 */
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

afterEach(() => {
  cleanup()
})

// ── ResizeObserver polyfill ──────────────────────────────────────────────────
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor() {}

    observe() {
      /* noop in test */
    }
    unobserve() {
      /* noop in test */
    }
    disconnect() {
      /* noop in test */
    }
  }
}

// ── Element.scrollTo polyfill ────────────────────────────────────────────────
if (typeof Element.prototype.scrollTo === "undefined") {
  Element.prototype.scrollTo = function (
    optionsOrX?: ScrollToOptions | number,
    y?: number
  ) {
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      if (optionsOrX.left !== undefined) this.scrollLeft = optionsOrX.left
      if (optionsOrX.top !== undefined) this.scrollTop = optionsOrX.top
    } else {
      if (optionsOrX !== undefined) this.scrollLeft = optionsOrX
      if (y !== undefined) this.scrollTop = y
    }
  }
}

// ── Pointer capture polyfills ────────────────────────────────────────────────
const capturedPointers = new Set<number>()

if (typeof Element.prototype.setPointerCapture === "undefined") {
  Element.prototype.setPointerCapture = function (pointerId: number) {
    capturedPointers.add(pointerId)
  }
}

if (typeof Element.prototype.releasePointerCapture === "undefined") {
  Element.prototype.releasePointerCapture = function (pointerId: number) {
    capturedPointers.delete(pointerId)
  }
}

if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = function (pointerId: number) {
    return capturedPointers.has(pointerId)
  }
}

// ── window.scrollTo polyfill ─────────────────────────────────────────────────
if (typeof window.scrollTo === "undefined") {
  window.scrollTo = function (
    optionsOrX?: ScrollToOptions | number,
    y?: number
  ) {
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      if (optionsOrX.left !== undefined) window.scrollX = optionsOrX.left
      if (optionsOrX.top !== undefined) window.scrollY = optionsOrX.top
    } else {
      if (optionsOrX !== undefined) window.scrollX = optionsOrX
      if (y !== undefined) window.scrollY = y
    }
  } as typeof window.scrollTo
}
