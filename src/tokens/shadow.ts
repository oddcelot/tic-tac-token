import { type } from "arktype";
import { ColorValue } from "./color.ts";
import { DimensionValue } from "./dimension.ts";
import { ValueAlias } from "./shared.ts";

export const SingleShadow = type({
  color: ColorValue,
  offsetX: DimensionValue,
  offsetY: DimensionValue,
  blur: DimensionValue,
  spread: DimensionValue,
  "inset?": "boolean",
}).onUndeclaredKey("reject");

// Per DTCG 2025.10 §9.6: the array form "may mix inline objects with
// `{shadow.ref}` strings" — each element is either a SingleShadow value or
// a curly-brace alias to another shadow token.
export const ShadowValue = ValueAlias.or(SingleShadow).or(
  SingleShadow.or(ValueAlias).array().atLeastLength(1),
);

export const Shadow = type({
  $type: "'shadow'",
  $value: ShadowValue,
}).describe("Shadow");
