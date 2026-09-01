import { type } from "arktype";
import { regex } from "arkregex";

// Per DTCG 2025.10 format.json#/definitions/curlyBraceReference.
// Matches '{name}' or '{group.nested.name}' where each segment starts with a
// non-$, non-{, non-}, non-. character and contains no {, }, or . thereafter.
//
// `$root` is the sole exception (§6.2, §6.7.2): a group's own token is
// addressed as '{group.$root}' (or bare '{$root}' at the document root),
// so it is admitted as a terminal segment only.
//
// Built via `regex.as` because the trailing `\}` escape is required for JSON
// Schema draft-2020 strict-Unicode validators like ajv with the `u` flag,
// which reject a lone `}` as "Lone quantifier brackets". arkregex's type-level
// parser flags `\}` as an unnecessary escape, so we bypass pattern inference
// (the alias stays a plain `string` type) rather than drop the escape.
export const ValueAlias = type(
  regex.as(
    "^\\{(?:\\$root|[^${}.][^{}.]*(?:\\.[^${}.][^{}.]*)*(?:\\.\\$root)?)\\}$",
  ),
);

// Per DTCG 2025.10 format.json#/definitions/jsonPointerReference.
// RFC 6901 JSON Pointer starting with '#/'. Further segment validation is
// left to consumers — the spec only constrains the prefix.
export const JsonPointerRef = type(regex("^#/"));

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
