import { type } from "arktype";
import { Color } from "./color.ts";
import { DimensionPrimitive, ValueAlias } from "./shared.ts";

export const SingleShadow = type({
  color: Color,
  offsetX: DimensionPrimitive,
  offsetY: DimensionPrimitive,
  blur: DimensionPrimitive,
  spread: DimensionPrimitive,
  "inset?": "boolean",
}).onUndeclaredKey("reject");

export const Shadow = type({
  $type: "'shadow'",
  $value: ValueAlias.or(SingleShadow).or(SingleShadow.array()),
}).describe("Shadow");
