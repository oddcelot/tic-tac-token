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

// The root document is itself a Group; we inline the Group shape at the
// top level (rather than putting it under $defs and referencing with a
// top-level $ref) so JSON Schema validators that don't treat top-level
// $ref-with-siblings uniformly — notably Monaco / vscode-json-languageservice
// — still evaluate every keyword at the root. Self-recursion inside
// patternProperties uses "$ref": "#" to point back at the root.
const documentSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tic-tac-token.local/schema.json",
  title: "DTCG Tokens Document",
  description:
    "Schema for a design-tokens file. The root is a Group; nested keys are Groups or Tokens.",
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
      oneOf: [{ $ref: "#" }, { $ref: "#/$defs/token" }],
    },
  },
  additionalProperties: false,
  $defs: {
    token: tokenSchema,
  },
};

writeFileSync("schema.json", JSON.stringify(documentSchema, null, 2));
