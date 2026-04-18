import { writeFileSync } from "node:fs";
import { Token } from "./src/index.ts";

// The root of a DTCG tokens document is a recursive Group. Each child key
// whose name matches ^[^${}.][^{}.]*$ is itself a Group or a Token, and a
// Token is the discriminated shape emitted by arktype from our Token type.
//
// Ideally we'd just call TokensFile.toJsonSchema(), but arktype's JSON
// Schema emitter currently throws an internal error on cyclic scopes that
// contain discriminated unions (see docs/arktype-json-schema-bug.md). So
// we emit the non-cyclic Token schema by itself and wrap it in a
// hand-written recursive Group shape at the outer level.

const tokenSchema = Token.toJsonSchema({
  fallback: { default: (ctx) => ctx.base },
});

// Strip the dialect marker from the inner token schema — we set it once on
// the outermost document schema instead.
delete (tokenSchema as { $schema?: string }).$schema;

const tokenTypeNames = [
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "strokeStyle",
  "border",
  "transition",
  "shadow",
  "gradient",
  "typography",
];

const nameSegment = "[^${}.][^{}.]*";
const curlyBraceRef = `^\\{${nameSegment}(\\.${nameSegment})*\\}$`;
const nameRef = `^${nameSegment}$`;

const group = {
  type: "object",
  properties: {
    $schema: { type: "string" },
    $type: { enum: tokenTypeNames },
    $description: { type: "string" },
    $extensions: { type: "object" },
    $extends: { type: "string", pattern: curlyBraceRef },
    $deprecated: { oneOf: [{ type: "boolean" }, { type: "string" }] },
    $root: { $ref: "#/$defs/token" },
  },
  patternProperties: {
    [nameRef]: {
      oneOf: [{ $ref: "#/$defs/group" }, { $ref: "#/$defs/token" }],
    },
  },
  additionalProperties: false,
} as const;

const documentSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tic-tac-token.local/schema.json",
  title: "DTCG Tokens Document",
  description:
    "Schema for a design-tokens file. The root is a Group; nested keys are Groups or Tokens.",
  $ref: "#/$defs/group",
  $defs: {
    group,
    token: tokenSchema,
  },
};

writeFileSync("schema.json", JSON.stringify(documentSchema, null, 2));
