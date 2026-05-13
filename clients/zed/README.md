# Zed extension — DTCG Tokens

Registers `dtcg-tokens-lsp` with Zed so it auto-attaches to JSON files in this workspace. The LSP itself is in [`../../lsp`](../../lsp); this extension just tells Zed how to launch it.

## Install (dev extension)

Prerequisites:

- `cargo` and the `wasm32-wasip1` target (`rustup target add wasm32-wasip1`).
- The LSP server built at `lsp/dist/server.js` — run from repo root:

  ```sh
  pnpm -F dtcg-tokens-lsp build:dist
  ```

Then in Zed:

1. Open the Extensions panel: `Cmd-Shift-X`.
2. Click `Install Dev Extension`.
3. Select this `clients/zed/` directory.

Zed builds the extension WASM (`cargo build --target wasm32-wasip1 --release`) and installs it. Reload the project (or restart Zed) and open any `.tokens.json` file — the LSP attaches automatically.

## What it does

The extension exposes a single `language_server_command` callback that returns:

```
node <worktree>/lsp/dist/server.js --stdio
```

The server filters by URI (`.tokens` / `.tokens.json` only), so attaching it to the broader JSON language is safe — non-token JSON files get no diagnostics or hover from this server.

## Verify

After install:

- Open `example.json` or `app/token-playground/src/demo-tokens.json` in Zed.
- Hover any token. Markdown popup should show the path, `$type`, literal value, resolved value, and a color swatch for `color` tokens.
- Introduce a typo (e.g. change a `colorSpace` to `"bogus"`) and see the diagnostic appear inline.

Check the Zed log if it doesn't appear:

```sh
tail -F ~/Library/Logs/Zed/Zed.log | grep dtcg-tokens-lsp
```

You should see a line like `starting language server process. binary path: ".../node", ... args: [".../lsp/dist/server.js", "--stdio"]`.

## Distribution

For now this is a **dev extension** only. To publish to the Zed marketplace, the LSP would need to be a self-contained binary (or this extension would need to download Node + the server at install time, the way the `asimonim` extension downloads its Go binary).
