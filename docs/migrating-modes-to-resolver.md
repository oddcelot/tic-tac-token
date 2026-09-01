# Migrating `tic-tac-token.modes` to the Resolver Module

`$extensions["tic-tac-token.modes"]` predates the DTCG Resolver Module. It is a
non-standard extension of this project: it lets one token carry alternate values
inline, which the resolver expands into extra `FlatToken`s at `path@mode`.

It still works, and nothing in core has been removed. But a resolver document
expresses the same thing as a first-class modifier, and does several things the
extension cannot:

- **Composes.** Theme × colour scheme × density are independent axes. Modes are
  a single flat namespace with no notion of combining.
- **Deduplicates.** A mode variant repeats the whole value even when only one
  field changed. A modifier context contributes only what it overrides.
- **Is portable.** Any DTCG tool reads a resolver document. `tic-tac-token.modes`
  means something only here.
- **Has one unambiguous CSS mapping.** A mode variant shares a custom property
  with its own base, so a token list containing both is order-dependent — see
  `tokensToCssVars` below.

## Side by side

Before — one document, values inline:

```jsonc
{
  "color": {
    "background": {
      "$type": "color",
      "$value": { "colorSpace": "srgb", "components": [0.97, 0.98, 0.98], "alpha": 1, "hex": "#F7FAF9" },
      "$extensions": {
        "tic-tac-token.modes": {
          "dark": { "colorSpace": "srgb", "components": [0.06, 0.13, 0.12], "alpha": 1, "hex": "#0F211F" }
        }
      }
    }
  }
}
```

After — a palette, a scheme that only remaps roles onto it, and a manifest:

```jsonc
// tokens/palette.json
{ "palette": { "$type": "color", "background": {
  "light": { "$value": { "colorSpace": "srgb", "components": [0.97, 0.98, 0.98], "alpha": 1, "hex": "#F7FAF9" } },
  "dark":  { "$value": { "colorSpace": "srgb", "components": [0.06, 0.13, 0.12], "alpha": 1, "hex": "#0F211F" } }
} } }

// tokens/scheme/light.json      // tokens/scheme/dark.json
{ "color": { "$type": "color",   // { "color": { "$type": "color",
  "background": {                //     "background": {
    "$value": "{palette.background.light}" } } }  //  "$value": "{palette.background.dark}" } } }

// resolver.json
{
  "version": "2025.10",
  "sets": { "base": { "sources": [{ "$ref": "tokens/palette.json#" }] } },
  "modifiers": {
    "colorScheme": {
      "default": "light",
      "$extensions": { "tic-tac-token.css": { "colorScheme": true } },
      "contexts": {
        "light": [{ "$ref": "tokens/scheme/light.json#" }],
        "dark":  [{ "$ref": "tokens/scheme/dark.json#" }]
      }
    }
  },
  "resolutionOrder": [{ "$ref": "#/sets/base" }, { "$ref": "#/modifiers/colorScheme" }]
}
```

The scheme files never name a palette *variant set* — they name palette steps.
That is what makes them reusable across themes: add a `theme` modifier
contributing a different `palette.*`, and the same two scheme files keep
working, because the Resolver Module merges every source before it resolves any
alias (§6.3).

`examples/storybook-demo/` is this migration, done.

## What changes in your code

| Before | After |
|---|---|
| `parseTokens(raw, "dark")` | `resolveForContext(context)` (Storybook), or `resolveResolverDocument(doc, { colorScheme: "dark" })` |
| `tokensToCssVars(tokens.filter(t => t.mode === "dark"))` | `resolverDocumentToCssTheme(doc)` — emits every context as scoped blocks |
| A `colorScheme` global you registered yourself | Derived from the document by `tokenPreviewAddon()` |

## The `tokensToCssVars` caveat

A mode variant maps to the same custom property as its base — that is the point,
so a role's name stays stable across schemes. It also means passing a list that
mixes a base token *and* its own `@dark` variant is ambiguous: whichever comes
last in the array wins.

`tokensToCssVars` is the single-permutation path, so the contract is that the
caller filters to one mode first. To emit several at once, use
`tokensToCssTheme`, which lowers each mode into a synthetic axis and gives you
properly scoped blocks:

```ts
import { tokensToCssTheme } from "@oddsquad/tic-tac-token/css";

const { css } = tokensToCssTheme(resolveTokens(document));
// :root { --color-background: #F7FAF9; }
// :root[data-mode="dark"] { --color-background: #0F211F; }
```

That is a stopgap for documents mid-migration. A resolver document is the
destination.

## Timeline

Deprecated, not removed. `src/resolver/flatten.ts` still expands modes and
`FlatToken.mode` remains part of the resolver's public surface. The Storybook
addon ignores mode variants on the resolver path and warns once per document,
because leaving them in would let a `@dark` value clobber its own base.
