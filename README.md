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

## License

ISC
