import { type } from "arktype";

// Per DTCG 2025.10 format.json#/definitions/curlyBraceReference.
// Matches '{name}' or '{group.nested.name}' where each segment starts with a
// non-$, non-{, non-}, non-. character and contains no {, }, or . thereafter.
export const ValueAlias = type(
  "/^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*}$/",
);

// Per DTCG 2025.10 format.json#/definitions/jsonPointerReference.
// RFC 6901 JSON Pointer starting with '#/'. Further segment validation is
// left to consumers — the spec only constrains the prefix.
export const JsonPointerRef = type("/^#\\//");

// Nested $ref form. Spec allows `{ "$ref": "#/..." }` anywhere an inline
// value or `{alias}` string is accepted (any composite sub-value, any
// primitive leaf inside a composite, or as a whole $value). Distinct from
// the token-root TokenRef in src/token.ts, which is the standalone token
// form (mutually exclusive with $value).
export const JsonPointerRefObject = type({
  $ref: JsonPointerRef,
}).onUndeclaredKey("reject");

export const DimensionPrimitive = type({
  value: type("number").or(JsonPointerRefObject),
  unit: type("'rem' | 'px'").or(JsonPointerRefObject),
}).onUndeclaredKey("reject");

export const Extensions = type({ "[string]": "unknown" });

export const CommonMetadata = type({
  "$description?": "string",
  "$extensions?": Extensions,
  "$deprecated?": "boolean | string",
});
