import { type } from "arktype";

export const ValueAlias = type("/^{([^{}]+?)}$/");

export const DimensionPrimitive = type({
  value: "number",
  unit: "'rem' | 'px'",
});

export const Extensions = type({ "[string]": "unknown" });

export const CommonMetadata = type({
  "$description?": "string",
  "$extensions?": Extensions,
  "$deprecated?": "boolean | string",
});
