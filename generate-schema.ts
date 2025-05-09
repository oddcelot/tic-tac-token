import { Token, Schema, Schema2 } from "./schema.ts";
import { writeFileSync } from "node:fs";
console.log(Token.toJsonSchema());

writeFileSync(
  "schema.json",
  JSON.stringify(
    Schema2.toJsonSchema({
      fallback: {
        default: (ctx) => ctx.base,
      },
    }),
    null,
    2
  )
);
