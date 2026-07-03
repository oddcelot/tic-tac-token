# @oddsquad/tic-tac-token-lsp

Language server for [DTCG 2025.10](https://tr.designtokens.org/format/) design-tokens files. First-class editor support for `.tokens.json` (and `.tokens`) files: arktype-precise diagnostics, hover that surfaces *resolved* values, resolved-value hover, and context-aware completion for `{alias}` strings and `$ref` JSON Pointers.

Backed by the [`@oddsquad/tic-tac-token`](../README.md) validator + resolver.

## v0 features

- **Diagnostics** — surface arktype validation issues, jsonc-parser syntax errors, and resolver errors (broken `{alias}`, unreachable `$ref`, `$extends` cycles, group-`$type` inheritance failures) at precise source ranges.
- **Hover** — over any token, show:
  - dot-path, `$type`, `$description`
  - the literal `$value`
  - the **resolved** `$value` (after `{alias}` / `$ref` / `$extends`)
  - a CSS color swatch for `color` tokens
  - `$deprecated` flag where set.
- **Completion** — alias-path completion inside `{…}` strings and JSON Pointer completion inside `"$ref": "#/…"` strings.

Planned (v1+): go-to-definition, references, document symbols, document colors.

## Install

```sh
npm install -g @oddsquad/tic-tac-token-lsp
```

The package ships a `dtcg-tokens-lsp` bin that speaks LSP over stdio with `--stdio`.

## Editor integration

### VS Code

Until a dedicated extension ships, use any "generic LSP" extension. Example with the `Language Server Client` extension:

```jsonc
// .vscode/settings.json
{
  "languageServerClient.servers": {
    "dtcg-tokens-lsp": {
      "command": ["dtcg-tokens-lsp", "--stdio"],
      "filetypes": ["json"],
      "rootPatterns": [".git"]
    }
  }
}
```

### Zed

```jsonc
// ~/.config/zed/settings.json
{
  "languages": {
    "JSON": {
      "language_servers": ["dtcg-tokens-lsp"]
    }
  },
  "lsp": {
    "dtcg-tokens-lsp": {
      "binary": { "path": "dtcg-tokens-lsp", "arguments": ["--stdio"] }
    }
  }
}
```

### Neovim (nvim-lspconfig)

```lua
require('lspconfig.configs').dtcg_tokens = {
  default_config = {
    cmd = { 'dtcg-tokens-lsp', '--stdio' },
    filetypes = { 'json' },
    root_dir = function() return vim.fn.getcwd() end,
  },
}
require('lspconfig').dtcg_tokens.setup({})
```

### Helix

```toml
# ~/.config/helix/languages.toml
[language-server.dtcg-tokens-lsp]
command = "dtcg-tokens-lsp"
args = ["--stdio"]

[[language]]
name = "json"
language-servers = ["dtcg-tokens-lsp"]
```

## Activation

The server attaches to JSON documents. File-type matching against `*.tokens.json` / `*.tokens` is the client's responsibility — point your editor at the LSP for the filetypes you want.

## Architecture

The server is a thin orchestration layer over three pieces:

1. **`jsonc-parser`** — produces an AST with `offset`/`length` per node. The basis for mapping arktype error paths back to source ranges and for the hover handler's cursor-to-token resolution.
2. **`@oddsquad/tic-tac-token`** — the arktype-backed validator. Runs against the parsed JSON value via the [Standard Schema](https://standardschema.dev) interface (`TokensFile['~standard'].validate`).
3. **`@oddsquad/tic-tac-token/resolver`** — applies `$extends` deep-merge, dereferences `$ref` (token-root + nested), flattens with group-`$type` inheritance, resolves `{alias}` strings, clamps gradient positions. Returns the resolved token list, an inverse reference graph (for find-references in a future version), and an aggregated error list.

### Browser entry

`@oddsquad/tic-tac-token-lsp/browser` exports a Worker-ready server entry that self-invokes — construct a `Connection` bound to the worker's `globalThis` and register all handlers — so importing it for side effects is all a Web Worker entry needs. Used by the repo's Monaco playground via `import "@oddsquad/tic-tac-token-lsp/browser"` in a Vite Web Worker.

## Development

```sh
# from repo root
pnpm install                 # workspace install
pnpm -F @oddsquad/tic-tac-token build:dist
pnpm -F @oddsquad/tic-tac-token-lsp build:dist
pnpm -F @oddsquad/tic-tac-token-lsp test
```

The integration tests spawn the built `dist/server.js` and exchange real LSP JSON-RPC over stdio.

## License

ISC
