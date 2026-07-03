// Vite-bundled Web Worker entry. The browser server entry self-invokes
// — it constructs a Connection bound to the worker's globalThis and
// registers all handlers — so importing it for side effects is all
// this file needs.
import "@oddsquad/tic-tac-token-lsp/browser";
