import { writeFileSync } from "node:fs";
import { Token } from "./src/index.ts";

// schema.json describes a single token's shape, used by the playground's
// Monaco editor for autocomplete and inline validation of token objects.
// The full recursive TokensFile/Group shape (with nested groups and group
// metadata) is validated at runtime but is not emitted as JSON Schema —
// arktype's JSON Schema emitter currently throws an internal error on
// cyclic scopes that contain discriminated unions, so we only emit the
// non-cyclic Token shape here. Track upstream:
// https://github.com/arktypeio/arktype/issues (cyclic union emission).
writeFileSync(
  "schema.json",
  JSON.stringify(
    Token.toJsonSchema({
      fallback: {
        default: (ctx) => ctx.base,
      },
    }),
    null,
    2
  )
);
