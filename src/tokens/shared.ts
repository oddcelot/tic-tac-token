import { type } from "arktype";

// Per DTCG 2025.10 format.json#/definitions/curlyBraceReference.
// Matches '{name}' or '{group.nested.name}' where each segment starts with a
// non-$, non-{, non-}, non-. character and contains no {, }, or . thereafter.
export const ValueAlias = type(
  "/^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$/",
);

export const DimensionPrimitive = type({
  value: "number",
  unit: "'rem' | 'px'",
}).onUndeclaredKey("reject");

export const Extensions = type({ "[string]": "unknown" });

export const CommonMetadata = type({
  "$description?": "string",
  "$extensions?": Extensions,
  "$deprecated?": "boolean | string",
});
