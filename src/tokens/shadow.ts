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

export const ShadowValue = ValueAlias.or(SingleShadow).or(
  SingleShadow.array().atLeastLength(1),
);

export const Shadow = type({
  $type: "'shadow'",
  $value: ShadowValue,
}).describe("Shadow");
