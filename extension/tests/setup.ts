// A minimal `chrome` stub so modules that register listeners at the top
// level (content/index.ts, background/index.ts) can be imported under
// vitest without a real extension runtime. Real behavior is verified by
// loading the built dist/ as an unpacked extension — see README.
;(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    onMessageExternal: { addListener: () => {} },
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {},
    },
  },
  action: { onClicked: { addListener: () => {} } },
  scripting: { executeScript: async () => {} },
  tabs: {
    get: async () => ({}),
    query: async () => [],
    sendMessage: async () => ({}),
    create: () => {},
  },
}
