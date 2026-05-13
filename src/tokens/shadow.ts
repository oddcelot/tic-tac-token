import { type } from "arktype";
import { ColorValue } from "./color.ts";
import { DimensionValue } from "./dimension.ts";
import { JsonPointerRefObject, ValueAlias } from "./shared.ts";

export const SingleShadow = type({
  color: ColorValue,
  offsetX: DimensionValue,
  offsetY: DimensionValue,
  blur: DimensionValue,
  spread: DimensionValue,
  "inset?": type("boolean").or(JsonPointerRefObject),
}).onUndeclaredKey("reject");

// Per DTCG 2025.10 §9.6: the array form "may mix inline objects with
// `{shadow.ref}` strings" — each element is either a SingleShadow value, a
// curly-brace alias, or a nested `$ref` object to another shadow token.
const shadowArrayItem = SingleShadow.or(ValueAlias).or(JsonPointerRefObject);

export const ShadowValue = ValueAlias.or(JsonPointerRefObject)
  .or(SingleShadow)
  .or(shadowArrayItem.array().atLeastLength(1));

export const Shadow = type({
  $type: "'shadow'",
  $value: ShadowValue,
}).describe("Shadow");
