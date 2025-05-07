import { Token } from "./schema.ts";
import { writeFileSync } from "node:fs";
console.log("yo");
console.log(Token.toJsonSchema());

writeFileSync("schema.json", JSON.stringify(Token.toJsonSchema(), null, 2));
