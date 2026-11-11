import '@testing-library/jest-dom';

// Ant Design reads these browser APIs, which jsdom doesn't provide.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

// Ant Design forms schedule work with MessageChannel, which jsdom lacks. A timer-based stand-in is enough here.
if (typeof globalThis.MessageChannel === 'undefined') {
  class MessagePortStub {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    other: MessagePortStub | null = null;
    postMessage(data: unknown) {
      setTimeout(() => this.other?.onmessage?.({ data }), 0);
    }
    start() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
  class MessageChannelStub {
    port1 = new MessagePortStub();
    port2 = new MessagePortStub();
    constructor() {
      this.port1.other = this.port2;
      this.port2.other = this.port1;
    }
  }
  (globalThis as unknown as { MessageChannel: unknown }).MessageChannel = MessageChannelStub;
}
