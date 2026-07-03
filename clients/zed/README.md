# Zed extension — DTCG Tokens

Registers `dtcg-tokens-lsp` with Zed so it auto-attaches to JSON files in the open workspace. The LSP itself is published to npm as [`@oddsquad/tic-tac-token-lsp`](https://www.npmjs.com/package/@oddsquad/tic-tac-token-lsp) (source in [`../../lsp`](../../lsp)); this extension just tells Zed how to fetch and launch it.

## Install (dev extension)

This is still a Zed **dev extension** (not yet on the Zed marketplace), but it works in any project now — not just this monorepo.

Prerequisites:

- `cargo` and the `wasm32-wasip1` target (`rustup target add wasm32-wasip1`).

Then in Zed:

1. Open the Extensions panel: `Cmd-Shift-X`.
2. Click `Install Dev Extension`.
3. Select this `clients/zed/` directory.

Zed builds the extension WASM (`cargo build --target wasm32-wasip1 --release`) and installs it. Reload the project (or restart Zed) and open any `.tokens.json` file in **any** workspace — the extension installs `@oddsquad/tic-tac-token-lsp` from npm on first use and the LSP attaches automatically.

## What it does

The extension's `language_server_command` callback installs (or reuses an already-installed, up-to-date copy of) the `@oddsquad/tic-tac-token-lsp` npm package into the extension's own work directory, then returns:

```
node node_modules/@oddsquad/tic-tac-token-lsp/dist/server.js --stdio
```

The server filters by URI (`.tokens` / `.tokens.json` only), so attaching it to the broader JSON language is safe — non-token JSON files get no diagnostics or hover from this server.

### Developing this extension (this monorepo only)

If the open worktree has a locally built `lsp/dist/server.js`, the extension launches that instead of installing from npm — so hacking on the LSP itself doesn't require publishing first:

```sh
pnpm -F @oddsquad/tic-tac-token-lsp build:dist
```

## Verify

After install:

- Open `example.json` or `app/token-playground/src/demo-tokens.json` in Zed.
- Hover any token. Markdown popup should show the path, `$type`, literal value, resolved value, and a color swatch for `color` tokens.
- Introduce a typo (e.g. change a `colorSpace` to `"bogus"`) and see the diagnostic appear inline.

Check the Zed log if it doesn't appear:

```sh
tail -F ~/Library/Logs/Zed/Zed.log | grep dtcg-tokens-lsp
```

You should see a line like `starting language server process. binary path: ".../node", ... args: [".../node_modules/@oddsquad/tic-tac-token-lsp/dist/server.js", "--stdio"]`.

## Distribution

This works as a dev extension for any project now that the LSP installs from npm. Publishing to the Zed marketplace is a separate, deferred step — it needs repo/manifest metadata and marketplace review, not a distribution-model change.
