// Jest 测试环境设置

// 仅在 jsdom 环境下 mock window 相关 API（node 环境无 window）
if (typeof window !== 'undefined') {
  // mock window.scrollTo（避免 "Not implemented: window.scrollTo" 警告）
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    configurable: true,
    value: jest.fn(),
  });

  // mock window.matchMedia（lightweight-charts 需要）
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // mock ResizeObserver
  class ResizeObserverMock {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  });

  // mock canvas getContext
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn().mockReturnValue({ data: [] }),
    putImageData: jest.fn(),
    createImageData: jest.fn().mockReturnValue({ data: [] }),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 0 }),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}
