import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TokensFile } from "@oddsquad/tic-tac-token";
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";

const tokensPath = fileURLToPath(new URL("./tokens.json", import.meta.url));
const doc = JSON.parse(readFileSync(tokensPath, "utf8"));

const validation = TokensFile(doc);
if (validation instanceof Array) {
  console.error("Validation failed:");
  for (const issue of validation) console.error(`  - ${issue.path}: ${issue.message}`);
  process.exit(1);
}
console.log(`Validated ${tokensPath} — structure OK.\n`);

const { tokens, errors } = resolveTokens(doc);
if (errors.length > 0) {
  console.error("Resolver errors:");
  for (const err of errors) console.error(`  - [${err.kind}] ${err.at}: ${err.message}`);
  process.exit(1);
}

console.log("Resolved tokens:");
for (const token of tokens) {
  console.log(`  ${token.path} (${token.$type}):`, JSON.stringify(token.$value));
}
