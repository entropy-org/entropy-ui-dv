import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(element: Element) {
    this.callback(
      [
        {
          target: element,
          contentRect: { width: 1200, height: 720 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    )
  }

  disconnect() {}
  unobserve() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  configurable: true,
})
class PointerEventMock extends MouseEvent {
  readonly pointerId: number
  readonly pointerType: string
  readonly isPrimary: boolean

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.pointerType = init.pointerType ?? "mouse"
    this.isPrimary = init.isPrimary ?? true
  }
}

Object.defineProperty(globalThis, "PointerEvent", {
  value: PointerEventMock,
  configurable: true,
})
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  value: () => undefined,
  configurable: true,
})
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  },
  configurable: true,
})
Object.defineProperty(globalThis, "cancelAnimationFrame", {
  value: () => undefined,
  configurable: true,
})

afterEach(() => cleanup())
