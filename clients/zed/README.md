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

It also passes your Zed `lsp.dtcg-tokens-lsp.initialization_options` and `.settings` straight through to the server, so config like the token-file scan overrides below reaches the LSP.

## Highlighting & swatches

The server provides LSP **semantic tokens** and **document colors**. Zed renders document colors automatically; semantic tokens are opt-in.

```jsonc
// ~/.config/zed/settings.json
{
  // Semantic tokens are OFF by default in Zed. Opt in globally or per-language:
  "semantic_tokens": "combined",   // overlay LSP tokens on tree-sitter; "full" replaces it, "off" disables
  "languages": {
    "JSON": { "semantic_tokens": "combined" }
  },

  // Color swatches (on by default). "inlay" | "border" | "background" | "none":
  "lsp_document_colors": "inlay",

  // Theme the semantic tokens the server emits:
  "global_lsp_settings": {
    "semantic_token_rules": [
      { "token_type": "variable", "token_modifiers": ["reference"], "style": ["variable.special", "variable"] },
      { "token_type": "variable", "token_modifiers": ["unresolved"], "foreground_color": "#c93f3f", "underline": true },
      { "token_type": "namespace", "style": ["namespace", "module"] },
      { "token_type": "property", "token_modifiers": ["deprecated"], "strikethrough": true }
    ]
  },

  // Optional: tune the workspace token-file scan.
  "lsp": {
    "dtcg-tokens-lsp": {
      "initialization_options": { "tokenFiles": { "exclude": ["fixtures"] } }
    }
  }
}
```

The legend is: token types `namespace` (groups), `property` (token declarations), `variable` (`{alias}` / `$ref` references), `enumMember` (`$type` values, mode names); modifiers `declaration`, `deprecated`, `reference`, `unresolved`. `reference` and `unresolved` are custom — rules match them by name; token types Zed doesn't recognize fall back to the base type's style.

Semantic-token support landed in Zed ~v0.224 (Feb 2026); update Zed if the `semantic_tokens` setting has no effect. Zed doesn't request semantic-token *ranges*, so the server only advertises `full`.

### Which server gets launched

The extension resolves the server in three tiers (highest priority first):

1. **Explicit `binary` override** — if you set `lsp.dtcg-tokens-lsp.binary` in Zed settings, it's used verbatim. This is the dev/publish switch and works from **any** project.
2. **Monorepo auto-detection** — if the open worktree is this monorepo (root `package.json` names `@oddsquad/tic-tac-token` **and** `lsp/package.json` names `@oddsquad/tic-tac-token-lsp`), the locally built `lsp/dist/server.js` is launched.
3. **Published npm package** — otherwise `@oddsquad/tic-tac-token-lsp` is installed from npm and launched.

> The auto-detection (tier 2) fingerprints **tracked** manifests, not the built `lsp/dist/server.js` — `dist/` is gitignored and Zed's worktree API can't read ignored files, so gating on it would (and did) always fail. Build the server first: `pnpm -F @oddsquad/tic-tac-token-lsp build:dist`.

### Pointing at a local build from any project (the switch)

To run a locally built server from a project that **isn't** this monorepo (e.g. a scratch folder, or to test an unpublished change), set the `binary` override — remove it to fall back to the published package:

```jsonc
// Zed settings.json
{
  "lsp": {
    "dtcg-tokens-lsp": {
      // Just the arguments → run with Zed's managed Node:
      "binary": {
        "arguments": [
          "/absolute/path/to/tic-tac-token/lsp/dist/server.js",
          "--stdio"
        ]
      }
    }
  }
}
```

Or give a full `path` (any runtime) plus `arguments`:

```jsonc
{
  "lsp": {
    "dtcg-tokens-lsp": {
      "binary": {
        "path": "/absolute/path/to/node",
        "arguments": ["/absolute/path/to/lsp/dist/server.js", "--stdio"]
      }
    }
  }
}
```

### Developing this extension (this monorepo)

Inside this monorepo, tier 2 launches your local build automatically — just build it first:

```sh
pnpm -F @oddsquad/tic-tac-token-lsp build:dist
```

Changes to `lib.rs` (this extension's Rust) require a rebuild: uninstall + **Install Dev Extension** again from the Extensions panel.

## Verify

After install:

- Open `example.json` or `app/token-playground/src/demo-tokens.json` in Zed.
- Hover any token. Markdown popup should show the path, `$type`, literal value, resolved value, and a color swatch for `color` tokens.
- Introduce a typo (e.g. change a `colorSpace` to `"bogus"`) and see the diagnostic appear inline.
- `color` tokens and `{alias}` strings pointing at them show an inline color swatch.
- With `"semantic_tokens": "combined"` set, groups, token names, and references pick up distinct highlighting.
- In a workspace with multiple `.tokens.json` files, hovering a `{alias}` that points into another file shows its resolved value labelled `Resolved from <file>`, and the broken-locally alias is a hint (not a red error).

Check the Zed log if it doesn't appear:

```sh
tail -F ~/Library/Logs/Zed/Zed.log | grep dtcg-tokens-lsp
```

You should see a line like `starting language server process. binary path: ".../node", ... args: [".../node_modules/@oddsquad/tic-tac-token-lsp/dist/server.js", "--stdio"]`.

## Distribution

This works as a dev extension for any project now that the LSP installs from npm. Publishing to the Zed marketplace is a separate, deferred step — it needs repo/manifest metadata and marketplace review, not a distribution-model change.
