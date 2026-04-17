import { writeFileSync } from "node:fs";
import { Token, TokensFile } from "./src/index.ts";

console.log(Token.toJsonSchema());

writeFileSync(
  "schema.json",
  JSON.stringify(
    TokensFile.toJsonSchema({
      fallback: {
        default: (ctx) => ctx.base,
      },
    }),
    null,
    2
  )
);
