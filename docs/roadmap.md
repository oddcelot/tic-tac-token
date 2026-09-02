# Roadmap

Three larger directions this project could take. Listed in recommended build order — each layer leverages the one below.

---

## 1. Standard Schema validator (package this repo)

**Goal:** publish the arktype-backed token types as a tree-shakable npm package so any tool that consumes [Standard Schema](https://standardschema.dev/) (tRPC, form libs, OpenAPI generators, zod/valibot/arktype interop) can validate DTCG tokens at runtime.

**Why it's first:** arktype 2.x already implements the `~standard` interface natively, so `Token` / `TokensFile` are *already* Standard-Schema-compatible. The work is purely packaging:

- Split into a publishable package (`package.json` `exports` map, sideEffect-free entries, individual type exports for tree-shaking).
- Decide public surface: per-type validators (`Color`, `Dimension`, …), the full `Token` union, the recursive `TokensFile`, and resolver helpers from the playground (`resolveRefs`, `resolveAliases`, JSON Pointer walk).
- Ship the JSON Schema as a sibling artifact for editor consumers that can't run JS.

**Effort:** hours, not days. Mostly mechanical.

**Compounds because:** the LSP and Vite plugin below should both *consume* this package instead of re-implementing the types.

---

## 2. LSP for `.tokens.json` files

**Goal:** language-server features in any LSP-capable editor (VS Code, Zed, Neovim, Helix).

**Prior art:** [`bennypowers/design-tokens-language-server`](https://github.com/bennypowers/design-tokens-language-server) already tracks DTCG 2025.10 stable. Decision point:

- **Contribute upstream** — faster reach, less surface to maintain. Best if their architecture already supports what we'd add.
- **Build our own** — backed by the arktype types + the playground resolver (`resolveRefs`, alias resolution, JSON Pointer walk). Group-`$type` inheritance is the only remaining resolver gap. Worth doing only if we want a different architecture or features.

**Features that would shine:**

- Diagnostics from arktype (precise, type-aware messages).
- Hover shows the *resolved* value, not just the literal — e.g. hover an alias `"{color.primary}"` and see the underlying color swatch + components.
- Go-to-definition on `{alias}` strings and `$ref` JSON Pointers.
- Find-references — every place a token is consumed.
- Inline color swatches in the gutter for `color` tokens.
- Completion for closed enums: `colorSpace`, fontWeight aliases, strokeStyle enums, units.
- Validate `$extends` deep-merge and cycle detection.

**Effort:** weeks. LSP boilerplate, document sync, position mapping, plus the smarts above.

---

## 3. Vite devtools panel for design tokens

**Goal:** browser devtools panel that visualizes the live token tree during `vite dev`, lets you inspect any rendered element to see which tokens drive it, and hot-edits values back to the source files.

**Architecture:**

1. **Vite plugin** — watches `**/*.tokens.json`, runs arktype validation on change, emits:
   - a CSS file with `:root { --token-name: value; }` per token,
   - a JSON manifest mapping CSS-var name ↔ token path ↔ source location.
2. **Runtime probe** — injected into the dev server. Walks `getComputedStyle` for hovered elements, cross-references the manifest, surfaces "this color came from `color.brand.primary` at `tokens/colors.tokens.json:14`".
3. **Devtools panel** — Chrome extension (or the new Vite devtools framework). Renders the token tree, shows resolved values, lets you edit, HMRs the change back to disk.

**Why it's last:** it presupposes a consumer story — a project that *actually uses* these tokens at runtime via CSS vars (or similar). Without that, there's nothing to inspect. Also the surface is the largest by far.

**Effort:** weeks-to-months. Vite plugin is small; the devtools panel and bidirectional HMR are the bulk.

---

## Cross-cutting prerequisite: resolver pass

All three benefit from a complete resolver — currently only the playground has a partial one. Worth lifting into the core package as part of #1:

- `$ref` JSON Pointer dereference (✓ in playground).
- `{alias}` curly-brace resolution with cycle detection (✓ in playground).
- `$extends` deep-merge group inheritance (missing).
- Group-`$type` inheritance to typeless children (missing — currently each typeless token is accepted as `unknown`).
- Gradient position clamping to `[0, 1]` (missing — validator accepts any number).
- Mode / theme application (playground-local extension; could stay there).

This is the single piece of work that unlocks all three roadmap items moving from "validation-only" to "useful resolved tokens."

**Status:** done — the pipeline lives in `src/resolver/` and ships on the
`/resolver` subpath. The DTCG Resolver Module (sets / modifiers /
resolutionOrder) is implemented separately in `src/resolver-module/` and ships
on `/resolver-module`.

---

## Cross-cutting: the emission layer

`resolveResolverDocument` is a point query — one input combination in, one
resolved document out. Anything that *switches* contexts at runtime needs every
combination addressable at once, which is the layer built on top of it:

- `src/resolver-module/permutations.ts` — modifier axes, the cartesian product,
  and `resolvePermutations`, which validates the document once and reuses the
  resolution order across every point.
- `src/css/factor.ts` — factors the resulting value matrix into a base plus the
  minimum overrides, so a compound selector appears only where a value really
  depends on a combination of modifiers.
- `src/css/theme.ts` — `resolverDocumentToCssTheme`, which renders that into a
  stylesheet, keeping whole-value aliases as `var()` so the cascade composes
  modifiers that would otherwise interact.
- `src/node/load.ts` — the `./node` subpath, reading a document and its `$ref`
  targets off disk without dragging `node:fs` into the browser entries.

That covers item 3's first bullet below. What remains for the Vite plugin is
the watch loop and the source-location manifest; the emitter and the CSS-var ↔
token-path index (`CssThemeSheet.roles` / `.matrix`) already exist.
