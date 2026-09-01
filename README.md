# @oddsquad/tic-tac-token

Runtime validator for the [Design Tokens Format Module 2025.10](https://tr.designtokens.org/format/) (DTCG). Backed by [arktype](https://arktype.io); exposes the [Standard Schema](https://standardschema.dev) interface so it slots into anything that accepts a Standard-Schema-compatible validator (tRPC, form libraries, OpenAPI generators, etc.).

Ships the canonical [JSON Schema](./schema.json) artifact for editor tooling (Monaco, vscode-json-languageservice, Zed) alongside the runtime types.

## Install

```sh
pnpm add @oddsquad/tic-tac-token
# or: npm install @oddsquad/tic-tac-token
```

## Quick start

```ts
import { Token, TokensFile } from "@oddsquad/tic-tac-token";

// Validate a single token
const result = Token({
  $type: "color",
  $value: {
    colorSpace: "srgb",
    components: [1, 0, 0],
    alpha: 1,
    hex: "#ff0000",
  },
});

if (result instanceof Token.errors) {
  console.error(result.summary);
} else {
  console.log("valid:", result);
}

// Validate a whole tokens document (recursive group structure)
const fileResult = TokensFile({
  colors: {
    $type: "color",
    primary: {
      $value: {
        colorSpace: "oklch",
        components: [0.7, 0.2, 30],
      },
    },
  },
});
```

See [`examples/simple`](./examples/simple) for a full runnable example.

## Standard Schema

Every exported validator carries the `~standard` property and works with any Standard-Schema consumer:

```ts
import { Token } from "@oddsquad/tic-tac-token";

const { value, issues } = Token["~standard"].validate({
  $type: "dimension",
  $value: { value: 16, unit: "px" },
});

if (issues) {
  // [{ message, path }, ...]
  console.error(issues);
} else {
  // typed token
  console.log(value);
}
```

## Exports

### Structural

- **`Token`** — discriminated union of every token shape (typed + `$ref` form + typeless).
- **`Group`** — a non-token group: holds nested groups/tokens plus optional `$type` / `$description` / `$extensions` / `$extends` / `$deprecated` / `$root`.
- **`TokensFile`** — alias for the root `Group`; use this to validate an entire tokens document.
- **`TokenTypeName`** — the union of the 13 DTCG type strings.

### Per-type validators

Full token shape (`{ $type, $value }`) for each DTCG type:

`Color`, `Dimension`, `FontFamily`, `FontWeight`, `Duration`, `CubicBezier`, `Number`, `StrokeStyle`, `Border`, `Transition`, `Shadow`, `Gradient`, `Typography`.

### Per-type value schemas

Just the `$value` portion of each type — useful when you've already established the `$type` elsewhere:

`ColorValue`, `DimensionValue`, `FontFamilyValue`, `FontWeightValue`, `DurationValue`, `CubicBezierValue`, `NumberLiteralValue`, `StrokeStyleValue`, `BorderValue`, `TransitionValue`, `ShadowValue`, `GradientValue`, `TypographyValue`.

### Primitives

- **`ValueAlias`** — matches `"{group.token}"` curly-brace references.
- **`JsonPointerRef`** — RFC 6901 JSON Pointer strings (`"#/..."`) for the `$ref` token form.
- **`JsonPointerRefObject`** — `{ "$ref": "#/..." }` object for nested-`$ref` form (DTCG 2025.10 §4.2).
- **`DimensionPrimitive`**, **`Extensions`**, **`CommonMetadata`**.

## JSON Schema

The same coverage is published as a JSON Schema draft-2020-12 document for editor tooling:

```jsonc
// .vscode/settings.json
{
  "json.schemas": [
    { "fileMatch": ["*.tokens", "*.tokens.json"], "url": "./node_modules/@oddsquad/tic-tac-token/schema.json" }
  ]
}
```

```jsonc
// .zed/settings.json — same json-language-server, nested under lsp
{
  "lsp": {
    "json-language-server": {
      "settings": {
        "json": {
          "schemas": [
            { "fileMatch": ["*.tokens", "*.tokens.json"], "url": "./node_modules/@oddsquad/tic-tac-token/schema.json" }
          ]
        }
      }
    }
  }
}
```

Editor settings aside, a tokens file can also point at the schema directly — the path is resolved relative to the file, so this works for any consumer with the package installed:

```jsonc
// tokens.json
{ "$schema": "./node_modules/@oddsquad/tic-tac-token/schema.json" }
```

Or import the URL programmatically:

```ts
import schema from "@oddsquad/tic-tac-token/schema.json" with { type: "json" };
```

## Spec coverage

Full DTCG 2025.10 reference (basic + composite types, `$ref` / `{alias}` / `$extends` semantics, validation edge cases): [docs/dtcg-spec.md](https://github.com/oddcelot/tic-tac-token/blob/main/docs/dtcg-spec.md).

Intentional deviations from the spec where validation alone can't enforce the rule are documented in `docs/dtcg-spec.md` §7. In short:

- `gradient.position` accepts any number at the validation layer; clamping to `[0, 1]` is handled by the resolver.
- Typeless tokens (no `$type`, no inheritable group `$type`, no `$ref`) accept `$value: unknown` at the validation layer and are shape-checked during resolution.

## Resolver

The `@oddsquad/tic-tac-token/resolver` subpath exports the full resolution pipeline: `$extends` deep-merge, `$ref` dereferencing (token-root + nested), group-`$type` inheritance, `{alias}` resolution, and gradient position clamping.

```ts
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";

const { tokens, byPath, errors, references } = resolveTokens(parsedTokensDocument);

// tokens:     FlatToken[] — flattened, fully resolved token list
// byPath:     Map<string, FlatToken> — indexed by dot-path
// errors:     ResolverError[] — broken refs, alias cycles, $extends cycles, …
// references: Map<string, Set<string>> — reverse reference graph (who consumes each token)
```

Individual pipeline stages (`applyExtends`, `resolveRefs`, `flattenTokens`, `resolveAliases`, `clampGradients`) and `jsonPointerGet` are exported for advanced use.

## Resolver Module

The `@oddsquad/tic-tac-token/resolver-module` subpath implements the separate [DTCG Resolver Module](https://www.designtokens.org/tr/2025.10/resolver/): a resolver document declaring `sets`, `modifiers`, and a `resolutionOrder`, resolved against string inputs.

```ts
import { resolveResolverDocument } from "@oddsquad/tic-tac-token/resolver-module";

const { tokens, mergedTree, documentErrors, tokenErrors } = resolveResolverDocument(
  parsedResolverDocument,
  { theme: "dark" },
);

// tokens:         ResolvedTokens — the merged document run through resolveTokens
// mergedTree:     the merged token tree, before alias resolution
// documentErrors: ResolverModuleError[] — bad pointers, unknown inputs, duplicate names, …
// tokenErrors:    ResolverError[] — diagnostics from resolving the merged tokens
```

Inputs are matched case-insensitively. Same-document `$ref`s resolve on their own; external files are supplied pre-parsed via `options.externalDocuments`, keyed by the pointer's pre-`#` portion, which keeps resolution synchronous.

## CSS output

The `/css` subpath turns resolved tokens into CSS custom properties. For a single token set that's `tokensToCssVars`; for a resolver document with modifiers, `resolverDocumentToCssTheme` emits a *themed* stylesheet.

```ts
import { loadResolverDocumentSync } from "@oddsquad/tic-tac-token/node";
import { resolverDocumentToCssTheme } from "@oddsquad/tic-tac-token/css";

const { document, externalDocuments } = loadResolverDocumentSync("./resolver.json");
const { css, blocks, matrix, diagnostics } = resolverDocumentToCssTheme(document, {
  externalDocuments,
});
```

The base permutation (every modifier at its default) becomes a `:root` block; each other context becomes a scoped block carrying **only the properties whose value differs**. Switching theme at runtime is then one attribute.

Two things stop the sheet growing as the product of the contexts.

**Factoring.** A block holds only what changes, and a compound selector — `:root[data-theme="dark"][data-density="compact"]` — is emitted only where some property genuinely depends on the *combination*. Orthogonal modifiers cost `Σ|contexts|` blocks, not `Π|contexts|`. Resolving the full product is guarded by `maxPermutations` (default 512); above it only single-axis variations are enumerated and an `assumed-orthogonal` diagnostic says so, rather than truncating silently.

**`aliases: "var"` (the default).** The Resolver Module resolves aliases *after* the merge (§6.3), which is what lets a `colorScheme` modifier contribute nothing but semantic aliases into a `theme` modifier's palette:

```jsonc
// tokens/palette/astro.json — theme-specific literals
{ "palette": { "$type": "color", "background": { "light": { "$value": { /* … */ } } } } }

// tokens/scheme/light.json — never names a theme
{ "color": { "$type": "color", "background": { "$value": "{palette.background.light}" } } }
```

Keeping that indirection in the output emits `--color-background: var(--palette-background-light)`, so the cascade composes theme × scheme and the scheme block is theme-independent. Flattening the same document to literals instead would need one compound block per theme × scheme pair. Pass `aliases: "flatten"` if you want the literals.

### Selectors

How a context maps to a CSS condition isn't something the spec covers, so it's configurable — via the `selectors` option, or in the document itself under `modifiers.<name>.$extensions["tic-tac-token.css"]` (the schema already admits `$extensions` there, so the document stays spec-valid). With neither, the default is `[data-<modifier>="<context>"]`.

```jsonc
"$extensions": {
  "tic-tac-token.css": {
    "colorScheme": true,
    "dark": [
      { "kind": "media", "query": "(prefers-color-scheme: dark)" },
      { "kind": "attribute", "attribute": "data-color-scheme", "value": "dark" }
    ]
  }
}
```

An array means "emit the same declarations once per alternative" — the answer to *follow the system preference by default, but let an explicit choice win*. Unconditional variants are always emitted **after** at-rule-gated ones, so `data-color-scheme="light"` still wins on a dark-preferring OS.

`kind` is one of `root`, `attribute`, `class`, `media`, `supports`, `selector`. `colorScheme: true` marks the modifier that drives native `color-scheme`.

### Naming

A token's custom property is its path, kebab-cased per segment: `space.itemGap` → `--space-item-gap`, matching what the language server reads back from a `var()`. A `$root` segment is dropped (`color.accent.$root` → `--color-accent`).

Composite types contribute a shorthand *and* sub-properties — `--border-focus` alongside `--border-focus-width`/`-style`/`-color`. Two types have no lossless shorthand and emit sub-properties only: `typography` (CSS `font` can't express `letterSpacing`) and the `{dashArray, lineCap}` form of `strokeStyle`. A `gradient` emits its stop list rather than a `linear-gradient(...)`, since a DTCG gradient declares no direction — so it composes into any gradient function.

The mapping is not reversible, so `color.brandPrimary` and `color.brand.primary` collide; the emitter reports that as a `var-collision` diagnostic rather than silently dropping one.

## Loading from disk

Resolution is synchronous and does no I/O by design, which keeps the core usable in a browser. `@oddsquad/tic-tac-token/node` is the one entry point that touches the filesystem:

```ts
import { loadResolverDocument, loadResolverDocumentSync } from "@oddsquad/tic-tac-token/node";
// → { path, document, externalDocuments, errors }
```

It walks every `$ref` and keys each document by the exact pre-`#` URI, which is what `options.externalDocuments` expects. Nothing throws — a missing or malformed file becomes a diagnostic. Remote (`http(s):`) references are reported rather than fetched.

One limitation worth knowing: because `externalDocuments` is a flat map keyed by the raw URI, every reference resolves against the **entry** document's directory, not the directory of the file that wrote it. A nested relative `$ref` is therefore diagnosed rather than silently pointing elsewhere.

## License

ISC
