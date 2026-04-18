# arktype `toJsonSchema` crash on cyclic scopes with strict-reject union branches

> **Affects:** `arktype` 2.2.0 with `@ark/schema` 0.56.0 (the version pinned in this repo).
> **Status:** Reproduced locally; not yet filed upstream.
> **Symptom:** `exported.Group.toJsonSchema({...})` throws an internal operand error.

## Symptom

```text
InternalArktypeError: Unexpected JSON Schema input for structure: {}
    at Object.throwInternalOperandError (@ark/schema/out/shared/toJsonSchema.js:38:50)
    at StructureNode.reduceJsonSchema (@ark/schema/out/structure/structure.js:553:37)
    at IntersectionNode.innerToJsonSchema (@ark/schema/out/roots/intersection.js:179:21)
```

Runtime validation is unaffected — the same type validates input correctly. Only `toJsonSchema` crashes.

## Minimal reproduction

```js
import { scope, type } from "arktype";

// Two structurally-different branches sharing a discriminant key.
// Both have onUndeclaredKey("reject") applied individually.
const RGB = type({
  colorSpace: "'srgb'",
  components: [
    "0 <= number <= 1",
    "0 <= number <= 1",
    "0 <= number <= 1",
  ],
}).onUndeclaredKey("reject");

const HSL = type({
  colorSpace: "'hsl'",
  components: [
    "0 <= number < 360",
    "0 <= number <= 100",
    "0 <= number <= 100",
  ],
}).onUndeclaredKey("reject");

// A union of those two branches. Alone, this emits JSON Schema fine.
const ColorValue = RGB.or(HSL);

// A simple token that wraps the union.
const Token = type({
  $type: "'color'",
  $value: ColorValue,
});

// Put Token inside a cyclic scope.
const $ = scope({
  Token,
  Group: {
    "[/^[^${}.][^{}.]*$/]": "Group | Token",
  },
});

Token.toJsonSchema();                 // ✅ ok
$.export().Group.toJsonSchema();      // ❌ throws "Unexpected JSON Schema input for structure: {}"
```

## Required ingredients

All three are necessary; remove any one and the crash disappears (bisected locally).

1. **A cyclic scope.** Because `Group` references `"Group | Token"`, the emitter flips into ref-mode (`useRefs` is auto-enabled for cyclic types — see `roots/root.js:72`).
2. **A structural union inside the token.** `ColorValue = RGB.or(HSL)` — two object branches.
3. **`onUndeclaredKey("reject")` (equivalent to `additionalProperties: false`) on each branch of that union.** The strict-reject applied to each branch is the load-bearing part; a plain union without it emits fine.

## Root cause (best guess)

Walk into `node_modules/.pnpm/@ark+schema@0.56.0/node_modules/@ark/schema/out/structure/structure.js` around line 540:

```js
switch (base.type) {
  case "object":
    return this.reduceObjectJsonSchema(schema, ctx);
  case "array":
    const arraySchema = /* ... */;
    // ...
    return arraySchema;
  default:
    return ToJsonSchema.throwInternalOperandError("structure", schema);
}
```

`reduceJsonSchema` switches on `schema.type`. The `default` arm is the crash point — it fires when the incoming `schema` object has no `type` set yet (it's literally `{}`).

Chain above it, in `roots/intersection.js` around line 175–180, `IntersectionNode.innerToJsonSchema` walks the intersection's child nodes and reduces them one at a time, threading the partial schema through.

The hypothesis: in `useRefs` mode the union's branches are each hoisted into `$defs` and represented at their use site as a `$ref` stub — literally `{ $ref: "#/$defs/..." }` with **no `type`**. When the reducer then tries to apply a structural constraint (from `onUndeclaredKey("reject")`, which would normally add `additionalProperties: false`) onto that ref stub, it hits the `default` arm and throws.

In short:

> The structural constraint reducer assumes it runs against a concrete object/array schema, but in cyclic-emit mode the branch it receives is a `$ref` placeholder. The "reject undeclared keys on a union branch that got hoisted into `$defs`" combination is what it can't handle.

## Why it bit this repo

We emit JSON Schema for the DTCG tokens format. The Color value is a discriminated union with 8 branches — one per colorSpace — each with `onUndeclaredKey("reject")` so that stray sub-keys don't slip through. When we wrap everything in a scope for recursive group/token nesting, all three ingredients line up.

## Workaround in this repo

`generate-schema.ts` emits from `Token` (the non-cyclic token shape) rather than from `TokensFile` (the cyclic group shape). The emitted `schema.json` still covers the full per-token shape — sufficient for Monaco autocomplete in the playground — but doesn't describe the recursive group structure at the top level.

```ts
// generate-schema.ts
import { Token } from "./src/index.ts";

writeFileSync(
  "schema.json",
  JSON.stringify(
    Token.toJsonSchema({
      fallback: { default: (ctx) => ctx.base },
    }),
    null,
    2,
  ),
);
```

Runtime validation of full recursive DTCG documents still uses the cyclic scope and works correctly — this workaround only affects the emitted `schema.json`.

## If filing upstream

Use the reproduction above (it's ~30 lines, self-contained, no DTCG context needed). Suggested framing:

- **Title:** `toJsonSchema` throws "Unexpected JSON Schema input for structure: {}" on cyclic scope containing a structural union with strict-reject branches
- **Environment:** `arktype@2.2.0`, `@ark/schema@0.56.0`, Node 24
- **Failing location:** `structure/structure.js:553` (the `default` arm of the type switch), reached via `roots/intersection.js:179` in ref-emit mode
- **Load-bearing interaction:** remove `.onUndeclaredKey("reject")` from the union branches OR break the scope cycle OR inline the union into a single branch — each of those three changes, independently, makes the crash go away

Repo: <https://github.com/arktypeio/arktype>.
