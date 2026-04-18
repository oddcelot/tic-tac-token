import { type } from "arktype";
import { ColorValue } from "./color.ts";
import { ValueAlias } from "./shared.ts";

export const GradientStop = type({
  color: ColorValue,
  position: ValueAlias.or("0 <= number <= 1"),
}).onUndeclaredKey("reject");

export const GradientValue = ValueAlias.or(
  GradientStop.array().atLeastLength(1),
);

export const Gradient = type({
  $type: "'gradient'",
  $value: GradientValue,
}).describe("Gradient");
