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
- **Completion** — alias-path completion inside `{…}` strings and JSON Pointer completion inside `"$ref": "#/…"` strings. Suggestions include tokens defined in *other* workspace files.
- **Semantic tokens** — classifies groups, token declarations, `{alias}` / `$ref` references, `$type` values, and mode names so editors can theme them independently of the JSON grammar. Uses standard LSP token types (`namespace`, `property`, `variable`, `enumMember`) plus `declaration` / `deprecated` / `reference` / `unresolved` modifiers.
- **Document colors** — inline swatches (`textDocument/documentColor`) for `color` tokens and for `{alias}` / `$ref` strings that resolve to a color, converting all 12 DTCG color spaces to sRGB for display.
- **Workspace awareness** — scans the workspace for `*.tokens` / `*.tokens.json` files so `{alias}` references resolve **across files**: cross-file hover shows the resolved value and its source file, and a broken alias whose target lives in another file is downgraded from an error to a hint.
- **CSS `var(--…)` usages** — in `.css` / `.scss` / `.less` files, a `var(--color-brand-primary)` reference gets an inline color swatch (for color tokens) and a hover showing the resolved token value, type, and source file. Tokens map to custom properties by the Style-Dictionary convention: dot-path → kebab-case, e.g. `color.brand.primary` → `--color-brand-primary`.
- **Go to definition** — from an `{alias}` string or a `$ref` pointer, jumps to the target token's name. Aliases resolve cross-file via the workspace index; `$ref` JSON Pointers are single-document.
- **Find references** — from a token's definition (or any alias pointing at it), lists all `{alias}` usages and `$ref` pointers that reference it, across the whole workspace, with the definition included first.

Planned (v1+): document symbols, semantic-token deltas, nested colors inside composite tokens (shadow/border/gradient).

## Capabilities

| Capability | Method | Notes |
| --- | --- | --- |
| Diagnostics | `textDocument/publishDiagnostics` | Pushed on open/change. |
| Hover | `textDocument/hover` | Cross-file alias resolution when a workspace is open. |
| Go to definition | `textDocument/definition` | `{alias}` and `$ref` targets; aliases resolve cross-file. |
| Find references | `textDocument/references` | `{alias}` usages + `$ref` pointers across the workspace; includes the definition. |
| Completion | `textDocument/completion` | `{alias}`, `$ref` pointers, `$type` values. |
| Semantic tokens | `textDocument/semanticTokens/full` | `full` only — no `range`/`delta` yet. Token documents only. |
| Document colors | `textDocument/documentColor`, `textDocument/colorPresentation` | Token documents (token/alias values) **and** CSS `var(--…)` usages. Presentation is a hex label only (no text edit — a bare hex would clobber the token/var). |
| Hover | `textDocument/hover` | Also on CSS `var(--…)` usages (resolved token value + source file). |

## Configuration

Pass `initializationOptions` when the client starts the server (see each editor's LSP config below):

```jsonc
{
  "tokenFiles": {
    "exclude": ["fixtures", "snapshots"], // extra directory names to skip when scanning
    "maxFiles": 1000                        // cap on files indexed (default 500)
  }
}
```

The scanner already skips `node_modules`, `.git`, `dist`, `build`, and `out`, and ignores files larger than 1 MiB.

### Cross-file resolution semantics

Each file is still resolved **on its own** by the core resolver — a `{alias}` is only truly resolved when its target lives in the same file. The workspace index is a *display* layer on top: when a local lookup misses, the server consults the index to show a hover value (labelled `Resolved from <file>`) and to soften the diagnostic to a hint. `$ref` JSON Pointers stay single-document by definition and are not resolved cross-file.

The index is built from a filesystem scan **only under the Node transport**. The browser/Worker build (used by the playground) has no filesystem access, so its index holds only the documents currently open in the editor.

### CSS `var(--…)` resolution

`.css` / `.scss` / `.less` documents are never analyzed as DTCG — they only get `documentColor` swatches and hover, resolved against the workspace token index. A `var(--name)` is mapped back to a token by forward-computing every indexed token's custom-property name (convention A: `color.brand.primary` → `--color-brand-primary`) and matching — kebab-casing isn't losslessly reversible, so the var name is never parsed into a path. Mode variants (`path@mode`) have no `var()` form. Under the Node transport the disk scan seeds the index, so `var()` resolves even when the token file isn't open; in the browser the referenced token file must be open.

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

Document color swatches work out of the box. To style the semantic tokens, use `editor.semanticTokenColorCustomizations`:

```jsonc
{
  "editor.semanticTokenColorCustomizations": {
    "enabled": true,
    "rules": {
      "variable.reference": { "foreground": "#4fc1ff" },   // {alias} / $ref that resolves
      "*.unresolved": { "foreground": "#c93f3f", "underline": true }, // dangling reference
      "property.deprecated": { "strikethrough": true }
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
      "binary": { "path": "dtcg-tokens-lsp", "arguments": ["--stdio"] },
      "initialization_options": { "tokenFiles": { "exclude": ["fixtures"] } }
    }
  }
}
```

Semantic tokens are **off by default in Zed** — see the [Zed extension README](../clients/zed/README.md#highlighting--swatches) for the `semantic_tokens` / `semantic_token_rules` / `lsp_document_colors` settings.

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
